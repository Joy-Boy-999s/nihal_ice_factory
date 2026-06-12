import React, { Suspense, lazy } from 'react';
import { Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AppShell } from '../layout/AppShell';
import { PageLoader } from '../components';

/* ── Lazy page imports ── */
const LoginPage      = lazy(() => import('../pages/login/loginpage'));
const Home           = lazy(() => import('../pages/home/home'));
const Dashboard      = lazy(() => import('../pages/dashboard/dashboard'));
const AddSale        = lazy(() => import('../pages/addSales/addsale'));
const IcePriceMaster = lazy(() => import('../pages/icePriceMaster/IcePriceMaster'));
const PlantMaster      = lazy(() => import('../pages/plantMaster/PlantMaster'));
const UserManagement   = lazy(() => import('../pages/userManagement/UserManagement'));
const InventoryPage    = lazy(() => import('../pages/inventory/inventory'));
const OrdersPage       = lazy(() => import('../pages/orders/OrdersPage'));
const CreditPage       = lazy(() => import('../pages/credit/CreditPage'));
const AuditPage        = lazy(() => import('../pages/audit/AuditPage'));
const ProductionPage   = lazy(() => import('../pages/production/ProductionPage'));
const PaymentPage      = lazy(() => import('../pages/payment/PaymentPage'));
const ShopPage         = lazy(() => import('../pages/shop/ShopPage'));
const MyOrdersPage     = lazy(() => import('../pages/myOrders/MyOrdersPage'));
const InvoicePage            = lazy(() => import('../pages/invoice/InvoicePage'));
const NotFoundPage           = lazy(() => import('../pages/errors/NotFoundPage'));
const UnauthorizedPage       = lazy(() => import('../pages/errors/UnauthorizedPage'));
const CustomerDiscountsPage  = lazy(() => import('../pages/customerDiscounts/CustomerDiscountsPage'));

const LazyPage: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <Suspense fallback={<PageLoader label={label} />}>{children}</Suspense>
);

/* ── ProtectedRoute — must be authenticated ── */
const ProtectedRoute: React.FC = () => {
  const { authenticated } = useAuth();
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/* ── StaffRoute — authenticated + NOT a CUSTOMER ── */
const StaffRoute: React.FC = () => {
  const { authenticated, role } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  if (role === 'CUSTOMER') return <Navigate to="/shop" replace />;
  return <Outlet />;
};

/* ── AdminRoute — must be ADMIN ── */
const AdminRoute: React.FC = () => {
  const { authenticated, role } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  if (role !== 'ADMIN') return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
};

/* ── CustomerRoute — CUSTOMER or ADMIN ── */
const CustomerRoute: React.FC = () => {
  const { authenticated, role } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  if (role !== 'CUSTOMER' && role !== 'ADMIN') return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
};

/* ── App route tree ── */
const AppRoutes: React.FC = () => {
  const { authenticated, role } = useAuth();

  return (
    <Routes>
      {/* ── Public ── */}
      <Route
        path="/login"
        element={
          <LazyPage label="Loading login...">
            <LoginPage />
          </LazyPage>
        }
      />

      {/* ── All authenticated users ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>

          {/* ── Customer-only routes ── */}
          <Route element={<CustomerRoute />}>
            <Route
              path="/shop"
              element={<LazyPage label="Loading shop..."><ShopPage /></LazyPage>}
            />
            <Route
              path="/my-orders"
              element={<LazyPage label="Loading my orders..."><MyOrdersPage /></LazyPage>}
            />
          </Route>

          {/* Payment & Invoice accessible to customers and admins */}
          <Route
            path="/payment/:saleId"
            element={<LazyPage label="Loading payment..."><PaymentPage /></LazyPage>}
          />
          <Route
            path="/invoice/:orderId"
            element={<LazyPage label="Loading invoice..."><InvoicePage /></LazyPage>}
          />

          {/* ── Staff routes (non-CUSTOMER) ── */}
          <Route element={<StaffRoute />}>
            <Route
              path="/"
              element={<LazyPage label="Loading sales..."><Home /></LazyPage>}
            />
            <Route
              path="/addsales"
              element={<LazyPage label="Loading add sale form..."><AddSale /></LazyPage>}
            />
            <Route
              path="/inventory"
              element={<LazyPage label="Loading inventory..."><InventoryPage /></LazyPage>}
            />
            <Route
              path="/orders"
              element={<LazyPage label="Loading orders..."><OrdersPage /></LazyPage>}
            />
            <Route
              path="/credit"
              element={<LazyPage label="Loading credit summary..."><CreditPage /></LazyPage>}
            />
            <Route
              path="/production"
              element={<LazyPage label="Loading production plan..."><ProductionPage /></LazyPage>}
            />

            {/* Admin-only */}
            <Route element={<AdminRoute />}>
              <Route
                path="/dashboard"
                element={<LazyPage label="Loading dashboard..."><Dashboard /></LazyPage>}
              />
              <Route
                path="/ice-price-master"
                element={<LazyPage label="Loading price master..."><IcePriceMaster /></LazyPage>}
              />
              <Route
                path="/plant-master"
                element={<LazyPage label="Loading plant master..."><PlantMaster /></LazyPage>}
              />
              <Route
                path="/user-management"
                element={<LazyPage label="Loading user management..."><UserManagement /></LazyPage>}
              />
              <Route
                path="/customer-discounts/:customerId"
                element={<LazyPage label="Loading discount tiers..."><CustomerDiscountsPage /></LazyPage>}
              />
              <Route
                path="/audit"
                element={<LazyPage label="Loading audit log..."><AuditPage /></LazyPage>}
              />
            </Route>
          </Route>

          {/* 403 */}
          <Route
            path="/unauthorized"
            element={<LazyPage label="Loading..."><UnauthorizedPage /></LazyPage>}
          />

          {/* 404 — authenticated users */}
          <Route
            path="*"
            element={<LazyPage label="Loading..."><NotFoundPage /></LazyPage>}
          />
        </Route>
      </Route>

      {/* 404 fallback for unauthenticated users */}
      <Route
        path="*"
        element={
          <Navigate
            to={authenticated ? (role === 'CUSTOMER' ? '/shop' : '/') : '/login'}
            replace
          />
        }
      />
    </Routes>
  );
};

export default AppRoutes;
