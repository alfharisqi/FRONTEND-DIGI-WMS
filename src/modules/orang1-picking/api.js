import { API_BASE_URL } from '../../config/api';
import { tokenStorageKey } from '../../config/authSession';

export async function pickingRequest(path, { signal, body, method = body ? 'POST' : 'GET' } = {}) {
  const token = localStorage.getItem(tokenStorageKey);
  const response = await fetch(`${API_BASE_URL}/picking${path}`, {
    signal,
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).catch(error => {
    if (signal?.aborted) throw error;
    throw new Error('Backend Picking tidak dapat dijangkau.', { cause: error });
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Respons Picking tidak dapat dibaca (HTTP ${response.status}).`);
  }
  if (!response.ok || payload?.success !== true) {
    throw new Error(payload?.message || `Permintaan Picking gagal (HTTP ${response.status}).`);
  }
  return payload.data;
}
