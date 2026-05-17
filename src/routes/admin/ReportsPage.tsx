import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  getDailyRevenue,
  getPaymentMethods,
  getProductSales,
  getReportSummary,
  getTablePerformance,
  type DailyRevenueDto,
  type PaymentMethodDto,
  type ProductSalesDto,
  type ReportSummaryDto,
  type TablePerformanceDto,
} from '../../api/admin-reports';
import { formatMoney } from '../../functions/currency';

type Preset = 'today' | 'yesterday' | '7days' | '30days' | 'custom';

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function rangeForPreset(preset: Preset) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  }

  if (preset === '7days') start.setDate(start.getDate() - 6);
  if (preset === '30days') start.setDate(start.getDate() - 29);

  return { from: toInputDate(start), to: toInputDate(end) };
}

function toApiRange(from: string, to: string) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function ReportsPage() {
  const initialRange = useMemo(() => rangeForPreset('today'), []);
  const [preset, setPreset] = useState<Preset>('today');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [summary, setSummary] = useState<ReportSummaryDto | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenueDto[]>([]);
  const [productSales, setProductSales] = useState<ProductSalesDto[]>([]);
  const [tablePerformance, setTablePerformance] = useState<TablePerformanceDto[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = async (rangeFrom = from, rangeTo = to) => {
    setLoading(true);
    setError(null);
    try {
      const range = toApiRange(rangeFrom, rangeTo);
      const [summaryData, dailyData, productsData, tablesData, methodsData] = await Promise.all([
        getReportSummary(range),
        getDailyRevenue(range),
        getProductSales(range),
        getTablePerformance(range),
        getPaymentMethods(range),
      ]);
      setSummary(summaryData);
      setDailyRevenue(dailyData);
      setProductSales(productsData);
      setTablePerformance(tablesData);
      setPaymentMethods(methodsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Raporlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const selectPreset = (nextPreset: Preset) => {
    setPreset(nextPreset);
    if (nextPreset === 'custom') return;
    const nextRange = rangeForPreset(nextPreset);
    setFrom(nextRange.from);
    setTo(nextRange.to);
    void loadReports(nextRange.from, nextRange.to);
  };

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Raporlar</h1>
          <p className="text-sm text-slate-500">Ciro, ürün satışları, masa performansı ve ödeme türleri</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Dashboard</Link>
          <Link to="/admin/table-actions" className="rounded-xl border px-3 py-2 text-sm font-medium">Masa İstekleri</Link>
        </div>
      </div>

      <section className="mb-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap gap-2">
          {([
            ['today', 'Bugün'],
            ['yesterday', 'Dün'],
            ['7days', 'Son 7 Gün'],
            ['30days', 'Son 30 Gün'],
            ['custom', 'Özel Aralık'],
          ] as Array<[Preset, string]>).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => selectPreset(key)}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${preset === key ? 'bg-black text-white' : 'border bg-white text-slate-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setPreset('custom');
              setFrom(e.target.value);
            }}
            className="rounded-xl border px-3 py-2"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setPreset('custom');
              setTo(e.target.value);
            }}
            className="rounded-xl border px-3 py-2"
          />
          <button type="button" onClick={() => void loadReports()} className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
            Raporu Getir
          </button>
        </div>
      </section>

      {error ? <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? <p className="mb-4 text-sm text-slate-500">Raporlar yükleniyor...</p> : null}

      <section className="grid gap-4 md:grid-cols-5">
        <Stat label="Toplam Ciro" value={formatMoney(summary?.totalRevenue ?? 0)} />
        <Stat label="Ödeme Sayısı" value={String(summary?.paymentCount ?? 0)} />
        <Stat label="Ortalama Adisyon" value={formatMoney(summary?.averageCheck ?? 0)} />
        <Stat label="İndirim" value={formatMoney(summary?.discountTotal ?? 0)} />
        <Stat label="Servis" value={formatMoney(summary?.serviceFeeTotal ?? 0)} />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReportTable title="Günlük Ciro" empty="Bu aralıkta ciro yok.">
          {dailyRevenue.map((row) => (
            <TableRow key={row.date} cells={[row.date, String(row.paymentCount), formatMoney(row.totalRevenue)]} />
          ))}
        </ReportTable>

        <ReportTable title="Ödeme Türleri" empty="Bu aralıkta ödeme yok.">
          {paymentMethods.map((row) => (
            <TableRow key={row.label} cells={[row.label, String(row.count), formatMoney(row.total)]} />
          ))}
        </ReportTable>

        <ReportTable title="Ürün Satışları" empty="Bu aralıkta ürün satışı yok.">
          {productSales.map((row) => (
            <TableRow key={`${row.menuItemId ?? row.name}`} cells={[row.name, String(row.quantity), formatMoney(row.revenue)]} />
          ))}
        </ReportTable>

        <ReportTable title="Masa Performansı" empty="Bu aralıkta masa performansı yok.">
          {tablePerformance.map((row) => (
            <TableRow
              key={row.tableId}
              cells={[
                `Masa ${row.tableCode}${row.tableName ? ` - ${row.tableName}` : ''}`,
                `${row.sessionCount} adisyon`,
                formatMoney(row.revenue),
                formatMoney(row.averageCheck),
              ]}
            />
          ))}
        </ReportTable>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function ReportTable({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : children;
  const isEmpty = Array.isArray(rows) ? rows.length === 0 : !rows;

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4 overflow-x-auto">
        {isEmpty ? <p className="text-sm text-slate-500">{empty}</p> : <div className="min-w-full divide-y divide-slate-100">{children}</div>}
      </div>
    </section>
  );
}

function TableRow({ cells }: { cells: string[] }) {
  return (
    <div className="grid gap-2 py-3 text-sm md:grid-cols-4">
      {cells.map((cell, index) => (
        <span key={`${cell}-${index}`} className={index === 0 ? 'font-medium text-slate-900' : 'text-slate-600'}>{cell}</span>
      ))}
    </div>
  );
}
