export type BillItem = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  paidQuantity?: number;
};

export type SelectedItem = {
  id: string;
  quantity: number;
};

export type OrderTotals = {
  subtotal: number;
  discount: number;
  serviceFee: number;
  tax: number;
  total: number;
};
