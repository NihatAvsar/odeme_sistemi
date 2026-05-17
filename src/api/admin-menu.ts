import { fetchJSON } from './client';
import { getAdminSecret } from './admin-auth';

export type AdminMenuItemDto = {
  id: string;
  restaurantId: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  price: string | number;
  currency: string;
  isActive: boolean;
  isOutOfStock: boolean;
  updatedBy?: string | null;
  optionGroups?: AdminMenuOptionGroupDto[];
};

export type AdminMenuOptionGroupDto = {
  id?: string;
  name: string;
  type: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder?: number;
  isActive?: boolean;
  options: Array<{ id?: string; name: string; priceDelta: number | string; isDefault?: boolean; isActive?: boolean; sortOrder?: number }>;
};

export type AdminMenuCategoryDto = {
  id: string;
  name: string;
  restaurantId: string;
};

export async function getAdminMenu() {
  return fetchJSON<AdminMenuItemDto[]>('/api/admin/menu', {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function getAdminMenuCategories() {
  return fetchJSON<AdminMenuCategoryDto[]>('/api/admin/menu/categories', {
    headers: { 'x-admin-secret': getAdminSecret() },
  });
}

export async function createAdminMenuItem(input: Partial<AdminMenuItemDto> & { restaurantId?: string; name: string; price: number }) {
  return fetchJSON<AdminMenuItemDto>('/api/admin/menu', {
    method: 'POST',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify(input),
  });
}

export async function updateAdminMenuItem(itemId: string, input: Partial<AdminMenuItemDto>) {
  return fetchJSON<AdminMenuItemDto>(`/api/admin/menu/${itemId}`, {
    method: 'PATCH',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify(input),
  });
}

export async function updateAdminMenuStock(itemId: string, isOutOfStock: boolean, updatedBy?: string) {
  return fetchJSON<AdminMenuItemDto>(`/api/admin/menu/${itemId}/stock`, {
    method: 'PATCH',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify({ isOutOfStock, updatedBy }),
  });
}

export async function deleteAdminMenuItem(itemId: string, updatedBy?: string) {
  return fetchJSON<AdminMenuItemDto>(`/api/admin/menu/${itemId}`, {
    method: 'DELETE',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify({ updatedBy }),
  });
}

export async function updateAdminMenuOptions(itemId: string, groups: AdminMenuOptionGroupDto[]) {
  return fetchJSON<AdminMenuItemDto>(`/api/admin/menu/${itemId}/options`, {
    method: 'PUT',
    headers: { 'x-admin-secret': getAdminSecret() },
    body: JSON.stringify({ groups }),
  });
}
