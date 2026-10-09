// An island of this server hosted peer to peer too, the way a page hosts
// one (see net.js's HostLink): a PeerJS peer under the island's code on the
// keeper's signaling service, answering the data connections pages dial
// ("raw" serialization, long messages in pieces: framing.js), each one more
// connection to the island's Room. So a page that is not on this server, such
// as the game on GitHub Pages, can visit it. WebRTC comes from node-datachannel,
// as for the keeper. The AI friend's own island (buddy.js) is hosted so.
import { EventEmitter } from 'node:events';
import { peerIdFor } from '../public/js/shared/codes.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { ICE_SERVERS, Signaling } from './keeper.js';

const MAX_GUESTS = 16;
const CONNECT_TIMEOUT_MS = 30000;
// Pages ping every few seconds while they are there.
const SILENCE_MS = 30000;

function parse(text) {
  try {
    const msg = JSON.parse(text);
    return msg && typeof msg === 'object' ? msg : null;
  } catch {
    return null;
  }
}

// Emits 'state' (as Signaling's) while it is reachable, or not.
export class PeerHost extends EventEmitter {
  constructor({ room, rtc, server, iceServers = ICE_SERVERS }) {
    super();
    this.room = room;
    this.rtc = rtc;
    this.iceServers = iceServers;
    this.guests = new Map();
    this.signaling = new Signaling({ id: peerIdFor(room.code), server });
    this.signaling.on('state', (state, detail) => this.emit('state', state, detail));
    this.signaling.on('message', (msg) => this.onSignal(msg));
    this.stopped = false;
  }

  get state() {
    return this.signaling.state;
  }

  start() {
    this.signaling.start();
    this.sweeper = setInterval(() => this.sweep(), 5000);
    this.sweeper.unref?.();
    return this;
  }

  onSignal(msg) {
    const p = msg.payload ?? {};
    const id = p.connectionId;
    if (msg.type === 'OFFER') {
      if (p.type !== 'data' || typeof id !== 'string' || typeof p.sdp?.sdp !== 'string' || this.guests.has(id) || this.guests.size >= MAX_GUESTS || this.room.closed) return;
      this.answer(msg.src, id, p.sdp.sdp);
    } else if (msg.type === 'CANDIDATE') {
      const guest = this.guests.get(id);
      const c = p.candidate;
      if (!guest || typeof c?.candidate !== 'string' || !c.candidate) return;
      try {
        guest.pc.addRemoteCandidate(c.candidate, typeof c.sdpMid === 'string' ? c.sdpMid : '0');
      } catch {
        // a candidate it cannot use
      }
    } else if (msg.type === 'LEAVE' || msg.type === 'EXPIRE') {
      for (const guest of [...this.guests.values()]) if (guest.peer === msg.src && !guest.dc) this.drop(guest);
    }
  }

  answer(peer, id, sdp) {
    const pc = new this.rtc.PeerConnection(id, { iceServers: this.iceServers });
    const now = Date.now();
    const guest = { id, peer, pc, dc: null, conn: null, pieces: new Reassembler(), started: now, lastSeen: now, closed: false };
    this.guests.set(id, guest);
    pc.onLocalDescription((text, type) => this.signaling.send({ type: 'ANSWER', dst: peer, payload: { sdp: { type, sdp: text }, type: 'data', connectionId: id } }));
    pc.onLocalCandidate((candidate, mid) => this.signaling.send({ type: 'CANDIDATE', dst: peer, payload: { candidate: { candidate, sdpMid: mid, sdpMLineIndex: 0 }, type: 'data', connectionId: id } }));
    pc.onStateChange((state) => {
      if (state === 'failed' || state === 'closed') this.drop(guest);
    });
    pc.onDataChannel((dc) => {
      if (guest.closed || guest.dc) {
        dc.close();
        return;
      }
      guest.dc = dc;
      guest.lastSeen = Date.now();
      guest.conn = {
        send: (text) => {
          if (guest.closed || !dc.isOpen()) return;
          try {
            sendText({ send: (piece) => dc.sendMessage(piece) }, text);
          } catch {
            this.drop(guest);
          }
        },
        // A moment for what the room said last to go first.
        close: () => setTimeout(() => this.drop(guest), 200),
      };
      this.room.attach(guest.conn);
      dc.onMessage((data) => {
        if (guest.closed || typeof data !== 'string') return;
        guest.lastSeen = Date.now();
        const text = guest.pieces.accept(data);
        const msg = text == null ? null : parse(text);
        if (msg) this.room.receive(guest.conn, msg);
      });
      dc.onClosed(() => this.drop(guest));
      dc.onError(() => this.drop(guest));
    });
    try {
      pc.setRemoteDescription(sdp, 'offer');
    } catch {
      this.drop(guest);
    }
  }

  sweep() {
    const now = Date.now();
    for (const guest of [...this.guests.values()]) {
      if ((!guest.dc && now - guest.started > CONNECT_TIMEOUT_MS) || now - guest.lastSeen > SILENCE_MS) this.drop(guest);
    }
  }

  drop(guest) {
    if (guest.closed) return;
    guest.closed = true;
    this.guests.delete(guest.id);
    if (guest.conn) this.room.detach(guest.conn);
    // Not from inside one of its own callbacks.
    setImmediate(() => {
      try {
        guest.dc?.close();
      } catch {
        // already closed
      }
      try {
        guest.pc.close();
      } catch {
        // already closed
      }
    });
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.sweeper);
    this.signaling.stop();
    for (const guest of [...this.guests.values()]) this.drop(guest);
  }
}
