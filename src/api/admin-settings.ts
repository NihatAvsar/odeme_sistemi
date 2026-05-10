import { fetchJSON } from './client';
import { getAdminSecret } from './admin-auth';

export type RestaurantSettingsDto = {
  id: string;
  restaurantId: string;
  serviceFeeType: 'PERCENT' | 'FIXED';
  serviceFeeValue: string | number;
  isServiceFeeEnabled: boolean;
};

export type PromotionDto = {
  id: string;
  name: string;
  code?: string | null;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: string | number;
  minOrderAmount: string | number;
  isActive: boolean;
};

export async function getAdminSettings() {
  return fetchJSON<RestaurantSettingsDto>('/api/admin/settings', {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function updateAdminSettings(input: Partial<RestaurantSettingsDto>) {
  return fetchJSON<RestaurantSettingsDto>('/api/admin/settings', {
    method: 'PATCH',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify(input),
  });
}

export async function getAdminPromotions() {
  return fetchJSON<PromotionDto[]>('/api/admin/promotions', {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function createAdminPromotion(input: Partial<PromotionDto> & { name: string; discountValue: number }) {
  return fetchJSON<PromotionDto>('/api/admin/promotions', {
    method: 'POST',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify(input),
  });
}

export async function updateAdminPromotion(id: string, input: Partial<PromotionDto>) {
  return fetchJSON<PromotionDto>(`/api/admin/promotions/${id}`, {
    method: 'PATCH',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify(input),
  });
}
