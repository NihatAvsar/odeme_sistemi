// src/routes/payments/PaymentSuccessPage.tsx
import { Link, useLocation } from 'react-router-dom';

export function PaymentSuccessPage() {
  const location = useLocation();
  const tableId = (location.state as { tableId?: string } | null)?.tableId;

  return (
    <main className="mx-auto flex min-h-full max-w-2xl items-center p-4 md:p-8">
      <section className="w-full rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Ödeme Başarılı</h1>
        <p className="mt-2 text-sm text-slate-600">
          Mock POS işlemi tamamlandı ve diğer ekranlara güncelleme gönderildi.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            to={tableId ? `/table/${tableId}` : '/'}
            className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium"
          >
            Masaya Dön
          </Link>
          <Link
            to="/checkout"
            className="flex-1 rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white"
          >
            Yeni Ödeme
          </Link>
        </div>
      </section>
    </main>
  );
}
