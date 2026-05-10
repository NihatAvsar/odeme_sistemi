import { fetchJSON } from './client';

export type MenuItemDto = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  currency: string;
  imageUrl?: string | null;
  isActive: boolean;
  isOutOfStock: boolean;
  optionGroups?: Array<{
    id: string;
    name: string;
    type: 'SINGLE' | 'MULTIPLE';
    isRequired: boolean;
    minSelect: number;
    maxSelect: number;
    options: Array<{ id: string; name: string; priceDelta: string | number; isDefault: boolean }>;
  }>;
};

export type MenuCategoryDto = {
  id: string;
  name: string;
  items: MenuItemDto[];
};

export type MenuResponseDto = {
  table: { id: string; restaurantId: string; name?: string | null; code: string };
  categories: MenuCategoryDto[];
};

export async function getMenu(tableId: string) {
  return fetchJSON<MenuResponseDto>(`/api/menu/${tableId}`);
}
