import { API_BASE_URL } from './api';
import { tokenStorageKey, userStorageKey } from './authSession';

if (typeof window !== 'undefined' && !window.__digiwmsAuditFetchPatched) {
  window.__digiwmsAuditFetchPatched = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (url.startsWith(API_BASE_URL) || url.startsWith('/api/')) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        const token = localStorage.getItem(tokenStorageKey);
        const rawUser = localStorage.getItem(userStorageKey);

        if (token && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }

        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user?.id && !headers.has('X-Actor-Id')) {
            headers.set('X-Actor-Id', String(user.id));
          }
          if (user?.username && !headers.has('X-Actor-Username')) {
            headers.set('X-Actor-Username', String(user.username));
          }
          if (user?.role && !headers.has('X-Actor-Role')) {
            headers.set('X-Actor-Role', String(user.role));
          }
          if (user?.full_name && !headers.has('X-Actor-Name')) {
            headers.set('X-Actor-Name', String(user.full_name));
          }
        }

        return originalFetch(input, { ...init, headers });
      }
    } catch {
      // Abaikan error membaca localStorage dan teruskan fetch normal
    }

    return originalFetch(input, init);
  };
}
