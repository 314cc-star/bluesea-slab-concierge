import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import CheckoutReturn from './CheckoutReturn.jsx';
import './styles.css';

// The owner desk (AG Grid) loads only when visiting /owner.
const Dashboard = lazy(() => import('./Dashboard.jsx'));
const route = window.location.pathname;

function Page() {
  if (route.startsWith('/owner')) {
    return (
      <Suspense fallback={null}>
        <Dashboard />
      </Suspense>
    );
  }
  if (route.startsWith('/checkout/')) return <CheckoutReturn />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
