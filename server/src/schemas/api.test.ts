import assert from 'node:assert/strict';
import test from 'node:test';
import { orderRequestCreateBody, paymentInitiateBody, tableStatusUpdateBody } from './api.js';

test('payment schema rejects client-selected provider', () => {
  const result = paymentInitiateBody.safeParse({
    orderId: 'order-1',
    type: 'ITEM_SPLIT',
    amount: 100,
    provider: 'iyzico',
    idempotencyKey: 'payment-key-1',
  });

  assert.equal(result.success, false);
});

test('order request schema accepts current customer payload', () => {
  const result = orderRequestCreateBody.safeParse({
    tableId: '12',
    requestedBy: '',
    note: '',
    couponCode: undefined,
    items: [{ menuItemId: 'menu-1', quantity: 2, optionIds: [] }],
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    tableId: '12',
    requestedBy: undefined,
    note: undefined,
    couponCode: undefined,
    items: [{ menuItemId: 'menu-1', quantity: 2, optionIds: [] }],
  });
});

test('order request schema rejects invalid payload', () => {
  const result = orderRequestCreateBody.safeParse({
    tableId: '12',
    items: [{ menuItemId: 'menu-1', quantity: 0 }],
  });

  assert.equal(result.success, false);
});

test('table status schema accepts reservation statuses only', () => {
  assert.equal(tableStatusUpdateBody.safeParse({ status: 'RESERVED' }).success, true);
  assert.equal(tableStatusUpdateBody.safeParse({ status: 'AVAILABLE' }).success, true);
  assert.equal(tableStatusUpdateBody.safeParse({ status: 'OCCUPIED' }).success, false);
});
