
import { tokenStorageKey } from '../config/authSession';

const configuredApiUrl =
  import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Hilangkan slash di bagian akhir.
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '');

// Pastikan URL selalu memiliki prefix /api.
export const API_BASE_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`;

/**
 * Helper HTTP Request ke Backend DIGI WMS
 * Otomatis mengirim JWT jika pengguna sudah login.
 */
export async function apiRequest(endpoint, options = {}) {
  // Normalisasi endpoint agar selalu diawali slash.
  const normalizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;

  // Ambil token JWT dari localStorage.
  const token = localStorage.getItem(tokenStorageKey);

  const response = await fetch(
    `${API_BASE_URL}${normalizedEndpoint}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    }
  );

  // Baca response JSON satu kali.
  let data;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message || `HTTP Error ${response.status}`
    );
  }

  return data;
}
