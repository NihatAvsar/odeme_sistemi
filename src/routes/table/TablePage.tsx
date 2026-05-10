// src/routes/table/TablePage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSocket } from '../../lib/socket';
import { getTableContext } from '../../api/tables';
import { ItemSplitSelector } from '../../features/split-bill/ItemSplitSelector';
import { formatMoney } from '../../functions/currency';
import { calculateOrderTotals, calculateSelectedAmount } from '../../functions/billing';
import type { BillItem, SelectedItem } from '../../types/billing';
import type { ApiOrder } from '../../api/orders';

const DEMO_TABLE_CODE = '12';

export function TablePage() {
  const { tableCode = DEMO_TABLE_CODE } = useParams();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<{ id: string; code: string; restaurantId: string } | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<ApiOrder | null>(null);

  const totals = useMemo(() => {
    if (activeOrder) {
      return {
        subtotal: Number(activeOrder.subtotal),
        discount: Number(activeOrder.discount),
        serviceFee: Number(activeOrder.serviceFee),
        tax: 0,
        total: Number(activeOrder.total),
      };
    }

    return calculateOrderTotals(items);
  }, [items, activeOrder]);

  const applyContext = (context: Awaited<ReturnType<typeof getTableContext>>) => {
    setTableInfo(context.table);
    setActiveOrderId(context.activeOrder?.id ?? null);
    setActiveOrder(context.activeOrder);
    setItems(
      (context.activeOrder?.items ?? []).map((item) => ({
        id: item.groupKey ?? item.id,
        groupKey: item.groupKey ?? item.id,
        name: item.nameSnapshot,
        unitPrice: Number(item.unitPriceSnapshot),
        quantity: item.quantity,
        paidQuantity: item.paidQuantity,
      })),
    );
  };

  useEffect(() => {
    let mounted = true;

    const loadContext = async () => {
      try {
        const context = await getTableContext(tableCode);
        if (!mounted) return;

        applyContext(context);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Adisyon yuklenemedi';
        setError(message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadContext();

    return () => {
      mounted = false;
    };
  }, [tableCode]);

  useEffect(() => {
    if (!tableInfo?.id) return;

    const socket = getSocket();
    socket.connect();
    socket.emit('table:join', tableInfo.id);

    const refreshContext = () => {
      void getTableContext(tableCode).then(applyContext);
    };

    const onOrderUpdated = () => refreshContext();
    const onPaymentUpdated = () => refreshContext();
    const onKitchenUpdated = () => refreshContext();

    socket.on('order.updated', onOrderUpdated);
    socket.on('payment.updated', onPaymentUpdated);
    socket.on('kitchen.ticket.updated', onKitchenUpdated);

    return () => {
      socket.off('order.updated', onOrderUpdated);
      socket.off('payment.updated', onPaymentUpdated);
      socket.off('kitchen.ticket.updated', onKitchenUpdated);
      socket.disconnect();
    };
  }, [tableCode, tableInfo?.id]);

  useEffect(() => {
    if (!tableInfo?.id || !activeOrderId) return;

    const socket = getSocket();
    socket.connect();
    socket.emit('order:join', activeOrderId);
  }, [tableInfo?.id, activeOrderId]);

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 p-4 md:p-8">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-brand-700">Masa {tableCode}</p>
          <div className="flex gap-2">
            <Link to={`/menu/${tableCode}`} className="rounded-xl border px-3 py-2 text-sm font-medium">Menüye Git</Link>
            <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Admin</Link>
          </div>
        </div>
        <h1 className="mt-2 text-2xl font-semibold">Canlı Adisyon</h1>
        <p className="mt-2 text-sm text-slate-600">
          Bu ekran masa QR koduyla açılan aktif hesabı temsil eder.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Ara Toplam" value={formatMoney(totals.subtotal)} />
          <Stat label="İndirim" value={formatMoney(totals.discount)} />
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
              orderId: activeOrderId ?? '',
              tableId: tableCode,
              splitType: 'ITEM_SPLIT',
              selectedItems,
              subtotal: selectedSubtotal,
            },
          });
          setSubmitted(false);
        }}
      />

      {activeOrder ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold">Sipariş Durumları</h2>
          <div className="mt-4 space-y-3">
            {activeOrder.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="font-medium">{item.nameSnapshot}</p>
                  {item.notes ? <p className="text-xs text-slate-500">{item.notes}</p> : null}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${kitchenBadge(item.kitchenStatus ?? 'NEW')}`}>
                  {kitchenLabel(item.kitchenStatus ?? 'NEW')}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function kitchenLabel(status: string) {
  switch (status) {
    case 'NEW': return 'Bekleniyor';
    case 'PREPARING': return 'Hazırlanıyor';
    case 'READY': return 'Hazır';
    case 'SERVED': return 'Servis edildi';
    case 'CANCELLED': return 'İptal edildi';
    default: return status;
  }
}

function kitchenBadge(status: string) {
  switch (status) {
    case 'NEW': return 'bg-slate-100 text-slate-700';
    case 'PREPARING': return 'bg-amber-100 text-amber-800';
    case 'READY': return 'bg-emerald-100 text-emerald-800';
    case 'SERVED': return 'bg-sky-100 text-sky-800';
    case 'CANCELLED': return 'bg-rose-100 text-rose-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
