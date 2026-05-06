import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { MockPaymentProvider } from '../providers/mock-payment-provider.js';
import type { PaymentConfirmInput, PaymentInitiateInput } from '../types/payment.js';
import { realtimeGateway } from '../lib/realtime.js';

type SelectedItem = {
  id: string;
  quantity: number;
};

function buildOrderItemKey(item: {
  menuItemId: string | null;
  unitPriceSnapshot: { toString(): string } | string | number;
  notes: string | null;
}) {
  return [item.menuItemId ?? 'none', String(item.unitPriceSnapshot), item.notes ?? ''].join('|');
}

function normalizeSelectedItems(metadata: unknown): SelectedItem[] {
  if (!metadata || typeof metadata !== 'object') return [];

  const maybeItems = (metadata as { selectedItems?: unknown }).selectedItems;
  if (!Array.isArray(maybeItems)) return [];

  return maybeItems
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const id = (item as { id?: unknown }).id;
      const quantity = (item as { quantity?: unknown }).quantity;
      if (typeof id !== 'string' || typeof quantity !== 'number') return null;
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      return { id, quantity } satisfies SelectedItem;
    })
    .filter((item): item is SelectedItem => item !== null);
}

const providers = {
  'mock-stripe': new MockPaymentProvider(),
  'mock-iyzico': new MockPaymentProvider(),
} as const;

export class PaymentService {
  async initiate(input: PaymentInitiateInput) {
    const provider = providers[input.provider ?? 'mock-stripe'] ?? providers['mock-stripe'];

    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existingPayment) {
      return {
        payment: existingPayment,
        intent: {
          providerRef: existingPayment.providerRef ?? '',
          status: existingPayment.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
        },
      };
    }

    const selectedItems = normalizeSelectedItems(input.metadata);
    let computedAmount = Number(input.amount);

    if (input.type === 'ITEM_SPLIT') {
      if (selectedItems.length === 0) {
        throw new Error('No selected items for ITEM_SPLIT payment');
      }

      const orderItems = await prisma.orderItem.findMany({
        where: {
          orderId: input.orderId,
        },
      });

      const groupedOrderItems = new Map<string, typeof orderItems>();
      for (const item of orderItems) {
        const key = buildOrderItemKey(item);
        const list = groupedOrderItems.get(key) ?? [];
        list.push(item);
        groupedOrderItems.set(key, list);
      }

      computedAmount = 0;
      for (const selected of selectedItems) {
        const group = groupedOrderItems.get(selected.id);
        if (!group || group.length === 0) {
          throw new Error('Selected item not found in order');
        }

        const availableQty = group.reduce((sum, item) => sum + Math.max(0, item.quantity - item.paidQuantity), 0);
        if (selected.quantity > availableQty) {
          throw new Error('Selected quantity exceeds available quantity');
        }

        const unitPrice = Number(group[0].unitPriceSnapshot);
        computedAmount += unitPrice * selected.quantity;
      }
    }

    if (computedAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    if (input.type === 'ITEM_SPLIT') {
      const itemRemainingAmount = order.items.reduce((sum, item) => {
        const availableQty = Math.max(0, item.quantity - item.paidQuantity);
        return sum + Number(item.unitPriceSnapshot) * availableQty;
      }, 0);

      if (computedAmount > itemRemainingAmount) {
        throw new Error('Payment amount exceeds remaining item balance');
      }
    } else if (computedAmount > Number(order.remaining)) {
      throw new Error('Payment amount exceeds remaining balance');
    }

    const intent = await provider.createPaymentIntent(input);

    const payment = await prisma.payment.create({
      data: {
        orderId: input.orderId,
        type: input.type,
        status: 'PENDING',
        amount: computedAmount,
        tipAmount: input.tipAmount ?? 0,
        provider: provider.name,
        providerRef: intent.providerRef,
        idempotencyKey: input.idempotencyKey,
        payerName: input.payerName,
        payerCount: input.payerCount,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return { payment, intent };
  }

  async confirm(input: PaymentConfirmInput) {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        order: {
          include: {
            session: {
              include: { table: true },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'SUCCESS') {
      return payment;
    }

    const provider = providers[payment.provider as keyof typeof providers] ?? providers['mock-stripe'];
    const providerRef = input.providerRef ?? payment.providerRef;

    if (!providerRef) {
      throw new Error('Provider reference missing');
    }

    const result = await provider.confirmPayment(providerRef);

    if (result.status !== 'SUCCESS') {
      return prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failedAt: new Date() },
      });
    }

    const updatedPayment = await prisma.$transaction(async (tx) => {
      const paymentAmount = Number(payment.amount);
      const remainingAfter = Number(payment.order.remaining) - paymentAmount;
      const paidTotalAfter = Number(payment.order.paidTotal) + paymentAmount;

      const selectedItems = normalizeSelectedItems(payment.metadata);

      const paidPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          processedAt: new Date(),
          providerRef: result.providerRef,
        },
      });

      if (payment.type === 'ITEM_SPLIT' && selectedItems.length > 0) {
        const itemMap = new Map(selectedItems.map((item) => [item.id, item.quantity]));
        const orderItems = await tx.orderItem.findMany({
          where: {
            orderId: payment.orderId,
          },
          orderBy: { createdAt: 'asc' },
        });

        const orderItemsByGroup = new Map<string, typeof orderItems>();
        for (const item of orderItems) {
          const key = buildOrderItemKey(item);
          const list = orderItemsByGroup.get(key) ?? [];
          list.push(item);
          orderItemsByGroup.set(key, list);
        }

        for (const selected of selectedItems) {
          const group = orderItemsByGroup.get(selected.id) ?? [];
          if (group.length === 0) continue;

          let remainingToApply = selected.quantity;
          const unitPrice = Number(group[0].unitPriceSnapshot);

          for (const orderItem of group) {
            if (remainingToApply <= 0) break;

            const availableQty = Math.max(0, orderItem.quantity - orderItem.paidQuantity);
            const applyQty = Math.min(remainingToApply, availableQty);
            if (applyQty <= 0) continue;

            const nextPaidQty = orderItem.paidQuantity + applyQty;
            const nextStatus = nextPaidQty >= orderItem.quantity ? 'PAID' : 'PARTIALLY_PAID';

            await tx.orderItem.update({
              where: { id: orderItem.id },
              data: {
                paidQuantity: nextPaidQty,
                status: nextStatus,
                version: { increment: 1 },
              },
            });

            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                orderItemId: orderItem.id,
                quantity: applyQty,
                amount: unitPrice * applyQty,
              },
            });

            remainingToApply -= applyQty;
          }
        }
      }

      const updatedOrder = await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paidTotal: paidTotalAfter,
          remaining: Math.max(0, remainingAfter),
          status: remainingAfter <= 0 ? 'PAID' : 'PARTIALLY_PAID',
          version: { increment: 1 },
        },
      });

      return { paidPayment, updatedOrder };
    });

    realtimeGateway.emitToOrder(payment.orderId, 'order.updated', {
      orderId: payment.orderId,
      tableId: payment.order.session.table.id,
    });

    realtimeGateway.emitToTable(payment.order.session.table.id, 'payment.updated', {
      tableId: payment.order.session.table.id,
      paymentId: payment.id,
      status: 'SUCCESS',
    });

    return updatedPayment.paidPayment;
  }
}

export const paymentService = new PaymentService();
