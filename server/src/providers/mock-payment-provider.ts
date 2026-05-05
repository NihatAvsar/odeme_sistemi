import type { PaymentInitiateInput, PaymentProviderIntent } from '../types/payment';
import type { PaymentProvider } from './payment-provider.interface';

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock-stripe';

  async createPaymentIntent(input: PaymentInitiateInput): Promise<PaymentProviderIntent> {
    return {
      providerRef: `mock_${input.orderId}_${Date.now()}`,
      status: 'PENDING',
      redirectUrl: `/checkout/success?payment=${input.idempotencyKey}`,
    };
  }

  async confirmPayment(providerRef: string) {
    return { providerRef, status: 'SUCCESS' as const };
  }

  async cancelPayment(_providerRef: string) {
    return;
  }

  async refundPayment(_providerRef: string, _amount: number) {
    return;
  }

  verifyWebhook(payload: string) {
    return payload.length > 0;
  }
}
