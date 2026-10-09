// Visiting an island from Node: the other half of what the keeper does. A
// host's page is a PeerJS peer under the island's code (see net.js); this
// registers a peer of its own on the same signaling service, under a random
// id, dials the host the way a PeerJS page would (an OFFER for a data
// connection with "raw" serialization), and carries the game's messages over
// the data channel, long ones in pieces (framing.js). WebRTC comes from
// node-datachannel, as for the keeper.
//
// An island on this computer's own dedicated server needs none of that:
// localLink() attaches straight to its Room.
import { EventEmitter } from 'node:events';
import { peerIdFor } from '../public/js/shared/codes.js';
import { Reassembler, sendText } from '../public/js/shared/framing.js';
import { randomHex } from '../public/js/shared/keeper.js';
import { ICE_SERVERS, Signaling } from './keeper.js';

const CONNECT_TIMEOUT_MS = 25000;
const PING_MS = 4000;
const SILENCE_MS = 20000;

function parse(text) {
  try {
    const msg = JSON.parse(text);
    return msg && typeof msg === 'object' ? msg : null;
  } catch {
    return null;
  }
}

// Emits 'open' once the data channel is open, 'message' with each message,
// and 'close' (with why) once, after which it is done. send(msg) sends one.
export class PeerLink extends EventEmitter {
  constructor({ code, rtc, server, iceServers = ICE_SERVERS, prefix = 'kids-world-friend-' }) {
    super();
    this.target = peerIdFor(code);
    this.rtc = rtc;
    this.iceServers = iceServers;
    this.connectionId = `dc_${randomHex(6)}`;
    this.signaling = new Signaling({ id: `${prefix}${randomHex(8)}`, server });
    this.pieces = new Reassembler();
    this.pc = null;
    this.dc = null;
    this.closed = false;
    this.opened = false;
    this.lastSeen = Date.now();
    this.signaling.on('state', (state, detail) => {
      if (state === 'online' && !this.pc) this.dial();
      else if (state === 'error' && !this.opened) this.close(`signaling: ${detail}`);
    });
    this.signaling.on('message', (msg) => this.onSignal(msg));
    this.timer = setTimeout(() => {
      if (!this.opened) this.close('the island did not answer');
    }, CONNECT_TIMEOUT_MS);
    this.signaling.start();
  }

  dial() {
    const pc = new this.rtc.PeerConnection(this.connectionId, { iceServers: this.iceServers });
    this.pc = pc;
    const id = this.connectionId;
    const dst = this.target;
    pc.onLocalDescription((sdp, type) => {
      if (type !== 'offer') return;
      this.signaling.send({ type: 'OFFER', dst, payload: { sdp: { type, sdp }, type: 'data', connectionId: id, label: id, serialization: 'raw', reliable: true } });
    });
    pc.onLocalCandidate((candidate, mid) => this.signaling.send({ type: 'CANDIDATE', dst, payload: { candidate: { candidate, sdpMid: mid, sdpMLineIndex: 0 }, type: 'data', connectionId: id } }));
    pc.onStateChange((state) => {
      if (state === 'failed' || state === 'closed') this.close('the connection went');
    });
    // Making the channel starts the offer.
    const dc = pc.createDataChannel(id);
    this.dc = dc;
    dc.onOpen(() => {
      if (this.closed) return;
      this.opened = true;
      clearTimeout(this.timer);
      this.lastSeen = Date.now();
      // Nothing more to say to the signaling service.
      this.signaling.stop();
      this.beat = setInterval(() => this.heartbeat(), PING_MS);
      this.emit('open');
    });
    dc.onMessage((data) => {
      if (this.closed || typeof data !== 'string') return;
      this.lastSeen = Date.now();
      const text = this.pieces.accept(data);
      const msg = text == null ? null : parse(text);
      if (msg) this.emit('message', msg);
    });
    dc.onClosed(() => this.close('the island closed the connection'));
    dc.onError(() => this.close('the connection broke'));
  }

  onSignal(msg) {
    const p = msg.payload ?? {};
    if (msg.type === 'EXPIRE' || (msg.type === 'LEAVE' && msg.src === this.target)) {
      if (!this.opened) this.close('the island is not open');
      return;
    }
    if (p.connectionId !== this.connectionId || !this.pc) return;
    try {
      if (msg.type === 'ANSWER' && typeof p.sdp?.sdp === 'string') this.pc.setRemoteDescription(p.sdp.sdp, 'answer');
      else if (msg.type === 'CANDIDATE' && typeof p.candidate?.candidate === 'string' && p.candidate.candidate) {
        this.pc.addRemoteCandidate(p.candidate.candidate, typeof p.candidate.sdpMid === 'string' ? p.candidate.sdpMid : '0');
      }
    } catch {
      // a description or candidate it cannot use
    }
  }

  heartbeat() {
    if (Date.now() - this.lastSeen > SILENCE_MS) this.close('the island went quiet');
    else this.send({ t: 'ping' });
  }

  send(msg) {
    if (this.closed || !this.dc?.isOpen()) return;
    try {
      sendText({ send: (piece) => this.dc.sendMessage(piece) }, JSON.stringify(msg));
    } catch {
      this.close('the connection broke');
    }
  }

  close(why = 'closed') {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.beat);
    this.signaling.stop();
    const { dc, pc } = this;
    // Not from inside one of its own callbacks.
    setImmediate(() => {
      try {
        dc?.close();
      } catch {
        // already closed
      }
      try {
        pc?.close();
      } catch {
        // already closed
      }
    });
    this.emit('close', why);
  }
}

// The same for an island of this process's dedicated server (server.js's
// rooms): its Room hears this link as one more connection.
export class LocalLink extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.closed = false;
    this.conn = {
      send: (text) => {
        const msg = parse(text);
        if (msg) queueMicrotask(() => !this.closed && this.emit('message', msg));
      },
      close: () => queueMicrotask(() => this.close('the island said goodbye')),
    };
    room.attach(this.conn);
    queueMicrotask(() => !this.closed && this.emit('open'));
  }

  send(msg) {
    if (!this.closed) this.room.receive(this.conn, JSON.parse(JSON.stringify(msg)));
  }

  close(why = 'closed') {
    if (this.closed) return;
    this.closed = true;
    this.room.detach(this.conn);
    this.emit('close', why);
  }
}
