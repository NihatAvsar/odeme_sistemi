// src/routes/admin/TablesPage.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminTables, type AdminTableDto } from '../../api/admin';

export function TablesPage() {
  const [tables, setTables] = useState<AdminTableDto[]>([]);

  useEffect(() => {
    void getAdminTables().then(setTables);
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Masalar</h1>
        <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Dashboard</Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tables.map((table) => (
          <Link key={table.id} to={`/admin/tables/${table.id}`} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
            <p className="font-medium">Masa {table.code}</p>
            <p className="text-sm text-slate-500">{table.name ?? 'İsimsiz'}</p>
            <p className="mt-3 text-sm">Durum: {table.status}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
