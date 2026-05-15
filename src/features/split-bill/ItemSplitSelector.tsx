// src/features/split-bill/ItemSplitSelector.tsx
import { useMemo, useState } from 'react';
import { calculateSelectedAmount } from '../../functions/billing';
import { formatMoney } from '../../functions/currency';
import type { BillItem, SelectedItem } from '../../types/billing';

type Props = {
  items: BillItem[];
  onConfirm: (items: SelectedItem[]) => void | Promise<void>;
  loading?: boolean;
};

export function ItemSplitSelector({ items, onConfirm, loading = false }: Props) {
  const [selected, setSelected] = useState<Record<string, number>>({});

  const selectedItems = useMemo(
    () =>
      Object.entries(selected)
        .filter(([, quantity]) => quantity > 0)
        .map(([id, quantity]) => ({ id, quantity })),
    [selected],
  );

  const total = useMemo(() => calculateSelectedAmount(items, selectedItems), [items, selectedItems]);

  const changeQty = (item: BillItem, delta: number) => {
    const max = item.quantity - (item.paidQuantity ?? 0);

    setSelected((current) => {
      const next = Math.max(0, Math.min(max, (current[item.id] ?? 0) + delta));
      return { ...current, [item.id]: next };
    });
  };

  return (
    <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-slate-900">Kalem Bazlı Bölüşme</h2>
        <p className="mt-1 text-sm text-slate-500">Sadece yediklerini seç ve ödemeye geç.</p>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const selectedQty = selected[item.id] ?? 0;
          const remaining = item.quantity - (item.paidQuantity ?? 0);
          const paid = remaining === 0;

          return (
            <article key={item.id} className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{item.name}</p>
                  {paid ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Ödendi</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {formatMoney(item.unitPrice)} x {item.quantity}
                </p>
                <p className="text-xs text-slate-400">Kalan adet: {remaining}</p>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => changeQty(item, -1)}
                  disabled={selectedQty === 0 || paid}
                  className="h-12 w-12 rounded-full border border-slate-300 bg-white text-lg font-semibold shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  -
                </button>

                <span className="w-12 rounded-full bg-white px-3 py-2 text-center text-sm font-semibold shadow-sm ring-1 ring-slate-100">{selectedQty}</span>

                <button
                  type="button"
                  onClick={() => changeQty(item, 1)}
                  disabled={paid || selectedQty >= remaining}
                  className="h-12 w-12 rounded-full bg-black text-lg font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl bg-slate-950 p-4 text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/65">Seçilen toplam</span>
          <span className="text-lg font-semibold">{formatMoney(total)}</span>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setSelected({})}
            className="flex-1 rounded-2xl border border-white/20 px-4 py-3 text-sm font-medium text-white/85"
          >
            Temizle
          </button>
          <button
            type="button"
            onClick={() => void onConfirm(selectedItems)}
            disabled={selectedItems.length === 0 || loading}
            className="flex-1 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'İşleniyor...' : 'Ödemeye Geç'}
          </button>
        </div>
      </div>
    </section>
  );
}
