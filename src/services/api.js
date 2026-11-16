
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Helper HTTP Request ke Backend DIGI WMS
 * Otomatis mengirim JWT jika pengguna sudah login.
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('digiwms_token');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      errorData.message || `HTTP Error ${response.status}`
    );
  }

  return response.json();
}
