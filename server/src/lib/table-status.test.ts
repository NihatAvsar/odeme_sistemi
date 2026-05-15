import assert from 'node:assert/strict';
import test from 'node:test';
import { getEffectiveTableStatus } from './table-status.js';

test('open session without order or request is available', () => {
  assert.equal(getEffectiveTableStatus({ status: 'OCCUPIED', sessions: [{ orders: [], requests: [] }] }), 'AVAILABLE');
});

test('pending order request makes table occupied', () => {
  assert.equal(getEffectiveTableStatus({ status: 'AVAILABLE', sessions: [{ orders: [], requests: [{ status: 'PENDING_APPROVAL' }] }] }), 'PENDING_APPROVAL');
});

test('open unpaid order makes table occupied', () => {
  assert.equal(getEffectiveTableStatus({ status: 'AVAILABLE', sessions: [{ orders: [{ status: 'OPEN', remaining: '42.50' }], requests: [] }] }), 'OCCUPIED');
});

test('cleaning status is preserved', () => {
  assert.equal(getEffectiveTableStatus({ status: 'CLEANING', sessions: [{ orders: [], requests: [] }] }), 'CLEANING');
});

test('reserved status is preserved', () => {
  assert.equal(getEffectiveTableStatus({ status: 'RESERVED', sessions: [{ orders: [], requests: [] }] }), 'RESERVED');
});
