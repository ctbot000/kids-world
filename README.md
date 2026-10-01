# Kids World

A cozy 3D block-building island game for kids, to play together in the browser. Build with toy bricks, raise hills, plant fruit trees, invite bunnies and ducks to move in, and visit your friends' islands. Everything is made of little studded bricks.

**Play now:** <https://ctbot000.github.io/kids-world/>

![Three friends on an island: a fox saying "Let's build!", a waving bunny and a dancing panda, next to a fountain, a lamp post, a house, a flower garden and a rainbow](docs/screenshot.jpg)

1. Press **Make an island** and pick a kind of island: Sunny, Snowy, Candy or Flat Land.
2. Tell a friend your six-digit **island code** (it's at the top of the screen). They press **Visit a friend** and type it in. Up to 8 players can be on one island together.
3. Build together. Your island is saved on your device, and **My islands** opens it again later.

## What you can do

- **Build** with 16 colours of toy bricks, plus grass, sand, snow, wood, glass, lamps, star blocks, cookies, candy canes, flowers and more. There are over 50 blocks and plants in the toy box.
- **Tools:** Build, Pick up, Paint and Hills (raise, dig or flatten the land), each in three sizes, and Undo.
- **Stamps** put down a whole build in one tap: a cozy house, a castle tower, a rainbow, a fountain, a sail boat, a snowman, a flower garden and more.
- **Animal friends:** bunnies hop, chicks peck, sheep graze, ducks paddle and butterflies flutter. Pet them for hearts. Give one a fruit and it follows you around. With the Animals tool you can invite new friends to move in.
- **Treasures:** pick fruit from the trees (every island has its own fruit), find seashells on the beach, and catch star pieces after a shooting star. Plant a fruit and it grows into a tree; sprouts grow into trees too.
- **Day and night:** a long day and a short, gentle night where lamps glow. There's rain, snow or candy sprinkles, and a rainbow afterwards.
- **Your character:** be a bunny, cat, bear, puppy, fox, panda, frog, piggy, mouse or koala. Pick your fur, T-shirt and hat. Wave, dance, cheer, clap or giggle, and say things with ready-made phrases and stickers.
- **24 stickers** to collect, for things like your first brick, petting ten animals or staying up to see the stars.
- **Photos:** the 📸 button saves a picture of your island, without the buttons.
- **A little map** in the corner shows the island from above: you (the yellow arrow) and the way you are looking, your friends in their T-shirt colours, and the animals. Tap it for a big map with everyone's names. It can be switched off in ⚙️ Settings.
- **Sounds and music** are all made in the browser: pops and clicks for building, animal voices, "animal talk" babble when someone speaks, and soft music that changes at night.

## Made for kids

- **Nobody types anything.** Names are made from friendly words ("Sunny Otter"), and talking uses ready-made phrases and stickers. The island's host checks every name and message against those lists, so a changed copy of the game can't slip other words in either.
- **Island codes are six digits**, easy to read out and type, and they never spell a word.
- **The island's owner decides:** friends can be allowed to build or not, the island can be closed to new visitors, and anyone can be sent home. Undo takes back mistakes.
- **No accounts, ads or tracking.** Your character, stickers and islands are kept in this browser only.
- **Gentle by design:** there are no monsters, no falling damage and no way to get hurt. You float in water and can fly anywhere.

## Controls

| | Keyboard and mouse | Touch screen |
| --- | --- | --- |
| Walk | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrows (<kbd>R</kbd> to run) | Thumb on the left side |
| Jump | <kbd>Space</kbd> (you hop up small steps by yourself) | Jump button |
| Fly | <kbd>F</kbd>, then <kbd>Space</kbd> up and <kbd>Shift</kbd> down | Wings button |
| Look around | Drag with the mouse, scroll to zoom (all the way in to see through your own eyes) | Drag with a finger, pinch to zoom |
| Use a tool | Click (hold to keep going), right-click to pick up | Tap |
| Blocks | <kbd>1</kbd>–<kbd>0</kbd>, <kbd>E</kbd> opens the toy box, middle-click copies the block you point at | Tap the hotbar |
| Talk, emotes | <kbd>T</kbd>, <kbd>G</kbd> | 💬 and 😊 buttons |
| Take a photo | <kbd>P</kbd> | 📸 button |
| Big map | Click the little map | Tap the little map |
| Undo | <kbd>Z</kbd> | ↩️ button |
| Full screen | Full screen button, at the top or in ⚙️ Settings | The same; on an iPhone, add the game to the Home Screen and open it from there |

## Two ways to play together

**Peer to peer (the hosted page).** The browser that makes an island *is* the host: it runs the island, and friends connect to it directly over WebRTC data channels. The free [PeerJS](https://peerjs.com/) server only introduces the browsers to each other; when a direct connection is blocked, traffic goes through the TURN servers in PeerJS's default configuration. The host keeps the tab open while friends play (the island keeps running in a background tab). The island is saved in the host's browser, and reopening it from **My islands** brings it back under the same code, so friends can reconnect.

To use your own signaling server, run a [PeerServer](https://github.com/peers/peerjs-server) (`npx peer --port 9000`) and open the game with `?signal=http://localhost:9000/`. Invite links carry the setting along.

**Dedicated server.** `npm start` serves the game and hosts islands itself over WebSocket, so nobody's browser has to stay open. The page notices the server and switches to it automatically. It uses only Node's built-ins (the WebSocket protocol is implemented in [`server/websocket.js`](server/websocket.js)), so it runs anywhere Node 22+ runs. Islands with nobody on them are kept for two hours.

```bash
npm install
```

```bash
npm start
```

Then open <http://localhost:8747/>. To play with others on your network, `npm start -- --host 0.0.0.0` prints the addresses to share; `PORT` and `HOST` work too. Add `?p2p=1` to use peer-to-peer play even when the server is there.

## How it works

```
 player's browser                           host (a browser, or server/server.js)
┌───────────────────────────┐  join, moves,  ┌────────────────────────────────────┐
│ Game: world copy, you,    │  edits, pets,  │ Room: players, tokens, rules       │
│   friends, animals        │ ─────────────► │   the island (a 128×64×128 world)  │
│ Renderer (three.js):      │                │   edits → checks → everyone        │
│   chunks, sky, characters │ ◄───────────── │   animals, clock, weather, sprouts │
│ UI, input, sound          │  welcome, edits,└────────────────────────────────────┘
└───────────────────────────┘  moves, animals
```

- `public/js/shared/` is the engine, shared by the browser and the server: blocks, the world and its compact encoding (a whole island is about 50 KB), island generation, stamps, walking and swimming, aiming, the tools, the animals, time and weather, the words kids can use, and the room. It has no DOM dependencies.
- Changes appear at once for the player who made them and are sent to the host, which checks them (inside the island, a known block, not inside another player, allowed by the island's rules) and passes them to everyone. Undo only changes blocks that nobody has changed since.
- The renderer builds each 16×16 chunk into meshes: faces with soft corner shadows and smooth light (sunlight and lamp light spread block by block, Minecraft style), instanced studs on top, flowers drawn as crossed pictures that sway, fruit and shells that turn to face you, and animated water. Every texture, icon and character is drawn in code; the only image files are the favicon and the Home Screen icon drawn from it (`npm run icon`).
- The transport is interchangeable: an in-page loopback (playing alone, and the host's own player), WebRTC data channels (peer to peer, with big messages split into pieces), or WebSocket (dedicated server).

## Tests

```bash
npm test
```

- Engine: world encoding, deterministic island generation, walking, jumping, auto-jump, swimming and flying, aiming, every tool, stamps, sprouts, and the day length.
- Rendering maths without a GPU: faces wind outward and enclose the block, hidden faces are skipped, corner shadows, sunlight and lamp light, and relighting a region matching lighting everything.
- The map: the ground seen from above (looking past flowers and fruit), deeper water darker, hill shading, edits repainted with the shadow they throw, the part of a big island it follows, and directions that match the 3D view instead of mirroring it.
- Room: joining and coming back, names from the word lists only, checked edits, undo, the owner's rules, phrases and stickers only, animals, growing trees and fruit, weather, saving and loading, rate limiting.
- Server: static files and path traversal, the WebSocket handshake and framing, and islands shared by real WebSocket clients.
- Full screen: the standard calls, Safari's older prefixed ones, and iPhones, which can only get it from the Home Screen.
- End to end in headless Chrome: playing alone with real clicks, the little map (a brick you build shows on it, the big map, the switch in Settings) and where it fits on screens of every shape, full screen and the iPhone guide to the Home Screen, two friends peer to peer through a local PeerServer, two friends on the dedicated server, and an island saved and opened again after a reload. Set `CHROME_PATH` if Chrome is not installed in a standard location; without Chrome these are skipped.

## Project layout

```
public/                 the whole site; no build step
  index.html, css/, favicon.svg, apple-touch-icon.png
  js/main.js            title screen, sessions, saving, the frame loop
  js/game.js            one visit to an island: you, friends, animals, tools
  js/ui.js              toolbar, hotbar, toy box, dialogs, name tags and bubbles
  js/minimap.js         the little map in the corner and the big map of the island
  js/input.js           keyboard, mouse, touch thumbstick and buttons
  js/sound.js           sound effects, animal voices and music (Web Audio)
  js/net.js             playing alone / hosting / visiting, and the dedicated server
  js/render/            three.js: textures, chunk meshes, sky, characters, animals, effects
  js/shared/            the engine (see above)
  vendor/               three.js, PeerJS and the Fredoka font (npm run vendor)
server/                 the dedicated server and its WebSocket implementation
test/                   node:test suites
```

`public/` is deployed to GitHub Pages by the CI workflow after the tests pass.

## Privacy

- No accounts, analytics or cookies. Your character, settings, basket, stickers and islands are kept in your browser's `localStorage`.
- In peer-to-peer play the signaling server sees peer ids and connection setup data (which include IP addresses), never the game. Anyone with an island's code can visit it while it's open, unless the owner closes it to new visitors.

## License

[MIT](LICENSE). Includes [three.js](https://threejs.org/) (MIT), [PeerJS](https://github.com/peers/peerjs) (MIT) and the [Fredoka](https://github.com/hafontia/Fredoka-One) font ([SIL Open Font License](public/vendor/fonts/OFL.txt)).
