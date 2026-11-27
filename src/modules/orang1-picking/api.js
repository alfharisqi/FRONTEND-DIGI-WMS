import { API_BASE_URL } from '../../config/api';
import { tokenStorageKey } from '../../config/authSession';

export async function pickingRequest(path, { signal, body, method = body ? 'POST' : 'GET' } = {}) {
  const token = localStorage.getItem(tokenStorageKey);
  const response = await fetch(`${API_BASE_URL}/picking${path}`, {
    signal,
    method,
    ...(method === 'GET' ? { cache: 'no-store' } : {}),
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
    const error = new Error(payload?.message || `Permintaan Picking gagal (HTTP ${response.status}).`);
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }
  return payload.data;
}

export async function validatePickingSelection(epcs, scan, onProgress) {
  const failures = [];
  let succeeded = 0;
  for (const [index, epc] of epcs.entries()) {
    onProgress(index + 1);
    try {
      const order = await scan(epc);
      succeeded += 1;
      if (order.status === 'SIAP_PACKING') break;
    } catch (error) {
      if (error.code !== 'PICKING_SCAN_REJECTED' || ![404, 409].includes(error.status)) {
        return { succeeded, failures, interrupted: { epc, message: error.message }, unattempted: epcs.length - index - 1 };
      }
      failures.push({ epc, message: error.message });
    }
  }
  return { succeeded, failures, interrupted: null, unattempted: epcs.length - succeeded - failures.length };
}
