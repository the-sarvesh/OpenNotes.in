export const apiRequest = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('open_notes_token');
  
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 403) {
    const data = await response.json();
    if (data.error === 'ACCOUNT_BLOCKED') {
      // Trigger a direct logout if possible, or reload to clear state
      localStorage.removeItem('open_notes_token');
      localStorage.removeItem('open_notes_user');
      window.location.href = '/?error=blocked';
      return response;
    }
  }

  return response;
};
