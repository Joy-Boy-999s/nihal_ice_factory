import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { installGlobalErrorLogging } from './lib/logger';
import { installApiLogging } from './lib/api-logging';
import './styles.css';

installGlobalErrorLogging();
installApiLogging();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
