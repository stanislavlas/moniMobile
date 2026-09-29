/**
 * Lightweight pub/sub for auth lifecycle events on mobile.
 * Mirrors the web's window "auth:expired" event pattern without
 * requiring a DOM — allows useAuth to react to session expiry
 * regardless of which service triggered the 401.
 */
const listeners = new Set();

export const authEvents = {
  emit(event) {
    listeners.forEach(fn => { try { fn(event); } catch {} });
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};
