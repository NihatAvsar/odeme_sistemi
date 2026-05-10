import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getKitchenTickets, updateKitchenTicket, type KitchenStatus, type KitchenTicketDto } from '../../api/kitchen';
import { requireAdminSecret } from '../../api/admin-auth';
import { getSocket } from '../../lib/socket';
import { adminButtonClass, adminPageClass, adminSecondaryButtonClass } from './admin-theme';

const statuses: KitchenStatus[] = ['NEW', 'PREPARING', 'READY', 'SERVED', 'CANCELLED'];

export function KitchenPage() {
  const [tickets, setTickets] = useState<KitchenTicketDto[]>([]);

  const refresh = async () => setTickets(await getKitchenTickets());

  useEffect(() => {
    requireAdminSecret();
    void refresh();

    const socket = getSocket();
    socket.connect();
    socket.on('kitchen.ticket.created', refresh);
    socket.on('kitchen.ticket.updated', refresh);
    return () => {
      socket.off('kitchen.ticket.created', refresh);
      socket.off('kitchen.ticket.updated', refresh);
    };
  }, []);

  return (
    <main className={adminPageClass}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-700">Admin / KDS</p>
          <h1 className="mt-2 text-3xl font-semibold">Mutfak Ekranı</h1>
        </div>
        <Link to="/admin/dashboard" className={adminSecondaryButtonClass}>Dashboard</Link>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tickets.map((ticket) => (
          <article key={ticket.id} className="rounded-3xl border border-orange-100 bg-white/80 p-5 shadow-lg backdrop-blur-md">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Masa {ticket.order.session.table.code}</p>
                <h2 className="mt-2 text-xl font-semibold">{ticket.nameSnapshot}</h2>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">x{ticket.quantity}</span>
            </div>
            {ticket.notes ? <p className="mt-3 text-sm text-slate-600">{ticket.notes}</p> : null}
            <p className="mt-3 text-sm font-medium">Durum: {ticket.kitchenStatus}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {statuses.map((status) => (
                <button key={status} type="button" onClick={() => void updateKitchenTicket(ticket.id, status).then(refresh)} className={status === ticket.kitchenStatus ? adminButtonClass : adminSecondaryButtonClass}>
                  {status}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
