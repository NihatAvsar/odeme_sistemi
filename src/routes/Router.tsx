import { createBrowserRouter } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import { TablePage } from './table/TablePage';
import { CheckoutPage } from './payments/CheckoutPage';
import { PaymentSuccessPage } from './payments/PaymentSuccessPage';
import { MenuPage as CustomerMenuPage } from './menu/MenuPage';
import { MenuPage as AdminMenuPage } from './admin/MenuPage';
import { DashboardPage } from './admin/DashboardPage';
import { TablesPage } from './admin/TablesPage';
import { PendingOrdersPage } from './admin/PendingOrdersPage';
import { TableDetailPage } from './admin/TableDetailPage';
import { SettingsPage } from './admin/SettingsPage';
import { KitchenPage } from './admin/KitchenPage';
import { ReportsPage } from './admin/ReportsPage';
import { TableActionsPage } from './admin/TableActionsPage';
import { clearAdminSession, hasAdminSession, requireAdminSecret } from '../api/admin-auth';

function CustomerRoute({ children }: { children: ReactNode }) {
  useEffect(() => {
    clearAdminSession();
  }, []);

  return children;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState(() => hasAdminSession());

  useEffect(() => {
    if (hasAdminSession()) {
      setAuthorized(true);
      return;
    }

    const secret = requireAdminSecret();
    setAuthorized(Boolean(secret && hasAdminSession()));
  }, []);

  if (!authorized) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl items-center p-4">
        <section className="w-full rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <h1 className="text-xl font-semibold text-slate-950">Admin girişi gerekli</h1>
          <p className="mt-2 text-sm text-slate-500">Admin panelini açmak için şifre girmelisin.</p>
        </section>
      </main>
    );
  }

  return children;
}

export const router = createBrowserRouter([
  { path: '/', element: <CustomerRoute><TablePage /></CustomerRoute> },
  { path: '/table/:tableCode', element: <CustomerRoute><TablePage /></CustomerRoute> },
  { path: '/menu/:tableCode', element: <CustomerRoute><CustomerMenuPage /></CustomerRoute> },
  { path: '/checkout', element: <CustomerRoute><CheckoutPage /></CustomerRoute> },
  { path: '/checkout/success', element: <CustomerRoute><PaymentSuccessPage /></CustomerRoute> },
  { path: '/admin/dashboard', element: <AdminRoute><DashboardPage /></AdminRoute> },
  { path: '/admin/tables', element: <AdminRoute><TablesPage /></AdminRoute> },
  { path: '/admin/pending-orders', element: <AdminRoute><PendingOrdersPage /></AdminRoute> },
  { path: '/admin/settings', element: <AdminRoute><SettingsPage /></AdminRoute> },
  { path: '/admin/kitchen', element: <AdminRoute><KitchenPage /></AdminRoute> },
  { path: '/admin/reports', element: <AdminRoute><ReportsPage /></AdminRoute> },
  { path: '/admin/table-actions', element: <AdminRoute><TableActionsPage /></AdminRoute> },
  { path: '/admin/tables/:tableId', element: <AdminRoute><TableDetailPage /></AdminRoute> },
  { path: '/admin/menu', element: <AdminRoute><AdminMenuPage /></AdminRoute> },
  { path: '/admin/menu/:itemId/edit', element: <AdminRoute><AdminMenuPage /></AdminRoute> },
]);
