// src/routes/table/TablePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { getOrder } from '../../api/orders';
import { ItemSplitSelector } from '../../features/split-bill/ItemSplitSelector';
import { formatMoney } from '../../functions/currency';
import { calculateOrderTotals, calculateSelectedAmount } from '../../functions/billing';
import type { BillItem, SelectedItem } from '../../types/billing';

const DEMO_ORDER_ID = 'demo-order-1';
const DEMO_TABLE_ID = 'table-12';

export function TablePage() {
  const { tableId = DEMO_TABLE_ID } = useParams();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => calculateOrderTotals(items), [items]);

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      try {
        const order = await getOrder(DEMO_ORDER_ID);
        if (!mounted) return;

        setItems(
          order.items.map((item) => ({
            id: item.id,
            name: item.nameSnapshot,
            unitPrice: Number(item.unitPriceSnapshot),
            quantity: item.quantity,
            paidQuantity: item.paidQuantity,
          })),
        );
        setError(null);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Adisyon yuklenemedi';
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadOrder();

    const socket = getSocket();
    socket.connect();
    socket.emit('table:join', tableId);
    socket.emit('order:join', DEMO_ORDER_ID);

    const onOrderUpdated = () => {
      void loadOrder();
    };

    const onPaymentUpdated = () => {
      void loadOrder();
    };

    socket.on('order.updated', onOrderUpdated);
    socket.on('payment.updated', onPaymentUpdated);

    return () => {
      mounted = false;
      socket.off('order.updated', onOrderUpdated);
      socket.off('payment.updated', onPaymentUpdated);
      socket.disconnect();
    };
  }, [tableId]);

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-700">Masa {tableId.replace('table-', '')}</p>
          <div className="flex gap-2">
            <Link to={`/menu/${tableId}`} className="rounded-xl border px-3 py-2 text-sm font-medium">Menüye Git</Link>
            <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Admin</Link>
          </div>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Canlı Adisyon</h1>
        <p className="mt-2 text-sm text-slate-600">
          Bu ekran masa QR koduyla açılan aktif hesabı temsil eder.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Ara Toplam" value={formatMoney(totals.subtotal)} />
          <Stat label="Servis" value={formatMoney(totals.serviceFee)} />
          <Stat label="Toplam" value={formatMoney(totals.total)} />
        </div>

        {loading ? <p className="mt-4 text-sm text-slate-500">Adisyon yukleniyor...</p> : null}
        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}
      </section>

      <ItemSplitSelector
        items={items}
        loading={submitted || loading}
        onConfirm={async (selectedItems: SelectedItem[]) => {
          setSubmitted(true);
          await new Promise((resolve) => setTimeout(resolve, 800));
          const selectedSubtotal = calculateSelectedAmount(items, selectedItems);

          navigate('/checkout', {
            state: {
              orderId: DEMO_ORDER_ID,
              tableId,
              splitType: 'ITEM_SPLIT',
              selectedItems,
              subtotal: selectedSubtotal,
            },
          });
          setSubmitted(false);
        }}
      />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
