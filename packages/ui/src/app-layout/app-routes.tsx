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
const NotFoundPage   = lazy(() => import('../pages/errors/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('../pages/errors/UnauthorizedPage'));

const LazyPage: React.FC<{ children: React.ReactNode; label: string }> = ({
  children,
  label,
}) => (
  <Suspense fallback={<PageLoader label={label} />}>
    {children}
  </Suspense>
);

/* ────────────────────────────────────────────
   ProtectedRoute — must be authenticated.
   Unauthenticated → /login
──────────────────────────────────────────── */
const ProtectedRoute: React.FC = () => {
  const { authenticated } = useAuth();
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

/* ────────────────────────────────────────────
   AdminRoute — must be authenticated + ADMIN.
   Not authenticated → /login
   Authenticated but not ADMIN → /unauthorized (403 page)
──────────────────────────────────────────── */
const AdminRoute: React.FC = () => {
  const { authenticated, role } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  if (role !== 'ADMIN') return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
};

/* ────────────────────────────────────────────
   App route tree
──────────────────────────────────────────── */
const AppRoutes: React.FC = () => {
  const { authenticated } = useAuth();

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

      {/* ── Protected (authenticated users only) ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>

          {/* Sales — all authenticated users */}
          <Route
            path="/"
            element={
              <LazyPage label="Loading sales...">
                <Home />
              </LazyPage>
            }
          />

          {/* Add Sale — all authenticated users */}
          <Route
            path="/addsales"
            element={
              <LazyPage label="Loading add sale form...">
                <AddSale />
              </LazyPage>
            }
          />

          {/* Dashboard — ADMIN only; non-admins are redirected to /unauthorized */}
          <Route element={<AdminRoute />}>
            <Route
              path="/dashboard"
              element={
                <LazyPage label="Loading dashboard...">
                  <Dashboard />
                </LazyPage>
              }
            />
            <Route
              path="/ice-price-master"
              element={
                <LazyPage label="Loading price master...">
                  <IcePriceMaster />
                </LazyPage>
              }
            />
          </Route>

          {/* 403 — Access Denied (shown inside the shell so nav is visible) */}
          <Route
            path="/unauthorized"
            element={
              <LazyPage label="Loading...">
                <UnauthorizedPage />
              </LazyPage>
            }
          />

          {/* 404 — authenticated users hitting an unknown path */}
          <Route
            path="*"
            element={
              <LazyPage label="Loading...">
                <NotFoundPage />
              </LazyPage>
            }
          />
        </Route>
      </Route>

      {/* 404 fallback for unauthenticated users — send them to login */}
      <Route
        path="*"
        element={<Navigate to={authenticated ? '/' : '/login'} replace />}
      />
    </Routes>
  );
};

export default AppRoutes;
