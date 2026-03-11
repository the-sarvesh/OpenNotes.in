import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import './index.css';

import { CartProvider } from './contexts/CartContext.tsx';

// Global Fetch Interceptor to handle Account Blocking
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  
  // Clone the response because we need to read it but want to return it intact
  if (response.status === 403) {
    const clone = response.clone();
    try {
      const data = await clone.json();
      if (data.error === 'ACCOUNT_BLOCKED') {
        // Clear local storage and force reload/logout
        localStorage.removeItem('open_notes_token');
        localStorage.removeItem('open_notes_user');
        window.location.href = '/?error=blocked';
      }
    } catch (e) {
      // Not JSON or other error
    }
  }
  
  return response;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </AuthProvider>
  </StrictMode>,
);
