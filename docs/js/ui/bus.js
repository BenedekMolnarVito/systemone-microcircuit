export function createBus() {
  const subs = new Map();
  return {
    on(evt, fn) {
      if (!subs.has(evt)) subs.set(evt, new Set());
      subs.get(evt).add(fn);
      return () => subs.get(evt).delete(fn);
    },
    emit(evt, payload) {
      for (const fn of [...(subs.get(evt) || [])]) fn(payload);
    },
  };
}
