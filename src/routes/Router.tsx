import { createBrowserRouter } from 'react-router-dom';
import { TablePage } from './table/TablePage';
import { CheckoutPage } from './payments/CheckoutPage';
import { PaymentSuccessPage } from './payments/PaymentSuccessPage';
import { MenuPage as CustomerMenuPage } from './menu/MenuPage';
import { MenuPage as AdminMenuPage } from './admin/MenuPage';
import { DashboardPage } from './admin/DashboardPage';
import { TablesPage } from './admin/TablesPage';
import { PendingOrdersPage } from './admin/PendingOrdersPage';
import { TableDetailPage } from './admin/TableDetailPage';

export const router = createBrowserRouter([
  { path: '/', element: <TablePage /> },
  { path: '/table/:tableCode', element: <TablePage /> },
  { path: '/menu/:tableCode', element: <CustomerMenuPage /> },
  { path: '/checkout', element: <CheckoutPage /> },
  { path: '/checkout/success', element: <PaymentSuccessPage /> },
  { path: '/admin/dashboard', element: <DashboardPage /> },
  { path: '/admin/tables', element: <TablesPage /> },
  { path: '/admin/pending-orders', element: <PendingOrdersPage /> },
  { path: '/admin/tables/:tableId', element: <TableDetailPage /> },
  { path: '/admin/menu', element: <AdminMenuPage /> },
  { path: '/admin/menu/:itemId/edit', element: <AdminMenuPage /> },
]);
