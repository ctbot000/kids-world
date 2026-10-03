# Kids World

A cozy 3D block-building island game for kids, to play together in the browser. Build with toy bricks, raise hills, plant fruit trees, invite bunnies and ducks to move in, and visit your friends' islands. Everything is made of little studded bricks.

**Play now:** <https://ctbot000.github.io/kids-world/>

![Three friends on an island: a fox saying "Let's build!", a waving bunny and a dancing panda, next to a fountain, a lamp post, a house, a flower garden and a rainbow](docs/screenshot.jpg)

1. Press **Make an island** and pick a kind of island: Sunny, Snowy, Candy or Flat Land.
2. Tell a friend your six-digit **island code** (it's at the top of the screen). They press **Visit a friend** and type it in. Up to 8 players can be on one island together.
3. Build together. Your island is saved on your device, and **My islands** opens it again later. While the [island keeper](#the-island-keeper) is online, it keeps a copy too, and **🔑 Log in** brings you and your islands to your other devices.

## What you can do

- **Build** with 16 colours of toy bricks, plus grass, sand, snow, wood, glass, lamps, star blocks, cookies, candy canes, flowers and more. There are over 50 blocks and plants in the toy box.
- **Tools:** Build, Pick up, Paint and Hills (raise, dig or flatten the land), each in three sizes, and Undo.
- **Stamps** put down a whole build in one tap: a cozy house, a castle tower, a rainbow, a fountain, a sail boat, a snowman, a flower garden and more.
- **Animal friends:** bunnies hop, chicks peck, sheep graze and ducks paddle. Up in the air, birds flit between the treetops, the roofs and the grass, owls sleep in a tree all day and come out at night, bees go from flower to flower, seagulls circle high over the beach and butterflies flutter. Pet them for hearts. Give one a fruit and it follows you around, and a flying friend sits on your head when you stand still. With the Animals tool you can invite new friends to move in.
- **Sea creatures:** schools of fish dart about the shallows (one jumps out now and then), dolphins leap out of the sea, a whale swims out in the deep and blows water out of its blowhole, crabs walk sideways along the beach, turtles bask on the sand and paddle in the sea, and an octopus sits on the sea floor and changes colour when you pet it. Swim out to meet them; fed a fruit, a sea creature follows you as far as the water goes. Snowy islands have a little colony of penguins, which waddle, slide on their tummies and dive and leap in the sea, and seals, which lie about on the shore, clap their flippers, play with a ball and swim.
- **Treasures:** pick fruit from the trees (every island has its own fruit), find seashells on the beach, and catch star pieces after a shooting star. Plant a fruit and it grows into a tree; sprouts grow into trees too.
- **Day and night:** a long day and a short, gentle night where lamps glow. There's rain, snow or candy sprinkles, and a rainbow afterwards.
- **Your character:** be a bunny, cat, bear, puppy, fox, panda, frog, piggy, mouse or koala. Pick your fur, T-shirt and hat. Wave, dance, cheer, clap or giggle, and say things with ready-made phrases and stickers.
- **Log in** (with an [island keeper](#the-island-keeper)): your name and four secret pictures, tapped rather than typed. Logged in, you are the same on every device: your look, stickers, basket and islands come along, and what you build on one is there on the others. Players who take turns on one tablet each log in and out, and their islands never mix.
- **27 stickers** to collect, for things like your first brick, petting ten animals, a bird sitting on your head, watching a whale blow water, a penguin's belly slide or staying up to see the stars.
- **Photos:** the 📸 button saves a picture of your island, without the buttons.
- **A little map** in the corner shows the island from above: you (the yellow arrow) and the way you are looking, your friends in their T-shirt colours, and the animals. Tap it for a big map with everyone's names. It can be switched off in ⚙️ Settings.
- **Sounds and music** are all made in the browser: pops and clicks for building, animal voices, "animal talk" babble when someone speaks, and soft music that changes at night.

## Made for kids

- **Nobody types anything.** Names are made from friendly words ("Sunny Otter"), and talking uses ready-made phrases and stickers. The island's host checks every name and message against those lists, so a changed copy of the game can't slip other words in either.
- **Island codes are six digits**, easy to read out and type, and they never spell a word.
- **The island's owner decides:** friends can be allowed to build or not, the island can be closed to new visitors, and anyone can be sent home. Undo takes back mistakes.
- **No ads or tracking, and no accounts unless you want one.** Your character, stickers and islands are kept in this browser, with a copy at the [island keeper](#the-island-keeper) whenever it's online. ⚙️ Settings → **Safe copies** turns the copies off. A login is only your made-up name and four secret pictures, kept by that keeper: no email, nothing to type, and nobody else's computer.
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

**Dedicated server.** `npm start` serves the game and hosts islands itself over WebSocket, so nobody's browser has to stay open. The page notices the server and switches to it automatically. It uses only Node's built-ins (the WebSocket protocol is implemented in [`server/websocket.js`](server/websocket.js)), so it runs anywhere Node 22+ runs. Islands with nobody on them are kept for two hours. Once it is set up, the same command also runs the [island keeper](#the-island-keeper).

```bash
npm install
```

```bash
npm start
```

Then open <http://localhost:8747/>. To play with others on your network, `npm start -- --host 0.0.0.0` prints the addresses to share; `PORT` and `HOST` work too. Add `?p2p=1` to use peer-to-peer play even when the server is there.

## The island keeper

A computer of your own can keep a copy of every player's islands and of who they are, so nothing is lost when a browser is cleared or a tablet is replaced. Players keep using the hosted page: whenever the keeper is online, their browsers send it what changed since last time, peer to peer, the way friends visit an island. While it is away, the copies wait in each browser for next time.

To make your computer the keeper, once:

```bash
npm run keeper-setup
```

This creates the keeper's peer id and key pair in `~/.kids-world` (or the folder in `--data` or `KIDS_WORLD_DATA`), and writes the public half to `public/keeper.json`, which is how pages find the keeper. Commit and deploy that file. From then on `npm start` puts the keeper online for as long as it runs, and <http://localhost:8747/admin/> shows what it has kept: each player with their stickers and basket, and their islands drawn from above, with a download of any day's copy and deletes. A downloaded island opens in the game with **My islands → 📂 Open an island file**. The admin pages answer only the computer they run on.

- **Reaching it.** The keeper joins the PeerJS signaling service under the peer id in `keeper.json`, and answers data connections with [node-datachannel](https://github.com/murat-dogan/node-datachannel) (WebRTC for Node, with ready-built binaries for macOS, Linux and Windows). It needs no open ports, no tunnel and no account anywhere.
- **Trusting it.** Anyone can take that peer id while the keeper is away, so a page sends nothing until the keeper has signed the page's fresh random number with the private key whose public half is in `keeper.json`. The data channel is encrypted end to end, as every WebRTC channel is.
- **What it keeps.** Each island's latest copy, and one copy a day for the last 30 days it was played; each player's name, look, basket, what they've done and their stickers. Never the tokens that let players back into islands, nor their settings. A browser files its copies under a hash of a secret only it knows, so nobody can overwrite anyone else's. It stops taking copies at 2 GB.
- **Its key.** The private key is in `~/.kids-world/keeper.json`: keep that file private, and back it up with the copies. `npm run keeper-setup -- --new` makes a new one; pages then send nothing until the new `keeper.json` is deployed.
- **Logins.** 🔑 **Log in** → **Make my login** turns the copies a browser has sent into a player you can log in as: your name, and four secret pictures of sixteen, picked twice. On another device, **Log in** asks for the name, a word at a time, and the pictures; that device gets a token of its own, and from then on it sends its copies to the player and brings back what the player's other devices sent: the newest copy of each island (owned by you there too), the look, name and basket changed last, every sticker and the most of everything done. An island you say goodbye to on one device goes from the others too; the keeper still has its copies. Logging out keeps that player's things on the device, apart from the guest's, for the next time they log in there. The keeper keeps the pictures and tokens only as hashes; after five wrong tries a name waits ten minutes, and wrong pictures and a name with no login get the same answer. A player who forgot their pictures gets new ones on the admin page, which also takes a login away (every device logged in as them is logged out). Logging in needs the keeper to be online; playing never does.

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
- Flying animals: where they start out; twenty minutes of flight on every kind of island without flying into a hill, a tree or a house; owls up at night and the others by day; bees at the flowers; seagulls up high; staying in when they are in a house; and a fed one following you onto your head.
- Sea creatures: where they start out; twenty minutes on every kind of island with the swimmers never out of the water, the whale never in the shallows and crabs never out of their depth; dolphins leaping, the whale spouting and fish jumping; the sea asleep at night; a crab walking sideways; a fed one following you as far as the water goes; back into the water when theirs is taken away; penguins and seals on snowy islands, ashore and in the sea, diving, leaping and sliding, and asleep ashore at night; and every animal's model in every state.
- Rendering maths without a GPU: faces wind outward and enclose the block, hidden faces are skipped, corner shadows, sunlight and lamp light, and relighting a region matching lighting everything.
- The map: the ground seen from above (looking past flowers and fruit), deeper water darker, hill shading, edits repainted with the shadow they throw, the part of a big island it follows, and directions that match the 3D view instead of mirroring it.
- Room: joining and coming back, names from the word lists only, checked edits, undo, the owner's rules, phrases and stickers only, animals (flying ones invited over water come in above it, sea creatures at the nearest water they can live in), growing trees and fruit, weather, saving and loading (an island from before the flying animals, the sea creatures or the penguins and seals gets them, once), rate limiting.
- Server: static files and path traversal, the WebSocket handshake and framing, and islands shared by real WebSocket clients.
- Keeper: islands filed by device with one copy a day, profiles without tokens, what it refuses (other games' files, damaged islands, too much), its signatures, and admin pages only the computer itself can use.
- Logins: making one, logging another device in with the name and pictures (an island's "Sunny Otter 2" too), the wait after wrong pictures, two players with one name, tokens, new pictures and logging out; a player's islands coming back to each device (newer copies win, goodbyes reach the other devices unless changed there since); merging two devices' profiles; the protocol without WebRTC (nothing secret before the keeper's signature, and pages from before logins still answered); and the admin pages' new pictures and removing a login.
- Full screen: the standard calls, Safari's older prefixed ones, and iPhones, which can only get it from the Home Screen.
- End to end in headless Chrome: playing alone with real clicks, a bird invited from the toy box, petted with a click and fed until it sits on your head, a fish petted through the water, the little map (a brick you build shows on it, the big map, the switch in Settings) and where it fits on screens of every shape, full screen and the iPhone guide to the Home Screen, two friends peer to peer through a local PeerServer, two friends on the dedicated server, an island saved and opened again after a reload, a page sending copies to a keeper peer to peer (and nothing to an impostor under its peer id), a login made on one device logging in another (the same name, look and islands both ways, owned there too, until it logs out), and the keeper's admin page. Set `CHROME_PATH` if Chrome is not installed in a standard location; without Chrome these are skipped.
- CI has no mouse, so there the game is in touch mode, with the thumbstick and the touch buttons on screen; on a computer with a mouse it is not. To run the end-to-end tests the way CI does, which matters for anything that moves the buttons:

  ```bash
  E2E_NO_MOUSE=1 npm test
  ```

- CI has no GPU either: Chrome draws in software there, on a slow CPU, and a frame can take seconds, so anything the tests wait for that is timed on the wall clock can run out between two frames there and never on a fast computer. On a Mac, keeping Chrome to the efficiency cores comes close to CI:

  ```bash
  CI=1 E2E_NO_MOUSE=1 taskpolicy -c background npm test
  ```

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
  js/keeper.js          sending copies to the island keeper
  keeper.json           where the island keeper is, and its public key (npm run keeper-setup)
  js/render/            three.js: textures, chunk meshes, sky, characters, animals, effects
  js/shared/            the engine (see above)
  vendor/               three.js, PeerJS and the Fredoka font (npm run vendor)
server/                 the dedicated server and its WebSocket implementation
  keeper.js, admin.js   the island keeper, its store, and its admin pages (admin/)
test/                   node:test suites
```

`public/` is deployed to GitHub Pages by the CI workflow after the tests pass.

## Privacy

- No analytics or cookies, and no accounts unless you make a login. Your character, settings, basket, stickers and islands are kept in your browser's `localStorage`, each logged-in player's apart from the guest's.
- While the [island keeper](#the-island-keeper) is online, it gets a copy of your islands, and of your name, look, basket, what you've done and your stickers; never your settings or tokens. Whoever runs the keeper can see and download those copies. ⚙️ Settings → **Safe copies** turns this off for your browser; logged in, copies always go, as that is what a login is for.
- A login is your made-up name and four secret pictures, kept at the island keeper as a hash, with a hash of each logged-in device's token. Pages send none of it, nor anything else, until the keeper has proved who it is.
- In peer-to-peer play the signaling server sees peer ids and connection setup data (which include IP addresses), never the game. Anyone with an island's code can visit it while it's open, unless the owner closes it to new visitors.

## License

[MIT](LICENSE). Includes [three.js](https://threejs.org/) (MIT), [PeerJS](https://github.com/peers/peerjs) (MIT) and the [Fredoka](https://github.com/hafontia/Fredoka-One) font ([SIL Open Font License](public/vendor/fonts/OFL.txt)).
