import { prisma } from '../lib/prisma.js';

export class OrderService {
  async getOrderSummary(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return order;
  }

  async markOrderAsPaid(orderId: string, paidAmount: number) {
    return prisma.order.update({
      where: { id: orderId },
      data: {
        paidTotal: { increment: paidAmount },
        remaining: { decrement: paidAmount },
      },
    });
  }
}

export const orderService = new OrderService();
