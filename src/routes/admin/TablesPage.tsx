// src/routes/admin/TablesPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TableQrCard } from '../../components/qr/TableQrCard';
import { createAdminTables, getAdminTables, updateAdminTableStatus, type AdminTableDto } from '../../api/admin';
import { requireAdminSecret } from '../../api/admin-auth';
import { downloadCanvasPng, getTableQrUrl } from '../../functions/qr';
import { adminButtonClass, adminCardClass, adminPageClass, adminSecondaryButtonClass, adminSectionClass, adminStatCardClass, getAdminSummaryToneClasses } from './admin-theme';
import { getTableStatusLabel, getTableStatusStyles } from './table-status';

export function TablesPage() {
  const [tables, setTables] = useState<AdminTableDto[]>([]);
  const [createdTables, setCreatedTables] = useState<Array<{ id: string; code: string; name: string | null; qrToken: string }>>([]);
  const [count, setCount] = useState('1');
  const [startCode, setStartCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [visibleQrTableId, setVisibleQrTableId] = useState<string | null>(null);
  const [printTables, setPrintTables] = useState<AdminTableDto[]>([]);
  const [updatingTableId, setUpdatingTableId] = useState<string | null>(null);

  useEffect(() => {
    requireAdminSecret();
    void getAdminTables().then(setTables);
  }, []);

  const sortedTables = useMemo(() => {
    const order = { PENDING_APPROVAL: 0, OCCUPIED: 1, CLEANING: 2, RESERVED: 3, AVAILABLE: 4, DISABLED: 5 } as const;
    return [...tables].sort((a, b) => {
      const aRank = order[a.status as keyof typeof order] ?? 99;
      const bRank = order[b.status as keyof typeof order] ?? 99;
      if (aRank !== bRank) return aRank - bRank;
      return Number(a.code) - Number(b.code);
    });
  }, [tables]);

  const summary = useMemo(() => {
    const occupied = tables.filter((table) => table.status === 'OCCUPIED').length;
    const pending = tables.filter((table) => table.status === 'PENDING_APPROVAL').length;
    const cleaning = tables.filter((table) => table.status === 'CLEANING').length;
    const available = tables.filter((table) => table.status === 'AVAILABLE').length;
    const reserved = tables.filter((table) => table.status === 'RESERVED').length;

    return { total: tables.length, occupied, pending, cleaning, available, reserved };
  }, [tables]);

  useEffect(() => {
    if (printTables.length === 0) return;

    const timeout = window.setTimeout(() => window.print(), 100);
    const afterPrint = () => setPrintTables([]);
    window.addEventListener('afterprint', afterPrint);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('afterprint', afterPrint);
    };
  }, [printTables]);

  const downloadQr = (table: AdminTableDto) => {
    const canvas = document.getElementById(`qr-download-${table.id}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    downloadCanvasPng(canvas, `masa-${table.code}-qr.png`);
  };

  const updateTableStatus = async (table: AdminTableDto, status: 'AVAILABLE' | 'RESERVED') => {
    setUpdatingTableId(table.id);
    try {
      await updateAdminTableStatus(table.id, status);
      await getAdminTables().then(setTables);
    } finally {
      setUpdatingTableId(null);
    }
  };

  return (
    <main className={adminPageClass}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-700">Admin / Masalar</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Restoran Masaları</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Dolu masalar üstte, boş masalar altta; durumlar renk ile hızlıca ayrılır.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/menu" className={adminSecondaryButtonClass}>Menü</Link>
          <Link to="/admin/dashboard" className={adminSecondaryButtonClass}>Dashboard</Link>
          <button type="button" onClick={() => setPrintTables(sortedTables)} className={adminButtonClass}>
            Tüm QR Kodları Yazdır
          </button>
        </div>
      </div>

      <div className="hidden">
        {sortedTables.map((table) => (
          <TableQrCard
            key={table.id}
            tableCode={table.code}
            tableName={table.name}
            url={getTableQrUrl(table.code)}
            canvasId={`qr-download-${table.id}`}
          />
        ))}
      </div>

      <div className="qr-print-area hidden">
        {printTables.map((table) => (
          <TableQrCard key={table.id} tableCode={table.code} tableName={table.name} url={getTableQrUrl(table.code)} />
        ))}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Toplam Masa" value={summary.total} tone="brand" />
        <StatCard label="Müşteri Var" value={summary.occupied} tone="sky" />
        <StatCard label="Bekleyen Sipariş" value={summary.pending} tone="amber" />
        <StatCard label="Temizleniyor" value={summary.cleaning} tone="violet" />
        <StatCard label="Müşteri Yok" value={summary.available} tone="rose" />
        <StatCard label="Rezerve" value={summary.reserved} tone="amber" />
      </section>

      <section className={adminSectionClass}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm text-slate-700">
            Masa sayısı
            <input value={count} onChange={(e) => setCount(e.target.value)} className="mt-1 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </label>
          <label className="flex flex-col text-sm text-slate-700">
            Başlangıç kodu
            <input value={startCode} onChange={(e) => setStartCode(e.target.value)} className="mt-1 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200" />
          </label>
          <button
            type="button"
            disabled={creating}
            onClick={async () => {
              setCreating(true);
              const result = await createAdminTables({
                count: Number(count) || 1,
                startCode: startCode ? Number(startCode) : undefined,
                namePrefix: 'Masa',
                capacity: 4,
              });
              setCreatedTables(result.tables);
              await getAdminTables().then(setTables);
              setCreating(false);
            }}
            className={adminButtonClass}
          >
            {creating ? 'Oluşturuluyor...' : 'Masaları Çoğalt'}
          </button>
        </div>
      </section>

      {createdTables.length > 0 ? (
        <div className="rounded-3xl border border-emerald-200/70 bg-emerald-50/80 p-4 text-sm text-emerald-900 shadow-sm ring-1 ring-emerald-100/80 backdrop-blur-md">
          Oluşturulan masalar: {createdTables.map((table) => table.code).join(', ')}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedTables.map((table) => (
          <div key={table.id} className={`${adminCardClass} ${getTableStatusStyles(table.status).card}`}>
            <Link to={`/admin/tables/${table.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">Masa</p>
                  <p className="mt-1 text-2xl font-semibold">{table.code}</p>
                  <p className="mt-1 text-sm text-slate-600">{table.name ?? 'İsimsiz'}</p>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getTableStatusStyles(table.status).badge}`}>
                  {getTableStatusLabel(table.status)}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>Durum</span>
                <span>{table.status}</span>
              </div>
            </Link>
            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(getTableQrUrl(table.code));
                }}
                className={adminSecondaryButtonClass}
              >
                QR Adresi Kopyala
              </button>
              <button type="button" onClick={() => setVisibleQrTableId((current) => (current === table.id ? null : table.id))} className={adminSecondaryButtonClass}>
                QR Görüntüle
              </button>
              <button type="button" onClick={() => downloadQr(table)} className={adminSecondaryButtonClass}>
                QR İndir
              </button>
              <button type="button" onClick={() => setPrintTables([table])} className={adminSecondaryButtonClass}>
                QR Yazdır
              </button>
              <Link to={`/table/${table.code}`} className={adminSecondaryButtonClass}>
                Müşteri Ekranı
              </Link>
              {table.status === 'AVAILABLE' ? (
                <button type="button" disabled={updatingTableId === table.id} onClick={() => void updateTableStatus(table, 'RESERVED')} className={adminSecondaryButtonClass}>
                  {updatingTableId === table.id ? 'İşleniyor...' : 'Rezerve Et'}
                </button>
              ) : null}
              {table.status === 'RESERVED' ? (
                <button type="button" disabled={updatingTableId === table.id} onClick={() => void updateTableStatus(table, 'AVAILABLE')} className={adminSecondaryButtonClass}>
                  {updatingTableId === table.id ? 'İşleniyor...' : 'Rezervasyonu Aç'}
                </button>
              ) : null}
            </div>
            {visibleQrTableId === table.id ? (
              <div className="mt-5">
                <TableQrCard tableCode={table.code} tableName={table.name} url={getTableQrUrl(table.code)} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'brand' | 'sky' | 'violet' | 'rose' | 'amber' }) {
  const toneClasses = getAdminSummaryToneClasses(tone);

  return (
    <div className={`${adminStatCardClass} ${toneClasses.card}`}>
      <div className={`h-1 w-14 rounded-full ${toneClasses.accent}`} />
      <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className={`mt-3 text-3xl font-semibold tracking-tight ${toneClasses.value}`}>{value}</p>
    </div>
  );
}
