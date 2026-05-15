// src/routes/payments/PaymentSuccessPage.tsx
import { Link, useLocation } from 'react-router-dom';

export function PaymentSuccessPage() {
  const location = useLocation();
  const tableId = (location.state as { tableId?: string } | null)?.tableId;

  return (
    <main className="mx-auto flex min-h-full max-w-2xl items-center p-3 md:p-8">
      <section className="w-full overflow-hidden rounded-[2rem] bg-white text-center shadow-sm ring-1 ring-slate-200">
        <div className="bg-gradient-to-br from-emerald-500 to-slate-950 px-6 py-10 text-white">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 text-3xl ring-1 ring-white/25">
          ✓
        </div>
        <h1 className="mt-5 text-3xl font-semibold">Ödeme Başarılı</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-white/75">
          Ödemeniz alındı. Masa hesabı ve restoran ekranları güncellendi.
        </p>
        </div>

        <div className="p-5 md:p-6">
        <div className="rounded-3xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Masa tamamen ödendiyse kısa süre içinde temizleniyor durumuna geçer ve sonra boşa çıkar.
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            to={tableId ? `/table/${tableId}` : '/'}
            className="flex-1 rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white"
          >
            Masaya Dön
          </Link>
          <Link
            to={tableId ? `/menu/${tableId}` : '/'}
            className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800"
          >
            Menüye Dön
          </Link>
        </div>
        </div>
      </section>
    </main>
  );
}
