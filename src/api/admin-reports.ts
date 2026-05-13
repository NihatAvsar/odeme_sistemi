import { fetchJSON } from './client';
import { getAdminSecret } from './admin-auth';

export type ReportRange = { from: string; to: string };

export type ReportSummaryDto = {
  from: string;
  to: string;
  totalRevenue: number;
  paymentCount: number;
  orderCount: number;
  averageCheck: number;
  discountTotal: number;
  serviceFeeTotal: number;
};

export type DailyRevenueDto = {
  date: string;
  totalRevenue: number;
  paymentCount: number;
};

export type ProductSalesDto = {
  menuItemId?: string | null;
  name: string;
  quantity: number;
  revenue: number;
};

export type TablePerformanceDto = {
  tableId: string;
  tableCode: string;
  tableName?: string | null;
  sessionCount: number;
  paymentCount: number;
  revenue: number;
  averageCheck: number;
};

export type PaymentMethodDto = {
  provider: string;
  type: string;
  label: string;
  count: number;
  total: number;
};

function buildQuery(range: ReportRange) {
  return `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
}

function adminHeaders() {
  return { 'x-admin-secret': getAdminSecret() };
}

export async function getReportSummary(range: ReportRange) {
  return fetchJSON<ReportSummaryDto>(`/api/admin/reports/summary${buildQuery(range)}`, { headers: adminHeaders() });
}

export async function getDailyRevenue(range: ReportRange) {
  return fetchJSON<DailyRevenueDto[]>(`/api/admin/reports/daily-revenue${buildQuery(range)}`, { headers: adminHeaders() });
}

export async function getProductSales(range: ReportRange) {
  return fetchJSON<ProductSalesDto[]>(`/api/admin/reports/product-sales${buildQuery(range)}`, { headers: adminHeaders() });
}

export async function getTablePerformance(range: ReportRange) {
  return fetchJSON<TablePerformanceDto[]>(`/api/admin/reports/table-performance${buildQuery(range)}`, { headers: adminHeaders() });
}

export async function getPaymentMethods(range: ReportRange) {
  return fetchJSON<PaymentMethodDto[]>(`/api/admin/reports/payment-methods${buildQuery(range)}`, { headers: adminHeaders() });
}
