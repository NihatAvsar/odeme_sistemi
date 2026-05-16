import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import { MockPaymentProvider } from '../providers/mock-payment-provider.js';
import { IyzicoPaymentProvider } from '../providers/iyzico-payment-provider.js';
import type { PaymentConfirmInput, PaymentInitiateInput } from '../types/payment.js';
import { realtimeGateway } from '../lib/realtime.js';
import { scheduleTableCleanup } from './table-release.service.js';
import { writeAuditLog } from '../lib/audit.js';
import { incrementMetric } from '../lib/metrics.js';
import { env } from '../config/env.js';

type SelectedItem = {
  id: string;
  quantity: number;
};

type AuditContext = {
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
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
  iyzico: new IyzicoPaymentProvider(),
} as const;

type ProviderName = keyof typeof providers;

function resolveProviderName(provider?: string): ProviderName {
  const selected = provider ?? env.paymentProvider;
  if (!(selected in providers)) return env.isProduction ? 'iyzico' : 'mock-stripe';
  if (env.isProduction && selected !== 'iyzico') return 'iyzico';
  return selected as ProviderName;
}

export class PaymentService {
  private async finalizeSuccessfulPayment(paymentId: string, providerRef?: string, auditContext?: AuditContext) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
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

    if (payment.status === 'SUCCESS' && payment.processedAt) {
      return payment;
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
          providerRef: providerRef ?? payment.providerRef,
        },
      });

      let allItemsPaid = false;

      if (payment.type === 'ITEM_SPLIT' && selectedItems.length > 0) {
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

        const unpaidItemCount = await tx.orderItem.count({
          where: {
            orderId: payment.orderId,
            status: { in: ['OPEN', 'PARTIALLY_PAID'] },
          },
        });
        allItemsPaid = unpaidItemCount === 0;
      }

      const orderClosed = remainingAfter <= 0 || allItemsPaid;
      const closedAt = new Date();

      await tx.order.update({
        where: { id: payment.orderId },
        data: {
          paidTotal: orderClosed ? payment.order.total : paidTotalAfter,
          remaining: orderClosed ? 0 : Math.max(0, remainingAfter),
          status: orderClosed ? 'PAID' : 'PARTIALLY_PAID',
          closedAt: orderClosed ? closedAt : payment.order.closedAt,
          version: { increment: 1 },
        },
      });

      if (orderClosed) {
        await scheduleTableCleanup(payment.order.session.table.id, payment.order.sessionId, closedAt, tx);
      }

      return paidPayment;
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

    await writeAuditLog({
      restaurantId: payment.order.restaurantId,
      actorId: auditContext?.actorId,
      action: 'payment.success',
      entityType: 'Payment',
      entityId: payment.id,
      payload: {
        orderId: payment.orderId,
        tableId: payment.order.session.table.id,
        amount: Number(payment.amount),
        type: payment.type,
        provider: payment.provider,
        providerRef,
      },
      ip: auditContext?.ip,
      userAgent: auditContext?.userAgent,
    });
    incrementMetric('payment_events_total', { status: 'success', provider: payment.provider, type: payment.type });

    return updatedPayment;
  }

  async initiate(input: PaymentInitiateInput, auditContext?: AuditContext) {
    const provider = providers[resolveProviderName()];

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

    await writeAuditLog({
      restaurantId: order.restaurantId,
      actorId: auditContext?.actorId,
      action: 'payment.initiate',
      entityType: 'Payment',
      entityId: payment.id,
      payload: {
        orderId: payment.orderId,
        amount: Number(payment.amount),
        type: payment.type,
        provider: payment.provider,
        status: payment.status,
        payerCount: payment.payerCount,
        metadata: payment.metadata,
      },
      ip: auditContext?.ip,
      userAgent: auditContext?.userAgent,
    });

    return { payment, intent };
  }

  async confirm(input: PaymentConfirmInput, auditContext?: AuditContext) {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, status: true, provider: true, providerRef: true, order: { select: { restaurantId: true } } },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.status === 'SUCCESS') {
      return this.finalizeSuccessfulPayment(input.paymentId, input.providerRef ?? payment.providerRef ?? undefined, auditContext);
    }

    const provider = providers[resolveProviderName(payment.provider)];
    const providerRef = input.providerRef ?? payment.providerRef;

    if (!providerRef) {
      throw new Error('Provider reference missing');
    }

    const result = await provider.confirmPayment(providerRef);

    if (result.status !== 'SUCCESS') {
      const failedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failedAt: new Date() },
      });

      await writeAuditLog({
        restaurantId: payment.order.restaurantId,
        action: 'payment.failed',
        entityType: 'Payment',
        entityId: payment.id,
        payload: { provider: payment.provider, providerRef },
        ip: auditContext?.ip,
        userAgent: auditContext?.userAgent,
      });
      incrementMetric('payment_events_total', { status: 'failed', provider: payment.provider });

      return failedPayment;
    }

    return this.finalizeSuccessfulPayment(input.paymentId, result.providerRef, auditContext);
  }

  async confirmProviderCallback(providerName: ProviderName, providerRef: string, auditContext?: AuditContext) {
    const payment = await prisma.payment.findFirst({
      where: {
        provider: providerName,
        providerRef,
      },
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

    const provider = providers[providerName];
    const result = await provider.confirmPayment(providerRef);
    if (result.status !== 'SUCCESS') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', failedAt: new Date() },
      });
      incrementMetric('payment_events_total', { status: 'failed', provider: providerName });
      throw new Error('Payment failed');
    }

    const finalized = await this.finalizeSuccessfulPayment(payment.id, result.providerRef, auditContext);
    return {
      payment: finalized,
      tableId: payment.order.session.table.id,
    };
  }

  async cashSettleTable(tableId: string, adminName = 'Kasada Ödendi', auditContext?: AuditContext) {
    const order = await prisma.order.findFirst({
      where: {
        session: {
          tableId,
        },
        status: { in: ['OPEN', 'PARTIALLY_PAID'] },
      },
      include: {
        session: {
          include: {
            table: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!order) {
      throw new Error('Open order not found');
    }

    const remainingAmount = Number(order.remaining);
    if (remainingAmount <= 0) {
      throw new Error('Order already settled');
    }

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        type: 'FULL_BILL',
        status: 'SUCCESS',
        amount: remainingAmount,
        tipAmount: 0,
        provider: 'cash-register',
        providerRef: `cash-${order.id}-${randomUUID()}`,
        idempotencyKey: `cash-${order.id}-${randomUUID()}`,
        payerName: adminName,
        metadata: {
          settledBy: 'cash-register',
        } as Prisma.InputJsonValue,
      },
    });

    return this.finalizeSuccessfulPayment(payment.id, payment.providerRef ?? undefined, {
      ...auditContext,
      actorId: auditContext?.actorId ?? adminName,
    });
  }
}

export const paymentService = new PaymentService();
