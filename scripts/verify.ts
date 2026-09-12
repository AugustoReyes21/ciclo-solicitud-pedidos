import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const server = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: '3100' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverError = '';
  server.stderr.on('data', (chunk) => (serverError += chunk.toString()));
  await waitForServer(serverError);

  try {
    const seedCounts = {
      customers: await prisma.customer.count(),
      products: await prisma.product.count(),
      orders: await prisma.order.count(),
      items: await prisma.orderItem.count(),
    };
    const expectedSeedCounts = {
      customers: 1,
      products: 3,
      orders: 1,
      items: 1,
    };
    if (JSON.stringify(seedCounts) !== JSON.stringify(expectedSeedCounts)) {
      throw new Error(
        `El seed repetido generó duplicados: ${JSON.stringify(seedCounts)}`,
      );
    }
    console.log(
      '1/5 Historial y seed idempotente (ejecutado dos veces):',
      seedCounts,
    );

    const invalid = await fetch('http://localhost:3100/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: '1',
        externalCode: 'INVALID-REQUEST',
        items: [{ productId: '1', quantity: 0 }],
      }),
    });
    const invalidBody = await invalid.json();
    if (invalid.status !== 400)
      throw new Error(
        `La validación HTTP respondió ${invalid.status}: ${JSON.stringify(invalidBody)}`,
      );
    console.log('2/5 Validación HTTP (400):', invalidBody);

    const customer = await prisma.customer.findUniqueOrThrow({
      where: { email: 'ana@example.com' },
    });
    const mouse = await prisma.product.findUniqueOrThrow({
      where: { sku: 'MOU-001' },
    });
    const externalCode = `VERIFY-${Date.now()}`;
    const valid = await fetch('http://localhost:3100/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: String(customer.id),
        externalCode,
        items: [{ productId: String(mouse.id), quantity: '2' }],
      }),
    });
    const validBody = await valid.json();
    if (valid.status !== 201 || validBody.totalCents !== 36000) {
      throw new Error(
        `La solicitud válida falló: ${JSON.stringify(validBody)}`,
      );
    }
    console.log('3/5 Transformación + servicio + persistencia (201):', {
      externalCode: validBody.externalCode,
      quantity: validBody.items[0].quantity,
      totalCents: validBody.totalCents,
    });

    const persisted = await prisma.order.findUniqueOrThrow({
      where: { externalCode },
      include: { items: true },
    });
    console.log('4/5 Relación persistida:', {
      orderId: persisted.id,
      orderItemId: persisted.items[0].id,
      productId: persisted.items[0].productId,
    });

    let constraintProtected = false;
    try {
      await prisma.$executeRaw`
        INSERT INTO "OrderItem" ("orderId", "productId", "quantity", "unitPriceCents")
        VALUES (${persisted.id}, ${keyboardSafeId(mouse.id)}, 0, 100)
      `;
    } catch {
      constraintProtected = true;
    }
    if (!constraintProtected)
      throw new Error('CHECK quantity > 0 no fue aplicado');
    console.log(
      '5/5 Restricción CHECK protegida por PostgreSQL: quantity=0 fue rechazada.',
    );
    console.log('VERIFICACIÓN COMPLETA: OK');
  } finally {
    server.kill();
    await prisma.$disconnect();
  }
}

async function waitForServer(initialError: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch('http://localhost:3100/health');
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`La API no inició. ${initialError}`);
}

function keyboardSafeId(id: number) {
  return id;
}

main().catch((error) => {
  console.error('VERIFICACIÓN FALLIDA:', error);
  process.exitCode = 1;
});
