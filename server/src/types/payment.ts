export type PaymentType = 'FULL_BILL' | 'ITEM_SPLIT' | 'AMOUNT_SPLIT' | 'TIP_ONLY';
export type PaymentStatus = 'INITIATED' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export type PaymentInitiateInput = {
  orderId: string;
  type: PaymentType;
  amount: number;
  tipAmount?: number;
  payerName?: string;
  payerCount?: number;
  idempotencyKey: string;
  provider?: 'mock-stripe' | 'mock-iyzico';
  metadata?: Record<string, unknown>;
};

export type PaymentConfirmInput = {
  paymentId: string;
  providerRef?: string;
};

export type PaymentProviderIntent = {
  providerRef: string;
  status: 'PENDING' | 'SUCCESS';
  redirectUrl?: string;
};
