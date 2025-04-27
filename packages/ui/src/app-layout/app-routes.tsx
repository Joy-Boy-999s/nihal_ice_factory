import React, { useState, useEffect } from "react";
import { Route, Routes, Navigate, Outlet } from "react-router-dom";
import Cookies from "js-cookie";
import LoginPage from "../pages/login/loginpage";
import Home from "../pages/home/home";
import Dashboard from "../pages/dashboard/dashboard";
import Addsale from "../pages/addSales/addsale";
// import Sales from "../pages/sales/sales"; // Assuming a Sales component exists

const ProtectedRoute: React.FC = () => {
  const isAuthenticated = !!Cookies.get("accessToken");
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const AdminRoute: React.FC = () => {
  const isAuthenticated = !!Cookies.get("accessToken");
  const role = Cookies.get("userRole")?.toUpperCase();
  return isAuthenticated && role === "ADMIN" ? <Outlet /> : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!Cookies.get("accessToken"));

  useEffect(() => {
    setIsAuthenticated(!!Cookies.get("accessToken"));
  }, []);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/addsales" element={<Addsale />} />
      </Route>
      <Route element={<AdminRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />} />
    </Routes>
  );
};

export default AppRoutes;