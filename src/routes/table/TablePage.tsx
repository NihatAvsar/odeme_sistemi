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
import { createTableAction, type TableActionType } from '../../api/table-actions';

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
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSending, setActionSending] = useState<TableActionType | null>(null);
  const [sentActionTypes, setSentActionTypes] = useState<TableActionType[]>([]);
  const [noteText, setNoteText] = useState('');

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
    const onTableActionUpdated = () => {
      setActionMessage('Masa isteğiniz restoran ekibi tarafından güncellendi.');
    };

    socket.on('order.updated', onOrderUpdated);
    socket.on('payment.updated', onPaymentUpdated);
    socket.on('kitchen.ticket.updated', onKitchenUpdated);
    socket.on('table.action.updated', onTableActionUpdated);

    return () => {
      socket.off('order.updated', onOrderUpdated);
      socket.off('payment.updated', onPaymentUpdated);
      socket.off('kitchen.ticket.updated', onKitchenUpdated);
      socket.off('table.action.updated', onTableActionUpdated);
      socket.disconnect();
    };
  }, [tableCode, tableInfo?.id]);

  useEffect(() => {
    if (!tableInfo?.id || !activeOrderId) return;

    const socket = getSocket();
    socket.connect();
    socket.emit('order:join', activeOrderId);
  }, [tableInfo?.id, activeOrderId]);

  const submitTableAction = async (type: TableActionType, message?: string) => {
    setActionSending(type);
    setActionError(null);
    setActionMessage(null);

    try {
      await createTableAction(tableCode, { type, message });
      setSentActionTypes((current) => (current.includes(type) ? current : [...current, type]));
      setActionMessage(actionLabel(type) + ' isteğiniz iletildi.');
      if (type === 'SEND_NOTE') setNoteText('');
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'İstek gönderilemedi';
      if (messageText.includes('zaten')) {
        setSentActionTypes((current) => (current.includes(type) ? current : [...current, type]));
        setActionMessage('Bu istek zaten iletildi.');
      } else {
        setActionError(messageText);
      }
    } finally {
      setActionSending(null);
    }
  };

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col gap-4 p-3 pb-24 md:gap-6 md:p-8">
      <section className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-200">
        <div className="bg-gradient-to-br from-brand-700 via-orange-600 to-slate-900 p-5 text-white md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">QR Masa</p>
              <h1 className="mt-2 text-3xl font-semibold">Masa {tableCode}</h1>
              <p className="mt-2 max-w-sm text-sm text-white/75">Canlı adisyonunuz, sipariş durumları ve masa istekleri burada.</p>
            </div>
            <Link to="/admin/dashboard" className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/20">
              Admin
            </Link>
          </div>
          <Link
            to={`/menu/${tableCode}`}
            className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm md:inline-flex md:w-auto"
          >
            Menüye Git
          </Link>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-4 md:p-6">
          <Stat label="Ara Toplam" value={formatMoney(totals.subtotal)} />
          <Stat label="İndirim" value={formatMoney(totals.discount)} />
          <Stat label="Servis" value={formatMoney(totals.serviceFee)} />
          <Stat label="Toplam" value={formatMoney(totals.total)} />
        </div>

        {loading ? <p className="mx-4 mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 md:mx-6">Adisyon yükleniyor...</p> : null}
        {error ? <p className="mx-4 mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 md:mx-6">{error}</p> : null}
      </section>

      <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Masa İstekleri</h2>
            <p className="text-sm text-slate-500">Garson çağırabilir, hesap isteyebilir veya kısa not gönderebilirsiniz.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={actionSending === 'CALL_WAITER' || sentActionTypes.includes('CALL_WAITER')}
            onClick={() => void submitTableAction('CALL_WAITER')}
            className="min-h-14 rounded-2xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sentActionTypes.includes('CALL_WAITER') ? 'Garson çağrıldı' : actionSending === 'CALL_WAITER' ? 'Gönderiliyor...' : 'Garson Çağır'}
          </button>
          <button
            type="button"
            disabled={actionSending === 'REQUEST_BILL' || sentActionTypes.includes('REQUEST_BILL')}
            onClick={() => void submitTableAction('REQUEST_BILL')}
            className="min-h-14 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sentActionTypes.includes('REQUEST_BILL') ? 'Hesap istendi' : actionSending === 'REQUEST_BILL' ? 'Gönderiliyor...' : 'Hesap İste'}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Restorana not gönder"
            className="min-h-14 flex-1 rounded-2xl border px-4 py-3 text-sm outline-none focus:border-brand-500"
          />
          <button
            type="button"
            disabled={actionSending === 'SEND_NOTE' || !noteText.trim() || sentActionTypes.includes('SEND_NOTE')}
            onClick={() => void submitTableAction('SEND_NOTE', noteText)}
            className="min-h-14 rounded-2xl border border-slate-900 px-4 py-3 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sentActionTypes.includes('SEND_NOTE') ? 'Not gönderildi' : actionSending === 'SEND_NOTE' ? 'Gönderiliyor...' : 'Not Gönder'}
          </button>
        </div>

        {actionMessage ? <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{actionMessage}</p> : null}
        {actionError ? <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{actionError}</p> : null}
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
          <section className="rounded-[2rem] bg-white p-4 shadow-sm ring-1 ring-slate-200 md:p-6">
            <h2 className="text-lg font-semibold">Sipariş Durumları</h2>
            <div className="mt-4 space-y-3">
              {activeOrder.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">{item.nameSnapshot}</p>
                  {item.notes ? <p className="text-xs text-slate-500">{item.notes}</p> : null}
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${kitchenBadge(item.kitchenStatus ?? 'NEW')}`}>
                  {kitchenLabel(item.kitchenStatus ?? 'NEW')}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Adisyon toplamı</p>
            <p className="text-lg font-semibold text-slate-950">{formatMoney(totals.total)}</p>
          </div>
          <Link to={`/menu/${tableCode}`} className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white">
            Menü
          </Link>
        </div>
      </div>
    </main>
  );
}

function actionLabel(type: TableActionType) {
  switch (type) {
    case 'CALL_WAITER': return 'Garson çağırma';
    case 'REQUEST_BILL': return 'Hesap isteme';
    case 'SEND_NOTE': return 'Not gönderme';
    default: return 'Masa';
  }
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
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
