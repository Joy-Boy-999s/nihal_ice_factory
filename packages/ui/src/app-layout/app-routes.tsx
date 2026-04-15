import React, { Suspense, lazy } from 'react';
import { Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AppShell } from '../layout/AppShell';
import { PageLoader } from '../components';

const LoginPage = lazy(() => import('../pages/login/loginpage'));
const Home = lazy(() => import('../pages/home/home'));
const Dashboard = lazy(() => import('../pages/dashboard/dashboard'));
const AddSale = lazy(() => import('../pages/addSales/addsale'));

const LazyPage: React.FC<{ children: React.ReactNode; label: string }> = ({
  children,
  label,
}) => (
  <Suspense fallback={<PageLoader label={label} />}>
    {children}
  </Suspense>
);

const ProtectedRoute: React.FC = () => {
  const { authenticated } = useAuth();
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const AdminRoute: React.FC = () => {
  const { authenticated, role } = useAuth();
  if (!authenticated) return <Navigate to="/login" replace />;
  if (role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
};

const AppRoutes: React.FC = () => {
  const { authenticated } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LazyPage label="Loading login...">
            <LoginPage />
          </LazyPage>
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={
              <LazyPage label="Loading sales...">
                <Home />
              </LazyPage>
            }
          />
          <Route
            path="/addsales"
            element={
              <LazyPage label="Loading add sale form...">
                <AddSale />
              </LazyPage>
            }
          />
          <Route element={<AdminRoute />}>
            <Route
              path="/dashboard"
              element={
                <LazyPage label="Loading dashboard...">
                  <Dashboard />
                </LazyPage>
              }
            />
          </Route>
        </Route>
      </Route>
      <Route
        path="*"
        element={<Navigate to={authenticated ? '/' : '/login'} replace />}
      />
    </Routes>
  );
};

export default AppRoutes;
