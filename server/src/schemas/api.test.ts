import assert from 'node:assert/strict';
import test from 'node:test';
import { orderRequestCreateBody, tableStatusUpdateBody } from './api.js';

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
