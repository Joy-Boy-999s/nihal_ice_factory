import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { configVariables } from '@nihal-ice-factory/shared-services';
import { installGlobalErrorLogging } from './lib/logger';
import { installApiLogging } from './lib/api-logging';
import './styles.css';

installGlobalErrorLogging();
installApiLogging();

/*
 * Warm up the API the moment the app opens: preconnect sets up TCP+TLS
 * early, and the fire-and-forget ping wakes a sleeping free-tier backend
 * while the user is still on the login screen — instead of when they land
 * on their first data page.
 */
try {
  const apiOrigin = configVariables.APP_INO_SERVICE_URL;
  if (apiOrigin) {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = apiOrigin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);

    fetch(`${apiOrigin}/`, { method: 'GET', mode: 'cors' }).catch(() => undefined);
  }
} catch { /* warm-up is best-effort */ }

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
