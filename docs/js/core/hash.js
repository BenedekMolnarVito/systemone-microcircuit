export function fnv1a32Bytes(u8) {
  let h = 0x811c9dc5;
  for (let i = 0; i < u8.length; i++) {
    h ^= u8[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function fnv1a32(str) {
  return fnv1a32Bytes(new TextEncoder().encode(str));
}

// Sorted keys recursively, no whitespace (FR-REC-03). undefined members are skipped like JSON.stringify.
export function canonicalJSON(value) {
  if (Array.isArray(value)) return '[' + value.map((v) => canonicalJSON(v === undefined ? null : v)).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort()
      .filter((k) => value[k] !== undefined && typeof value[k] !== 'function')
      .map((k) => JSON.stringify(k) + ':' + canonicalJSON(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

export function hex8(n) {
  return (n >>> 0).toString(16).padStart(8, '0');
}
