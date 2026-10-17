// The 📡 Live channel on a TV: what the keeper's admin page has on air
// (shared/broadcast.js), in an element to put over the TV's picture.
//
//   YouTube: the video from YouTube, privacy-enhanced, at the same place as
//   on every other TV.
//   A video on the keeper's computer: a call to its TV station (the admin
//   page, a PeerJS peer) that sends nothing and gets the picture and sound
//   back, live.
//
// say(text) puts a line over the picture while there is no picture yet, or
// none to be had ('' clears it).
import { youtubeEmbed } from './shared/broadcast.js';

const TUNE_IN_MS = 20000;

export class LiveTv {
  // tv: from the keeper client (with zero). peerOptions: its PeerJS options.
  constructor(tv, peerOptions, say) {
    this.tv = tv;
    this.say = say;
    this.closed = false;
    this.peer = null;
    this.call = null;
    this.timer = 0;
    if (tv.kind === 'youtube') {
      this.el = document.createElement('iframe');
      this.el.className = 'tv-live';
      this.el.src = youtubeEmbed(tv, performance.now() - tv.zero);
      this.el.allow = 'autoplay; encrypted-media';
      this.el.referrerPolicy = 'strict-origin-when-cross-origin';
      this.el.title = tv.title;
      say('');
      return;
    }
    this.el = document.createElement('video');
    this.el.className = 'tv-live';
    this.el.playsInline = true;
    this.el.autoplay = true;
    this.tuneIn(peerOptions);
  }

  tuneIn(peerOptions) {
    if (typeof Peer === 'undefined' || typeof MediaStream === 'undefined') {
      this.say('📡 This TV can’t pick up the show.');
      return;
    }
    this.say('📡 Tuning in…');
    const fail = () => {
      if (this.closed) return;
      this.say('📡 No picture right now. Try again in a bit!');
      this.hangUp();
    };
    this.timer = setTimeout(fail, TUNE_IN_MS);
    const peer = new Peer(peerOptions ?? {});
    this.peer = peer;
    peer.on('error', fail);
    peer.on('open', () => {
      if (this.closed) return;
      // Nothing goes to the station: it only sends.
      const call = peer.call(this.tv.station, new MediaStream(), { constraints: { offerToReceiveAudio: true, offerToReceiveVideo: true } });
      if (!call) return fail();
      this.call = call;
      // Once for each track (the picture, the sound), the same stream each time.
      call.on('stream', (stream) => {
        if (this.closed || this.el.srcObject === stream) return;
        clearTimeout(this.timer);
        this.el.srcObject = stream;
        this.say('');
        // With sound if the browser lets it; otherwise without, and a tap for it.
        this.el.play().catch((error) => {
          if (error.name === 'AbortError' || this.closed) return;
          this.el.muted = true;
          this.el.play().catch(() => {});
          this.say('🔊 Tap for sound');
          this.el.addEventListener(
            'click',
            () => {
              this.el.muted = false;
              this.say('');
            },
            { once: true },
          );
        });
      });
      call.on('close', fail);
      call.on('error', fail);
    });
  }

  hangUp() {
    clearTimeout(this.timer);
    try {
      this.call?.close();
    } catch {
      // already closed
    }
    this.peer?.destroy();
    this.call = null;
    this.peer = null;
  }

  close() {
    this.closed = true;
    this.hangUp();
    if (this.el.tagName === 'VIDEO') {
      this.el.pause();
      this.el.srcObject = null;
    }
    this.el.remove();
  }
}
