// JEV key holder (SPEC 3.9, FR-KEY-01..10). Key lives only in the closure below. DOM-free; storage injected.
const NAME = 'smc.jevKey';

export function normalizeKey(raw) {
  const key = String(raw ?? '').trim();
  if (key.length < 8) return { ok: false, error: 'Key too short (min 8 characters)' };
  if (key.length > 512) return { ok: false, error: 'Key too long (max 512 characters)' };
  if (!/^[\x21-\x7E]+$/.test(key)) return { ok: false, error: 'Key must be printable ASCII without spaces' };
  return { ok: true, key };
}

export function createKeystore(storage) {
  let key = null, enabled = false, invalid = false;
  const tryDo = (fn) => { try { return fn(); } catch { return undefined; } };
  return {
    // called only after the health check passed (FR-KEY-11)
    enable() {
      enabled = true;
      key = tryDo(() => storage.session.getItem(NAME)) || tryDo(() => storage.local.getItem(NAME)) || null;
    },
    get enabled() { return enabled; },
    get: () => key,
    set(raw, remember) {
      if (!enabled) return { ok: false, error: 'disabled' };
      const n = normalizeKey(raw);
      if (!n.ok) return n;
      key = n.key;
      invalid = false;
      const [on, off] = remember ? [storage.local, storage.session] : [storage.session, storage.local];
      try { on.setItem(NAME, key); off.removeItem(NAME); } catch { return { ok: true, memoryOnly: true }; }
      return { ok: true };
    },
    forget() {
      key = null; invalid = false;
      tryDo(() => storage.session.removeItem(NAME));
      tryDo(() => storage.local.removeItem(NAME));
    },
    masked: () => (key ? '•••• ' + key.slice(-4) : ''),
    has: () => key !== null,
    markInvalid() { invalid = true; },
    isInvalid: () => invalid,
  };
}
