
const configuredApiUrl =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Hilangkan slash di bagian akhir.
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '');

// Pastikan URL selalu memiliki prefix /api.
export const API_BASE_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

/**
 * Helper HTTP Request ke Backend Node.js
 */
export async function apiRequest(endpoint, options = {}) {
  const normalizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  const response = await fetch(`${API_BASE_URL}${normalizedEndpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `HTTP Error ${response.status}`);
  }

  return data;
}
