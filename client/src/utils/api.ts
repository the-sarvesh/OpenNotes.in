// In local development, always use the Vite proxy (empty base URL)
// This prevents accidental calls to production Render URLs from a local machine
const isLocal = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname === '0.0.0.0' ||
  !window.location.hostname.includes('.') || // Local hostnames like 'my-pc'
  /^192\.168\./.test(window.location.hostname) ||
  /^10\./.test(window.location.hostname) ||
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);

const envBaseUrl = ((import.meta as any).env.VITE_API_URL || (import.meta as any).env.VITE_API_BASE_URL)?.replace(/\/$/, "");
export const API_BASE_URL = isLocal ? '' : envBaseUrl || 'https://opennotes-in.onrender.com';

console.log(`[API] Initialized with BASE_URL: "${API_BASE_URL}" (Local: ${isLocal})`);

export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});

  // Prepend API_BASE_URL if the url is relative (starts with /api)
  const fullUrl = url.startsWith('/api') ? `${API_BASE_URL}${url}` : url;

  // Automatically add Content-Type: application/json if body is stringified JSON
  // If body is FormData, do NOT set Content-Type (fetch will set it with boundary)
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  console.log(`[API Request] Calling: ${options.method || 'GET'} ${fullUrl}`);

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (response.status === 401) {
    // Session expired or invalid
    // BUT don't redirect if we're on the login or register page/modal attempt
    const isAuthRoute = url.includes('/api/auth/login') || url.includes('/api/auth/register');
    
    if (!isAuthRoute) {
      localStorage.removeItem('open_notes_user');
      if (!window.location.pathname.includes('/auth/callback')) {
        window.location.href = '/?error=session_expired';
      }
    }
    return response;
  }

  if (response.status === 403) {
    const data = await response.json();
    if (data.error === 'ACCOUNT_BLOCKED') {
      localStorage.removeItem('open_notes_user');
      window.location.href = '/?error=blocked';
      return response;
    }
  }

  return response;
};
