export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const headers = new Headers(options.headers || {});
  
  // Prepend API_BASE_URL if the url is relative (starts with /api)
  const fullUrl = url.startsWith('/api') ? `${API_BASE_URL}${url}` : url;

  // Automatically add Content-Type: application/json if body is stringified JSON
  // If body is FormData, do NOT set Content-Type (fetch will set it with boundary)
  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(fullUrl, { 
    ...options, 
    headers,
    credentials: 'include'
  });
  
  if (response.status === 401) {
    // Session expired or invalid
    localStorage.removeItem('open_notes_user');
    if (!window.location.pathname.includes('/auth/callback')) {
      window.location.href = '/?error=session_expired';
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
