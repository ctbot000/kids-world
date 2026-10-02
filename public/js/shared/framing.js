// Long texts over data channels. Channels cap the size of one message, so a
// long text travels in numbered pieces and is put back together on arrival.
// Shared by the page's links and by the keeper, which runs in Node.

export const CHUNK = 16000;

// Pieces never split a surrogate pair, which would not survive UTF-8 encoding.
export function splitText(text, size = CHUNK) {
  const parts = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(text.length, start + size);
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xd800 && code <= 0xdbff) end--;
    parts.push(text.slice(start, end));
    start = end;
  }
  return parts;
}

let pieceSeq = 0;

// conn: anything with send(text).
export function sendText(conn, text) {
  if (text.length <= CHUNK) {
    conn.send(text);
    return;
  }
  const parts = splitText(text);
  const id = (++pieceSeq).toString(36);
  parts.forEach((part, k) => conn.send(`~${id}:${k}:${parts.length}:${part}`));
}

export class Reassembler {
  // maxParts: the most pieces one text may have, which caps its length.
  // maxPending: how many texts may be arriving at once; the oldest goes first.
  constructor(maxParts = 4096, maxPending = 16) {
    this.pending = new Map();
    this.maxParts = maxParts;
    this.maxPending = maxPending;
  }

  // Returns the whole text once every piece has arrived, else null.
  accept(data) {
    if (data[0] !== '~') return data;
    const m = /^~([0-9a-z]+):(\d+):(\d+):/.exec(data);
    if (!m) return null;
    const [head, id, k, total] = m;
    const n = Number(total);
    if (n < 1 || n > this.maxParts) return null;
    let entry = this.pending.get(id);
    if (!entry) {
      entry = { parts: new Array(n), count: 0 };
      this.pending.set(id, entry);
      if (this.pending.size > this.maxPending) this.pending.delete(this.pending.keys().next().value);
    }
    const index = Number(k);
    if (index >= n || entry.parts[index] !== undefined) return null;
    entry.parts[index] = data.slice(head.length);
    entry.count++;
    if (entry.count < n) return null;
    this.pending.delete(id);
    return entry.parts.join('');
  }
}
