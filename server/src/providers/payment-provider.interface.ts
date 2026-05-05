import type { PaymentInitiateInput, PaymentProviderIntent } from '../types/payment';

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(input: PaymentInitiateInput): Promise<PaymentProviderIntent>;
  confirmPayment(providerRef: string): Promise<{ providerRef: string; status: 'SUCCESS' | 'FAILED' }>;
  cancelPayment(providerRef: string): Promise<void>;
  refundPayment(providerRef: string, amount: number): Promise<void>;
  verifyWebhook?(payload: string, signature?: string): boolean;
}
