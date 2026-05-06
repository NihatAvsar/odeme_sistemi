// src/routes/admin/TablesPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createAdminTables, getAdminTables, type AdminTableDto } from '../../api/admin';
import { requireAdminSecret } from '../../api/admin-auth';
import { getTableStatusLabel, getTableStatusStyles } from './table-status';

export function TablesPage() {
  const [tables, setTables] = useState<AdminTableDto[]>([]);
  const [createdTables, setCreatedTables] = useState<Array<{ id: string; code: string; name: string | null; qrToken: string }>>([]);
  const [count, setCount] = useState('1');
  const [startCode, setStartCode] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    requireAdminSecret();
    void getAdminTables().then(setTables);
  }, []);

  const sortedTables = useMemo(() => {
    return [...tables].sort((a, b) => {
      if (a.status === 'OCCUPIED' && b.status !== 'OCCUPIED') return -1;
      if (a.status !== 'OCCUPIED' && b.status === 'OCCUPIED') return 1;
      return Number(a.code) - Number(b.code);
    });
  }, [tables]);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Masalar</h1>
        <div className="flex gap-2">
          <Link to="/admin/menu" className="rounded-xl border px-3 py-2 text-sm font-medium">Menü</Link>
          <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Dashboard</Link>
        </div>
      </div>

      <div className="mb-6 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-sm">
            Masa sayısı
            <input value={count} onChange={(e) => setCount(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
          </label>
          <label className="flex flex-col text-sm">
            Başlangıç kodu
            <input value={startCode} onChange={(e) => setStartCode(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
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
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? 'Oluşturuluyor...' : 'Masaları Çoğalt'}
          </button>
        </div>
      </div>

      {createdTables.length > 0 ? (
        <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Oluşturulan masalar: {createdTables.map((table) => table.code).join(', ')}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedTables.map((table) => (
          <div key={table.id} className={`rounded-3xl p-4 shadow-sm ring-1 ${getTableStatusStyles(table.status).card}`}>
            <Link to={`/admin/tables/${table.id}`} className="block hover:bg-slate-50">
              <p className="font-medium">Masa {table.code}</p>
              <p className="text-sm text-slate-500">{table.name ?? 'İsimsiz'}</p>
              <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-medium ${getTableStatusStyles(table.status).badge}`}>
                {getTableStatusLabel(table.status)}
              </span>
            </Link>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}/table/${table.code}`);
                }}
                className="rounded-xl border px-3 py-2 font-medium"
              >
                QR Adresi Kopyala
              </button>
              <Link to={`/table/${table.code}`} className="rounded-xl border px-3 py-2 font-medium">
                Müşteri Ekranı
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
