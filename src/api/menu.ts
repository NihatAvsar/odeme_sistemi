import { fetchJSON } from './client';

export type MenuItemDto = {
  id: string;
  name: string;
  description?: string | null;
  price: string | number;
  currency: string;
  imageUrl?: string | null;
};

export type MenuCategoryDto = {
  id: string;
  name: string;
  items: MenuItemDto[];
};

export type MenuResponseDto = {
  table: { id: string; name?: string | null; code: string };
  categories: MenuCategoryDto[];
};

export async function getMenu(tableId: string) {
  return fetchJSON<MenuResponseDto>(`/api/menu/${tableId}`);
}
