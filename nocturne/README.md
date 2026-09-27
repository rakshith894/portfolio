# Nocturne - Rakshith

An atmospheric, playable graveyard portfolio built with React, TypeScript, Three.js, and Sites/Vinext.

The link opens a landing page featuring Rakshith and the original moonlit artwork. Next enters the 3D graveyard with a visible human character standing at the start of the cobblestone path. The camera follows the character through the stormy cemetery to the Gothic house. The overview control frames the whole island and returns to the following camera.

The landing page preserves `public/graveyard.png` with animated candlelight. Next enters the island; View portfolio opens the work directly without loading the 3D scene. The back arrow in the graveyard returns to the landing page.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Local URL printed by the server.

Windows development uses polling and excludes generated output and scratch files from watching to avoid file-lock errors.

## Explore the island

Use WASD or the arrow keys to walk relative to the camera, and Shift to run. Drag the scene to look around; scroll or pinch adjusts the camera within a close following range. Hold the on-screen directional buttons to walk on touch devices. Losing focus or hiding the page clears movement input.

Default movement uses a brisk 2.6 m/s jog and Shift runs at 5.2 m/s. Captured walk/run playback is calibrated to the original clip's measured travel and the character's scale, with a phase-preserving transition and hysteresis between gaits. Foot placement only resolves ground penetration, preserving raised swing feet and the captured body motion. Starts, turns, and vertical camera motion ease smoothly.

The shore descends through four longer stair flights with level turn landings to the relocated dock. Exterior tower flights reach the rooftop, a short approach joins the viaduct, and the manor steps can be climbed. Rendered treads and walking heights share one layout; risers are at most 18 cm. Route finding checks height changes so it cannot shortcut between different stair levels.

Terrain cuts have recessed floors and retaining faces, with closed masonry shoulders alongside the stairs to prevent sea-visible gaps. Decorative rocks remain clear of the stair corridors and turn landings. The watchtower battlements leave the stair entrance open. Navigation checks each turn from the traveller's actual position before advancing, avoiding clipped corners. Coastal rocks and stair supports share their positions with boat collisions, with a clear departure channel from the dock.

Tap the ground or choose a destination from Places to follow a collision-checked route from your current position. Places lists seven main destinations: landing, graves, manor, backyard, boat, bridge, and tower. Route planning shows immediate feedback and yields between small batches so controls stay responsive. Stop travelling, Escape, manual movement, or another destination cancels pending planning. Escape also closes the menu.

Places journeys run at 5.2 m/s. The traveller briefly faces the camera and says “We're heading to [place],” starting the route after a quarter-second while narration continues. He turns back to say “We've arrived at [place]” on arrival. A temporary speech bubble follows his head and clears after each line. Speech is triggered by the destination selection independently of optional ambience. Changing destinations, manual movement, and Stop travelling cancel the current announcement. If speech is unavailable, the bubble supplies the announcement without delaying travel.

The player walks around the front graveyard with collisions for graves, boulders, trees, fences, gate posts, lanterns, and cliff edges. The gates open away from the path. At the house steps, press E or Enter the house to open the galleries. Returning from the house places the character near its entrance, facing back toward the path.

Manor walls, wings, towers, terrace foundations, and the closed front door share their dimensions with movement collisions. The entrance steps stop at the doorway, and the follow camera stays outside the house walls when exploring the backyard.

- The ocean has three rolling wave systems, analytic surface normals, reflective water, and animated coastal foam.
- Three large fish periodically breach offshore, with turning tails, water spray, and expanding splash rings.
- Crows flap, glide, and bank in low cemetery passes and a separate high flock. Wind carries layered storm clouds and rain across the moonlit sky, with occasional distant lightning; low mist drifts around the cliffs and lantern flames flicker.
- The detailed lunar disc stays fixed while the sky's cloud banks drift and a second cloud layer passes in front. Additional warm lamps illuminate the side paths, bridge, and stair landings; a fixed pool of nearby lights limits GPU work on desktop and mobile.
- Handrails share their geometry with collision segments. Gate leaves swing away from the path and remain solid, lamp posts block movement, and swept traversal checks prevent shortcuts through thin fences.
- Weathered crosses, pointed headstones, chest tombs, obelisks, and broken monuments have modeled carvings and lichen, with fewer graves and rain streaks on narrow displays.
- Atmosphere runs continuously; there is no Play/Pause control. Reduced-motion preferences remove decorative character bob and gestures while walking, running, seated poses, and weather continue. Hidden tabs stop advancing the scene.
- Sound is optional and begins only after pressing the sound button. Footsteps follow walking distance, gate hinges creak when opening or closing, and nearby haunting sites trigger directional moans and whispers with cooldowns. Distant bells toll in the cemetery, thunder follows the lightning, and rowing strokes produce wood creaks and water sounds.
- Narration selects identified English male voices only. If none is installed, captions replace speech; the browser's default female voice is never substituted.
- Voice commands show listening, recognition, and microphone errors on screen; leaving the island cancels speech and microphone input.
- Rock textures use consistent projection across each triangle. Boats float on the same animated ocean as the shore, with water masked out of their open hulls.
- At Boat Landing, use Board the boat or E. WASD and touch arrows row at 9 m/s; Shift increases speed to 14 m/s. Tap open water for a route, or choose Return to dock. The boat waits for input, coasts briefly when released, then settles. Paired wooden oars sweep and lift with each stroke; the seated traveller faces the stern and grips both handles. Offshore travellers also row. Step ashore is available only near the dock. The traveller and boat follow the waves.
- The ocean follows the camera without a travel boundary. Four occupied boats (two on mobile) travel offshore and repopulate beyond the nearby view on long journeys. Shoreline clearance, bridge clearance, and boat separation prevent sailing through obstacles.
- The fence beside the manor has a clear passage, with rocks and graves kept away from its opening. Duplicate corner posts and overlapping bridge wall pieces are removed; bridge walls leave openings for both stair routes.
- Low grave mist, six slowly appearing shrouded figures (four on mobile), drifting veils, glowing eyes, and cold grave lights add haunting effects. Additional warm lanterns illuminate the backyard, side paths and long stair flights.

The 3D architecture is a real-time interpretation of the reference, not an exact photographic reconstruction. The house opens the existing gallery and portfolio components.

## Validation

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Checks cover every destination and stair route on desktop and mobile, fence and bridge collisions, the manor-side passage, human gait and sitting, long-distance sailing, safe return routes, occupied offshore traffic, camera-following water, weather, and preserved portfolio logic. These are deterministic source and geometry checks, not GPU rendering verification.

The scene shares geometry and materials, merges static scenery, and uses simpler meshes for small scattered rocks. Rendering caps total canvas pixels and adapts resolution after sustained slow frames, while keeping the interface crisp. Shadows refresh at 15 Hz, the nearby lamp pool uses six lights on desktop and three on mobile, and ghosts use unlit glow geometry to avoid shader recompilation when appearing. Distant boat passengers update at 12 Hz. Narrow displays target 30 fps, hidden tabs stop simulation, and resources release on unmount. Device frame rates and final visual fidelity require browser verification.

## Assets

- Sky and social artwork: original AI-generated Nocturne images.
- Photographic surface maps: Poly Haven CC0 assets, documented in `public/materials/ATTRIBUTION.md`.
- Gothic gate statues: Poly Haven CC0, with source URLs and verified source checksums in `public/models/coast/attribution.json`.
- Architecture, terrain, fallback player character, wildlife, and ambient audio: generated locally.
- The island loads `public/models/human-traveller.glb`, a realistically proportioned civilian from Microsoft's MIT-licensed Rocketbox library with textured skin, hair, a sweater, and trousers. It includes matching idle, walking, running, waving, and sitting animations. Attribution and license are in `public/models/HUMAN-ATTRIBUTION.md` and `HUMAN-LICENSE.txt`. This is a generic human avatar, not Rakshith's likeness. The loading overlay waits for the real traveller; the procedural character appears only if the model request fails.
