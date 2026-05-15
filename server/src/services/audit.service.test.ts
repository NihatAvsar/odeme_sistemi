import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuditLogger, sanitizeAuditPayload } from './audit.service.js';

test('sanitizeAuditPayload removes sensitive fields recursively', () => {
  const payload = sanitizeAuditPayload({
    username: 'admin',
    password: 'secret-password',
    nested: {
      accessToken: 'token-value',
      cardNumber: '4111111111111111',
      safe: 'value',
    },
    items: [
      {
        name: 'line',
        cvv: '123',
      },
    ],
  });

  assert.deepEqual(payload, {
    username: 'admin',
    nested: {
      safe: 'value',
    },
    items: [
      {
        name: 'line',
      },
    ],
  });
});

test('audit logger writes sanitized payload and request context', async () => {
  let createdData: unknown;
  const writeAuditLog = createAuditLogger({
    auditLog: {
      create: async ({ data }: { data: unknown }) => {
        createdData = data;
      },
    },
  } as never);

  await writeAuditLog({
    restaurantId: 'restaurant-1',
    actorId: 'admin-1',
    action: 'payment.initiate',
    entityType: 'Payment',
    entityId: 'payment-1',
    ip: '127.0.0.1',
    userAgent: 'node-test',
    payload: {
      amount: 100,
      paymentToken: 'hidden',
    },
  });

  assert.deepEqual(createdData, {
    restaurantId: 'restaurant-1',
    actorId: 'admin-1',
    action: 'payment.initiate',
    entityType: 'Payment',
    entityId: 'payment-1',
    payload: {
      amount: 100,
      ip: '127.0.0.1',
      userAgent: 'node-test',
    },
  });
});

test('audit logger does not throw when persistence fails', async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;

  try {
    const writeAuditLog = createAuditLogger({
      auditLog: {
        create: async () => {
          throw new Error('database unavailable');
        },
      },
    } as never);

    await assert.doesNotReject(() =>
      writeAuditLog({
        action: 'payment.failed',
        entityType: 'Payment',
        entityId: 'payment-1',
      }),
    );
  } finally {
    console.error = originalConsoleError;
  }
});
