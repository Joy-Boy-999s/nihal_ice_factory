import React, { useState, useEffect } from "react";
import { Route, Routes, Navigate, Outlet } from "react-router-dom";
import LoginPage from "../pages/login/loginpage";
import Home from "../pages/home/home";
import Dashboard from "../pages/dashboard/dashboard";



const ProtectedRoute: React.FC<{ isAuthenticated: boolean }> = ({ isAuthenticated }) => {
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

const AppRoutes: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem("token"));

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(!!localStorage.getItem("token"));
    };

    // Listen for authentication state changes
    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("storage", handleAuthChange);
    };
  }, []);

  return (
    <Routes>
      {/* <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/login" replace /> : <h1>hii</h1>}
      />
          {/* <Route path="/" element={<Home />} /> */}
      {/* <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
      /> */} 
      <Route path="/login" element={<LoginPage/>} />
      <Route path="/" element={<Dashboard />} /> 
    </Routes>
  );
};

export default AppRoutes;
