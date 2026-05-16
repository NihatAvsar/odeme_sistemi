import { fetchJSON } from './client';

export type PaymentType = 'FULL_BILL' | 'ITEM_SPLIT' | 'AMOUNT_SPLIT' | 'TIP_ONLY';

export type PaymentInitiateInput = {
  orderId: string;
  type: PaymentType;
  amount: number;
  tipAmount?: number;
  payerName?: string;
  payerCount?: number;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
};

export type PaymentConfirmInput = {
  paymentId: string;
  providerRef?: string;
};

export async function initiatePayment(input: PaymentInitiateInput) {
  return fetchJSON<{ payment: { id: string }; intent: { providerRef: string; status: string; redirectUrl?: string } }>(
    '/api/payments/initiate',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function confirmPayment(input: PaymentConfirmInput) {
  return fetchJSON('/api/payments/confirm', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
