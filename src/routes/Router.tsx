import { createBrowserRouter } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
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
import { clearAdminSession } from '../api/admin-auth';

function CustomerRoute({ children }: { children: ReactNode }) {
  useEffect(() => {
    clearAdminSession();
  }, []);

  return children;
}

export const router = createBrowserRouter([
  { path: '/', element: <CustomerRoute><TablePage /></CustomerRoute> },
  { path: '/table/:tableCode', element: <CustomerRoute><TablePage /></CustomerRoute> },
  { path: '/menu/:tableCode', element: <CustomerRoute><CustomerMenuPage /></CustomerRoute> },
  { path: '/checkout', element: <CustomerRoute><CheckoutPage /></CustomerRoute> },
  { path: '/checkout/success', element: <CustomerRoute><PaymentSuccessPage /></CustomerRoute> },
  { path: '/admin/dashboard', element: <DashboardPage /> },
  { path: '/admin/tables', element: <TablesPage /> },
  { path: '/admin/pending-orders', element: <PendingOrdersPage /> },
  { path: '/admin/settings', element: <SettingsPage /> },
  { path: '/admin/kitchen', element: <KitchenPage /> },
  { path: '/admin/reports', element: <ReportsPage /> },
  { path: '/admin/table-actions', element: <TableActionsPage /> },
  { path: '/admin/tables/:tableId', element: <TableDetailPage /> },
  { path: '/admin/menu', element: <AdminMenuPage /> },
  { path: '/admin/menu/:itemId/edit', element: <AdminMenuPage /> },
]);
