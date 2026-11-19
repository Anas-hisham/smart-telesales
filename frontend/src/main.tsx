import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { App } from '@/app/App';
import { ApiErrorBanner } from '@/shared/components/ApiErrorBanner';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { store } from '@/store';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ErrorBoundary>
        <App />
        <ApiErrorBanner />
      </ErrorBoundary>
    </Provider>
  </StrictMode>
);
