export function tableRoom(tableId: string) {
  return `table:${tableId}`;
}

export function orderRoom(orderId: string) {
  return `order:${orderId}`;
}

export function paymentUpdatedEvent() {
  return 'payment:updated';
}
