import { createHmac, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import type { PaymentInitiateInput, PaymentProviderIntent } from '../types/payment.js';
import type { PaymentProvider } from './payment-provider.interface.js';

type IyzicoResponse = {
  status?: string;
  errorMessage?: string;
  token?: string;
  paymentPageUrl?: string;
  checkoutFormContent?: string;
  paymentStatus?: string;
};

function formatAmount(amount: number) {
  return Number(amount).toFixed(2);
}

function isAllowedIyzicoRedirectUrl(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'iyzipay.com' || url.hostname.endsWith('.iyzipay.com'));
  } catch {
    return false;
  }
}

export class IyzicoPaymentProvider implements PaymentProvider {
  readonly name = 'iyzico';

  async createPaymentIntent(input: PaymentInitiateInput): Promise<PaymentProviderIntent> {
    const amount = formatAmount(Number(input.amount) + Number(input.tipAmount ?? 0));
    const conversationId = input.idempotencyKey;
    const payload = {
      locale: 'tr',
      conversationId,
      price: amount,
      paidPrice: amount,
      currency: 'TRY',
      basketId: input.orderId,
      paymentGroup: 'PRODUCT',
      callbackUrl: env.iyzicoCallbackUrl,
      buyer: {
        id: input.payerName ?? 'guest',
        name: input.payerName ?? 'Demo',
        surname: 'Kullanici',
        gsmNumber: '+905350000000',
        email: 'demo@example.com',
        identityNumber: '11111111111',
        registrationAddress: 'Demo adres',
        ip: '127.0.0.1',
        city: 'Istanbul',
        country: 'Turkey',
      },
      shippingAddress: {
        contactName: input.payerName ?? 'Demo Kullanici',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Demo adres',
      },
      billingAddress: {
        contactName: input.payerName ?? 'Demo Kullanici',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Demo adres',
      },
      basketItems: [
        {
          id: input.orderId,
          name: 'Masa odemesi',
          category1: 'Restaurant',
          itemType: 'VIRTUAL',
          price: amount,
        },
      ],
    };

    const result = await this.request<IyzicoResponse>('/payment/iyzipos/checkoutform/initialize/auth/ecom', payload);
    if (result.status !== 'success' || !result.token) {
      throw new Error(result.errorMessage ?? 'Iyzico odeme baslatilamadi');
    }

    if (!isAllowedIyzicoRedirectUrl(result.paymentPageUrl)) {
      throw new Error('Iyzico odeme yonlendirme adresi gecersiz');
    }

    return {
      providerRef: result.token,
      status: 'PENDING',
      redirectUrl: result.paymentPageUrl,
    };
  }

  async confirmPayment(providerRef: string) {
    const result = await this.request<IyzicoResponse>('/payment/iyzipos/checkoutform/auth/ecom/detail', {
      locale: 'tr',
      conversationId: providerRef,
      token: providerRef,
    });

    return {
      providerRef,
      status: result.status === 'success' && result.paymentStatus === 'SUCCESS' ? 'SUCCESS' as const : 'FAILED' as const,
    };
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

  private async request<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    if (!env.iyzicoApiKey || !env.iyzicoSecretKey) {
      throw new Error('Iyzico API bilgileri eksik');
    }

    const body = JSON.stringify(payload);
    const randomKey = `${Date.now()}${randomUUID()}`;
    const signature = createHmac('sha256', env.iyzicoSecretKey).update(randomKey + path + body).digest('hex');
    const authorization = Buffer.from(`apiKey:${env.iyzicoApiKey}&randomKey:${randomKey}&signature:${signature}`).toString('base64');

    const response = await fetch(`${env.iyzicoBaseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `IYZWSv2 ${authorization}`,
      },
      body,
    });

    const data = await response.json() as T & { errorMessage?: string };
    if (!response.ok) {
      throw new Error(data.errorMessage ?? `Iyzico istegi basarisiz: ${response.status}`);
    }

    return data;
  }
}
