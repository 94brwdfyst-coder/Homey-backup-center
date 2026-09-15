'use strict';
const { randomUUID } = require('node:crypto');
const CHUNK_BYTES = 16 * 1024;
const MAX_BYTES = 50 * 1024 * 1024;
const TOTAL_BYTES = 64 * 1024 * 1024;
const TTL = 30 * 60 * 1000;

// Only opaque handles cross the app API after upload. No credentials or backups on disk.
class Transfers {
  constructor(now = Date.now) { this.now = now; this.items = new Map(); }
  prune() { for (const [id, item] of this.items) if (!item.pins && item.expires <= this.now()) this.items.delete(id); }
  create(bytes, kind = 'backup', buffer = null) {
    this.prune();
    if (!Number.isInteger(bytes) || bytes < 1 || bytes > MAX_BYTES) throw Error('Transfer size must be between 1 byte and 50 MiB.');
    const total = [...this.items.values()].reduce((n, x) => n + x.buffer.length, 0);
    if (this.items.size >= 8 || total + bytes > TOTAL_BYTES) throw Error('Temporary transfer storage is full. Close other backups and try again.');
    const id = randomUUID();
    this.items.set(id, { buffer: buffer || Buffer.alloc(bytes), received: 0, ready: false, kind, expires: this.now() + TTL, pins: 0 });
    return { id, bytes, chunkBytes: CHUNK_BYTES };
  }
  get(id, kind) {
    this.prune();
    const item = this.items.get(id);
    if (!item || (kind && item.kind !== kind)) throw Error('This transfer has expired. Open the backup again.');
    item.expires = this.now() + TTL;
    return item;
  }
  append(id, offset, base64) {
    const item = this.get(id);
    if (!['backup','selection'].includes(item.kind) || item.ready || !Number.isInteger(offset) || offset < 0 || typeof base64 !== 'string' || base64.length > Math.ceil(CHUNK_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw Error('Invalid backup chunk.');
    const data = Buffer.from(base64, 'base64');
    if (!data.length || data.length > CHUNK_BYTES || offset + data.length > item.buffer.length) throw Error('Invalid backup chunk size.');
    // Exact retries are safe; out-of-order or changed chunks are rejected.
    if (offset < item.received && offset + data.length <= item.received && item.buffer.subarray(offset, offset + data.length).equals(data)) return { received: item.received };
    if (offset !== item.received) throw Error('Backup chunks are out of order.');
    data.copy(item.buffer, offset); item.received += data.length;
    return { received: item.received };
  }
  finish(id, validate) {
    const item = this.get(id);
    if (item.received !== item.buffer.length) throw Error('The backup upload is incomplete.');
    if (!['backup','selection'].includes(item.kind)) throw Error('Invalid backup chunk.');
    const data = JSON.parse(item.buffer.toString('utf8'));
    validate(data,item.kind); item.ready = true;
    return { id, bytes: item.buffer.length, chunkBytes: CHUNK_BYTES };
  }
  json(id, kind = 'backup') {
    const item = this.get(id, kind);
    if (!item.ready) throw Error('The backup upload is incomplete.');
    return JSON.parse(item.buffer.toString('utf8'));
  }
  publish(value) {
    const buffer = Buffer.from(JSON.stringify(value), 'utf8');
    const meta = this.create(buffer.length, 'result', buffer);
    const item = this.get(meta.id); item.buffer = buffer; item.ready = true; item.received = buffer.length;
    return meta;
  }
  read(id, offset) {
    const item = this.get(id, 'result');
    if (!item.ready || !Number.isInteger(offset) || offset < 0 || offset >= item.buffer.length) throw Error('Invalid transfer offset.');
    const end = Math.min(offset + CHUNK_BYTES, item.buffer.length);
    return { data: item.buffer.subarray(offset, end).toString('base64'), next: end };
  }
  release(id) { const item = this.items.get(id); if (item && !item.pins) this.items.delete(id); return { ok: true }; }
  async withBackup(id, fn) {
    const item = this.get(id, 'backup'); item.pins++;
    try { return await fn(this.json(id)); } finally { item.pins--; item.expires = this.now() + TTL; }
  }
  clear() { this.items.clear(); }
}
module.exports = { Transfers, CHUNK_BYTES, MAX_BYTES, TTL };
