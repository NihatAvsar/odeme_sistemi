import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminTableActions, updateAdminTableAction } from '../../api/admin-table-actions';
import { requireAdminSecret } from '../../api/admin-auth';
import type { TableActionDto, TableActionStatus, TableActionType } from '../../api/table-actions';
import { getSocket } from '../../lib/socket';

export function TableActionsPage() {
  const [actions, setActions] = useState<TableActionDto[]>([]);
  const [status, setStatus] = useState<TableActionStatus | 'ALL'>('OPEN');
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const refresh = async (nextStatus = status) => {
    const data = await getAdminTableActions(nextStatus);
    setActions(data);
  };

  useEffect(() => {
    requireAdminSecret();
    void refresh().catch((err) => setError(err instanceof Error ? err.message : 'Masa istekleri yüklenemedi'));
  }, []);

  useEffect(() => {
    const restaurantId = actions[0]?.restaurantId;
    if (!restaurantId) return;

    const socket = getSocket();
    socket.connect();
    socket.emit('admin:join', restaurantId);

    const onActionChanged = () => {
      void refresh().catch((err) => setError(err instanceof Error ? err.message : 'Masa istekleri güncellenemedi'));
    };

    socket.on('table.action.created', onActionChanged);
    socket.on('table.action.updated', onActionChanged);

    return () => {
      socket.off('table.action.created', onActionChanged);
      socket.off('table.action.updated', onActionChanged);
      socket.disconnect();
    };
  }, [actions[0]?.restaurantId, status]);

  const updateStatus = async (actionId: string, nextStatus: TableActionStatus) => {
    setSavingId(actionId);
    setError(null);
    try {
      await updateAdminTableAction(actionId, nextStatus);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İstek güncellenemedi');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Masa İstekleri</h1>
          <p className="text-sm text-slate-500">Garson çağırma, hesap isteme ve not aksiyonları</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/dashboard" className="rounded-xl border px-3 py-2 text-sm font-medium">Dashboard</Link>
          <Link to="/admin/reports" className="rounded-xl border px-3 py-2 text-sm font-medium">Raporlar</Link>
        </div>
      </div>

      <section className="mb-4 flex flex-wrap gap-2">
        {(['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED', 'ALL'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => {
              setStatus(entry);
              void refresh(entry).catch((err) => setError(err instanceof Error ? err.message : 'Masa istekleri yüklenemedi'));
            }}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${status === entry ? 'bg-black text-white' : 'border bg-white text-slate-700'}`}
          >
            {statusLabel(entry)}
          </button>
        ))}
      </section>

      {error ? <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="grid gap-3">
        {actions.length === 0 ? <p className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">Bu filtrede masa isteği yok.</p> : null}

        {actions.map((action) => (
          <article key={action.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${actionBadge(action.type)}`}>{actionLabel(action.type)}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{statusLabel(action.status)}</span>
                </div>
                <h2 className="mt-3 text-lg font-semibold">Masa {action.table?.code ?? action.tableId}</h2>
                <p className="text-sm text-slate-500">{action.table?.name ?? 'İsimsiz masa'}</p>
                {action.message ? <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">{action.message}</p> : null}
                <p className="mt-3 text-xs text-slate-400">{new Date(action.createdAt).toLocaleString('tr-TR')}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {action.status === 'OPEN' ? (
                  <button
                    type="button"
                    disabled={savingId === action.id}
                    onClick={() => void updateStatus(action.id, 'ACKNOWLEDGED')}
                    className="rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Görüldü
                  </button>
                ) : null}
                {action.status !== 'RESOLVED' && action.status !== 'CANCELLED' ? (
                  <button
                    type="button"
                    disabled={savingId === action.id}
                    onClick={() => void updateStatus(action.id, 'RESOLVED')}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {action.type === 'REQUEST_BILL' ? 'Hesabı Kapat' : 'Çözüldü'}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function actionLabel(type: TableActionType) {
  switch (type) {
    case 'CALL_WAITER': return 'Garson Çağırma';
    case 'REQUEST_BILL': return 'Hesap İsteme';
    case 'SEND_NOTE': return 'Not';
    default: return type;
  }
}

function statusLabel(status: TableActionStatus | 'ALL') {
  switch (status) {
    case 'OPEN': return 'Açık';
    case 'ACKNOWLEDGED': return 'Görüldü';
    case 'RESOLVED': return 'Çözüldü';
    case 'CANCELLED': return 'İptal';
    case 'ALL': return 'Tümü';
    default: return status;
  }
}

function actionBadge(type: TableActionType) {
  switch (type) {
    case 'CALL_WAITER': return 'bg-amber-100 text-amber-800';
    case 'REQUEST_BILL': return 'bg-sky-100 text-sky-800';
    case 'SEND_NOTE': return 'bg-violet-100 text-violet-800';
    default: return 'bg-slate-100 text-slate-700';
  }
}
