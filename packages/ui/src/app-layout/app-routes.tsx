import React from 'react';
import { Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AppShell } from '../layout/AppShell';
import LoginPage from '../pages/login/loginpage';
import Home from '../pages/home/home';
import Dashboard from '../pages/dashboard/dashboard';
import AddSale from '../pages/addSales/addsale';

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
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/addsales" element={<AddSale />} />
          <Route element={<AdminRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
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
