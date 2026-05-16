import { z } from 'zod';

const id = z.string().trim().min(1).max(128);
const emptyStringToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);
const optionalTrimmedString = (max: number, min = 0) => z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(min).max(max).optional(),
);
const optionalActor = optionalTrimmedString(120, 1);
const positiveMoney = z.coerce.number().positive().max(1_000_000);
const nonNegativeMoney = z.coerce.number().min(0).max(1_000_000);

export const params = {
  paymentId: z.object({ paymentId: id }).strict(),
  tableCode: z.object({ tableCode: id }).strict(),
  actionId: z.object({ actionId: id }).strict(),
  orderRequestId: z.object({ id }).strict(),
  orderItemId: z.object({ orderItemId: id }).strict(),
  tableId: z.object({ tableId: id }).strict(),
  promotionId: z.object({ promotionId: id }).strict(),
};

export const paymentInitiateBody = z.object({
  orderId: id,
  type: z.enum(['FULL_BILL', 'ITEM_SPLIT', 'AMOUNT_SPLIT', 'TIP_ONLY']),
  amount: positiveMoney,
  tipAmount: nonNegativeMoney.optional(),
  idempotencyKey: z.string().trim().min(8).max(180),
  payerName: z.string().trim().min(1).max(120).optional(),
  payerCount: z.coerce.number().int().positive().max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const paymentConfirmBody = z.object({
  paymentId: id,
  providerRef: z.string().trim().min(1).max(180).optional(),
}).strict();

export const orderRequestCreateBody = z.object({
  tableId: id,
  requestedBy: optionalActor,
  note: optionalTrimmedString(500),
  couponCode: optionalTrimmedString(64, 1),
  items: z.array(z.object({
    menuItemId: id,
    quantity: z.coerce.number().int().positive().max(99),
    optionIds: z.array(id).max(30).optional(),
  }).strict()).min(1).max(100),
}).strict();

export const orderRequestApproveBody = z.object({ adminName: optionalActor }).strict();
export const orderRequestRejectBody = z.object({ adminName: optionalActor, reason: z.string().trim().max(500).optional() }).strict();

export const tableActionCreateBody = z.object({
  type: z.enum(['CALL_WAITER', 'REQUEST_BILL', 'SEND_NOTE']),
  message: z.string().trim().max(500).optional(),
}).strict();

export const tableActionUpdateBody = z.object({
  status: z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED']),
  resolvedBy: optionalActor,
}).strict();

export const tableStatusUpdateBody = z.object({
  status: z.enum(['AVAILABLE', 'RESERVED']),
}).strict();

export const settingsUpdateBody = z.object({
  serviceFeeType: z.enum(['PERCENT', 'FIXED']).optional(),
  serviceFeeValue: nonNegativeMoney.optional(),
  isServiceFeeEnabled: z.boolean().optional(),
}).strict();

export const promotionCreateBody = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(64).optional(),
  discountType: z.enum(['PERCENT', 'FIXED']).optional(),
  discountValue: positiveMoney,
  minOrderAmount: nonNegativeMoney.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  usageLimit: z.coerce.number().int().positive().max(1_000_000).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const promotionUpdateBody = promotionCreateBody.partial().strict();

export const kitchenTicketUpdateBody = z.object({
  status: z.enum(['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED']),
}).strict();

export const promotionValidateBody = z.object({
  tableCode: id,
  subtotal: nonNegativeMoney.optional(),
  couponCode: z.string().trim().min(1).max(64),
}).strict();
