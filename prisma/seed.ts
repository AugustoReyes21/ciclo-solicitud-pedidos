import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.customer.upsert({
    where: { email: 'ana@example.com' },
    update: { name: 'Ana López' },
    create: { email: 'ana@example.com', name: 'Ana López' },
  });

  const keyboard = await prisma.product.upsert({
    where: { sku: 'TEC-001' },
    update: { name: 'Teclado mecánico', priceCents: 45000, stock: 12 },
    create: {
      sku: 'TEC-001',
      name: 'Teclado mecánico',
      priceCents: 45000,
      stock: 12,
    },
  });

  await prisma.product.upsert({
    where: { sku: 'MOU-001' },
    update: { name: 'Mouse ergonómico', priceCents: 18000, stock: 20 },
    create: {
      sku: 'MOU-001',
      name: 'Mouse ergonómico',
      priceCents: 18000,
      stock: 20,
    },
  });

  const order = await prisma.order.upsert({
    where: { externalCode: 'SEED-ORDER-001' },
    update: { customerId: customer.id, status: 'CONFIRMED' },
    create: {
      externalCode: 'SEED-ORDER-001',
      customerId: customer.id,
      status: 'CONFIRMED',
    },
  });

  await prisma.orderItem.upsert({
    where: {
      orderId_productId: { orderId: order.id, productId: keyboard.id },
    },
    update: { quantity: 1, unitPriceCents: keyboard.priceCents },
    create: {
      orderId: order.id,
      productId: keyboard.id,
      quantity: 1,
      unitPriceCents: keyboard.priceCents,
    },
  });

  console.log('Seed listo: cliente, productos y pedido mínimo reproducible.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
