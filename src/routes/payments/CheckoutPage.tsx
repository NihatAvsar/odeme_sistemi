// src/routes/payments/CheckoutPage.tsx
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { confirmPayment, initiatePayment } from '../../api/payments';
import { formatMoney } from '../../functions/currency';
import type { SelectedItem } from '../../types/billing';

const tipOptions = [5, 10, 15];

type CheckoutState = {
  orderId: string;
  tableId: string;
  splitType: 'ITEM_SPLIT' | 'FULL_BILL' | 'AMOUNT_SPLIT' | 'TIP_ONLY';
  selectedItems: SelectedItem[];
  subtotal: number;
};

export function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tipEnabled, setTipEnabled] = useState(false);
  const [tipPercent, setTipPercent] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkoutState = (location.state ?? null) as CheckoutState | null;
  const subtotal = checkoutState?.subtotal ?? 0;
  const hasValidContext = Boolean(checkoutState?.orderId) && subtotal > 0;

  const tipAmount = useMemo(() => {
    if (!tipEnabled) return 0;
    if (customTip.trim()) return Number(customTip) || 0;
    if (tipPercent == null) return 0;
    return (subtotal * tipPercent) / 100;
  }, [customTip, subtotal, tipEnabled, tipPercent]);

  const handleCompletePayment = async () => {
    if (!checkoutState?.orderId) {
      setError('Siparis bilgisi bulunamadi. Lutfen masaya geri donup tekrar deneyin.');
      return;
    }

    if (subtotal <= 0) {
      setError('Odenecek tutar gecersiz. Lutfen kalem secimini kontrol edin.');
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      const initiated = await initiatePayment({
        orderId: checkoutState.orderId,
        type: checkoutState.splitType,
        amount: subtotal,
        tipAmount,
        payerName: 'Demo Kullanıcı',
        idempotencyKey: crypto.randomUUID(),
        metadata: {
          tableId: checkoutState.tableId,
          selectedItems: checkoutState.selectedItems,
        },
      });

      if (initiated.intent.redirectUrl) {
        window.location.href = initiated.intent.redirectUrl;
        return;
      }

      await confirmPayment({
        paymentId: initiated.payment.id,
        providerRef: initiated.intent.providerRef,
      });

      navigate('/checkout/success', { state: { tableId: checkoutState.tableId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Odeme su an tamamlanamadi. Lutfen tekrar deneyin.';
      setError(message);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <main className="mx-auto min-h-full max-w-2xl p-3 pb-28 md:p-8">
      <section className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="bg-gradient-to-br from-slate-950 to-brand-700 p-5 text-white md:p-6">
          <button
            type="button"
            onClick={() => navigate(checkoutState?.tableId ? `/table/${checkoutState.tableId}` : '/')}
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white/80 ring-1 ring-white/20"
          >
            <span aria-hidden="true">←</span>
            Masaya Dön
          </button>

          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Güvenli Ödeme</p>
          <h1 className="mt-2 text-3xl font-semibold">Ödeme</h1>
          <p className="mt-2 text-sm text-white/70">Seçtiğiniz kalemleri kontrol edin ve ödemeyi tamamlayın.</p>
        </div>

        <div className="p-5 md:p-6">
        {!hasValidContext ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bu ekran dogrudan acildigi icin odeme baglami eksik. Lutfen masa ekranindan kalem secip gelin.
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-sm text-white/60">Ödenecek tutar</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight">{formatMoney(subtotal + tipAmount)}</p>
            <p className="mt-2 text-xs text-white/50">Ara toplam: {formatMoney(subtotal)}</p>
          </div>

          <div className="rounded-3xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Bahşiş</p>
              <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={tipEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setTipEnabled(enabled);
                    if (!enabled) {
                      setTipPercent(null);
                      setCustomTip('');
                    }
                  }}
                />
                İsteğe bağlı
              </label>
            </div>

            <div className={`space-y-3 ${tipEnabled ? 'opacity-100' : 'pointer-events-none opacity-50'}`}>
              <div className="grid grid-cols-3 gap-2">
                {tipOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setCustomTip('');
                      setTipEnabled(true);
                      setTipPercent(option);
                    }}
                    className={`min-h-12 rounded-xl border px-4 py-2 text-sm font-medium ${tipPercent === option && !customTip ? 'border-slate-900 bg-slate-900 text-white' : 'bg-white'}`}
                  >
                    %{option}
                  </button>
                ))}
              </div>
              <input
                value={customTip}
                onChange={(e) => {
                  setTipEnabled(true);
                  setCustomTip(e.target.value);
                }}
                placeholder="Serbest tutar"
                className="min-h-12 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
            <span className="font-medium">Toplam</span>
            <span className="text-lg font-semibold">{formatMoney(subtotal + tipAmount)}</span>
          </div>

          {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

          <button
            type="button"
            onClick={() => void handleCompletePayment()}
            disabled={isPaying || !hasValidContext}
            className="hidden min-h-14 w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 md:block"
          >
            {isPaying ? 'Ödeme tamamlanıyor...' : 'Ödemeyi Tamamla'}
          </button>
        </div>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Toplam</p>
            <p className="text-lg font-semibold text-slate-950">{formatMoney(subtotal + tipAmount)}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleCompletePayment()}
            disabled={isPaying || !hasValidContext}
            className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPaying ? 'Tamamlanıyor...' : 'Öde'}
          </button>
        </div>
      </div>
    </main>
  );
}
