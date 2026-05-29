import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../components';
import { ThemeProvider } from '../lib/theme';
import AppRoutes from '../app-layout/app-routes';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
