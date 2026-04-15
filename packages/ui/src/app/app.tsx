import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components';
import AppRoutes from '../app-layout/app-routes';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
