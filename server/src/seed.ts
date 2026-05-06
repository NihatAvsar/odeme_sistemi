import 'dotenv/config';
import { prisma } from './lib/prisma.js';

async function main() {
  await prisma.paymentAllocation.deleteMany();
  await prisma.tip.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.tableSession.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.table.deleteMany();
  await prisma.restaurant.deleteMany();

  const restaurant = await prisma.restaurant.create({
    data: {
      id: 'restaurant-demo',
      name: 'Demo Restoran',
      slug: 'demo-restaurant',
    },
  });

  const tables = await Promise.all(
    Array.from({ length: 12 }, (_, index) => {
      const code = String(index + 1);
      return prisma.table.create({
        data: {
          id: `table-${code}`,
          restaurantId: restaurant.id,
          code,
          name: `Masa ${code}`,
          qrToken: `demo-qr-token-${code}`,
          status: code === '12' ? 'OCCUPIED' : 'AVAILABLE',
          capacity: 4,
        },
      });
    }),
  );

  const table = tables[11];

  const category = await prisma.menuCategory.create({
    data: {
      id: 'category-main',
      restaurantId: restaurant.id,
      name: 'Ana Yemekler',
      sortOrder: 1,
    },
  });

  const lahmacun = await prisma.menuItem.create({
    data: {
      id: 'menu-lahmacun',
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: 'Lahmacun',
      price: 65,
      currency: 'TRY',
    },
  });

  const ayran = await prisma.menuItem.create({
    data: {
      id: 'menu-ayran',
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: 'Ayran',
      price: 20,
      currency: 'TRY',
    },
  });

  const kunefe = await prisma.menuItem.create({
    data: {
      id: 'menu-kunefe',
      restaurantId: restaurant.id,
      categoryId: category.id,
      name: 'Künefe',
      price: 95,
      currency: 'TRY',
    },
  });

  const session = await prisma.tableSession.create({
    data: {
      id: 'session-demo-1',
      restaurantId: restaurant.id,
      tableId: table.id,
      status: 'OPEN',
    },
  });

  const subtotal = 65 * 2 + 20 * 3 + 95;
  const serviceFee = subtotal * 0.08;
  const total = subtotal + serviceFee;

  await prisma.order.create({
    data: {
      id: 'demo-order-1',
      restaurantId: restaurant.id,
      sessionId: session.id,
      status: 'OPEN',
      subtotal,
      serviceFee,
      total,
      remaining: total,
      paidTotal: 0,
      items: {
        create: [
          {
            id: 'orderitem-1',
            menuItemId: lahmacun.id,
            nameSnapshot: lahmacun.name,
            unitPriceSnapshot: 65,
            quantity: 2,
            lineTotal: 130,
          },
          {
            id: 'orderitem-2',
            menuItemId: ayran.id,
            nameSnapshot: ayran.name,
            unitPriceSnapshot: 20,
            quantity: 3,
            lineTotal: 60,
          },
          {
            id: 'orderitem-3',
            menuItemId: kunefe.id,
            nameSnapshot: kunefe.name,
            unitPriceSnapshot: 95,
            quantity: 1,
            lineTotal: 95,
          },
        ],
      },
    },
  });

  // eslint-disable-next-line no-console
  console.log('Demo seed created. Order ID: demo-order-1');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
