import { fetchJSON } from './client';

export type CouponValidationDto = {
  valid: boolean;
  reason: string | null;
  discount: number;
  code?: string | null;
  discountType?: 'PERCENT' | 'FIXED';
};

export async function validateCoupon(input: { tableCode: string; subtotal: number; couponCode: string }) {
  return fetchJSON<CouponValidationDto>('/api/promotions/validate', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
