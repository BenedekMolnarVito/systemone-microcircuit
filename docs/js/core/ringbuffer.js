export class RingBuffer {
  constructor(capacity, ArrayType = Float32Array) {
    this.capacity = capacity;
    this.ArrayType = ArrayType;
    this.buf = new ArrayType(capacity);
    this.head = 0; // next write index
    this.count = 0;
  }
  push(v) {
    this.buf[this.head] = v;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }
  // i = 0 is the oldest retained value
  get(i) {
    return this.buf[(this.head - this.count + i + this.capacity) % this.capacity];
  }
  get length() {
    return this.count;
  }
  clear() {
    this.head = 0;
    this.count = 0;
  }
  toArray() {
    const out = new this.ArrayType(this.count);
    for (let i = 0; i < this.count; i++) out[i] = this.get(i);
    return out;
  }
}
