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
  const [tipPercent, setTipPercent] = useState(10);
  const [customTip, setCustomTip] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkoutState = (location.state ?? null) as CheckoutState | null;
  const subtotal = checkoutState?.subtotal ?? 0;
  const hasValidContext = Boolean(checkoutState?.orderId) && subtotal > 0;

  const tipAmount = useMemo(() => {
    if (customTip.trim()) return Number(customTip) || 0;
    return (subtotal * tipPercent) / 100;
  }, [customTip, subtotal, tipPercent]);

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
        provider: 'mock-stripe',
        metadata: {
          tableId: checkoutState.tableId,
          selectedItems: checkoutState.selectedItems,
        },
      });

      await confirmPayment({
        paymentId: initiated.payment.id,
        providerRef: initiated.intent.providerRef,
      });

      navigate('/checkout/success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Odeme su an tamamlanamadi. Lutfen tekrar deneyin.';
      setError(message);
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <main className="mx-auto min-h-full max-w-2xl p-4 md:p-8">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          <span aria-hidden="true">←</span>
          Geri Git
        </button>

        <h1 className="text-2xl font-semibold">Ödeme</h1>
        <p className="mt-2 text-sm text-slate-600">Mock POS entegrasyonu ekranı.</p>

        {!hasValidContext ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Bu ekran dogrudan acildigi icin odeme baglami eksik. Lutfen masa ekranindan kalem secip gelin.
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-600">Ara Toplam</p>
            <p className="text-xl font-semibold">{formatMoney(subtotal)}</p>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium">Bahşiş</p>
            <div className="flex gap-2">
              {tipOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setCustomTip('');
                    setTipPercent(option);
                  }}
                  className="rounded-xl border px-4 py-2 text-sm font-medium"
                >
                  %{option}
                </button>
              ))}
            </div>
            <input
              value={customTip}
              onChange={(e) => setCustomTip(e.target.value)}
              placeholder="Serbest tutar"
              className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none"
            />
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="font-medium">Toplam</span>
            <span className="text-lg font-semibold">{formatMoney(subtotal + tipAmount)}</span>
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="button"
            onClick={() => void handleCompletePayment()}
            disabled={isPaying || !hasValidContext}
            className="w-full rounded-2xl bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPaying ? 'Ödeme tamamlanıyor...' : 'Mock Ödemeyi Tamamla'}
          </button>
        </div>
      </section>
    </main>
  );
}
