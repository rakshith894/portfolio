# Nocturne - Rakshith

An atmospheric, playable graveyard portfolio built with React, TypeScript, Three.js, and Sites/Vinext.

The link opens a landing page featuring Rakshith and the original moonlit artwork. Enter the island opens the 3D graveyard with a visible human character standing at the start of the cobblestone path. The camera follows the character through the stormy cemetery to the Gothic house. The overview control frames the whole island and returns to the following camera.

The landing page preserves `public/graveyard.png` with animated candlelight, a slow artwork drift, and a shared atmosphere pause control. View my work opens the portfolio directly without starting the 3D scene. Short screens can scroll to reach every control. The back arrow in the graveyard returns to the landing page.

After the landing page finishes loading, idle time prepares the island module, human model, surface maps, and sky in a shared loader cache. Automatic preparation is skipped on data-saving and 2G connections, and pending preparation is cancelled when the portfolio opens or the visitor leaves the landing page. Focusing or pointing at Enter the island also prepares the assets. Entry shows immediate button feedback followed by a loading screen; optional gate statues load independently so they cannot delay walking. Failed speculative requests allow a later retry.

## Run locally

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Local URL printed by the server.

Windows development uses polling and excludes generated output and scratch files from watching to avoid file-lock errors.

## Explore the island

Use WASD or the arrow keys to walk relative to the camera, and Shift to run. The camera smoothly turns behind the character while moving, outdoors and inside the manor. A held direction stays steady while the camera turns; changing direction uses the current view. Drag to look around temporarily, and scroll or pinch to adjust the following distance. Hold the on-screen directional buttons to walk on touch devices. Losing focus or hiding the page clears movement input.

The following camera respects the rock cutouts around the exterior stairs. It shortens its distance at walls and cliffs, then smoothly returns to the chosen zoom instead of remaining squeezed against them. Its target stays at the traveller's shoulders, and terrain checks no longer lift it abruptly onto the cliff above a stair landing.

Along the boat route, camera clearance also uses the rendered retaining walls, stair shoulders, bridge stonework, and coastal rocks. It keeps the view in front of these surfaces through the stair turns, with clearance for the camera's near plane. Desktop and mobile geometry tests check both travel directions and eight viewing angles along every flight and landing.

The small sun/moon switch in the island toolbar changes between day and night without restarting the scene or moving the character. Day mode brings a blue sky, sunlit clouds, brighter natural lighting, blue water, lighter haze, and no rain or lightning. Night mode restores the original storm. The choice is remembered on this browser when local storage is available.

Default movement uses a brisk 2.6 m/s jog and Shift runs at 5.2 m/s. Captured walk/run playback is calibrated to the original clip's measured travel and the character's scale, with a phase-preserving transition and hysteresis between gaits. Foot placement only resolves ground penetration, preserving raised swing feet and the captured body motion. Starts, turns, and vertical camera motion ease smoothly.

The shore descends through four longer stair flights with level turn landings to the relocated dock. Exterior tower flights reach the rooftop, a short approach joins the viaduct, and the manor steps can be climbed. Rendered treads and walking heights share one layout; risers are at most 18 cm. Route finding checks height changes so it cannot shortcut between different stair levels.

Terrain cuts have recessed floors and retaining faces, with closed masonry shoulders alongside the stairs to prevent sea-visible gaps. Decorative rocks remain clear of the stair corridors and turn landings. The watchtower battlements leave the stair entrance open. Navigation checks each turn from the traveller's actual position before advancing, avoiding clipped corners. Coastal rocks and stair supports share their positions with boat collisions, with a clear departure channel from the dock.

Tap the ground or choose a destination from Places to follow a collision-checked route from your current position. Places lists seven main destinations: landing, graves, manor, backyard, boat, bridge, and tower. Route planning shows immediate feedback and yields between small batches so controls stay responsive. Stop travelling, Escape, manual movement, or another destination cancels pending planning. Escape also closes the menu.

Places journeys run at 5.2 m/s. The traveller briefly faces the camera and says “We're heading to [place],” starting the route after a quarter-second while narration continues. He turns back to say “We've arrived at [place]” on arrival. A temporary speech bubble follows his head and clears after each line. Speech is triggered by the destination selection independently of optional ambience. Changing destinations, manual movement, and Stop travelling cancel the current announcement. If speech is unavailable, the bubble supplies the announcement without delaying travel.

The player walks around the front graveyard with collisions for graves, boulders, trees, fences, gate posts, lanterns, and cliff edges. The gates open away from the path. At the house steps, press E, click the front door, or choose Enter the house. The actual front door swings open, and the same character and following camera walk through the doorway into the house. The door closes behind you once you are clear. Returning follows a physical walk through the front door and down onto the steps.

Manor walls, wings, towers, terrace foundations, and the closed front door share their dimensions with movement collisions. The entrance steps stop at the doorway, and the follow camera stays outside the house walls when exploring the backyard.

- The ocean has three rolling wave systems, per-pixel wave and ripple normals, softer rough foam, and view-dependent sky reflection that changes with day/night mode. Boat motion and hull masking still use the same shared wave heights.
- Three large fish periodically breach offshore, with turning tails, water spray, and expanding splash rings.
- Crows fly across the cemetery and coast instead of circling fixed points. Low flights cross the front graveyard, high flights change their bearing between visits, and birds depart offshore before returning on another route. They face their travel direction, bank gently, and alternate wingbeats with gliding; independent offshore fades hide route resets. Wind carries layered storm clouds and rain across the moonlit sky, with occasional distant lightning; low mist drifts around the cliffs and lantern flames flicker.
- The detailed lunar disc stays fixed while the sky's cloud banks drift and a second cloud layer passes in front. Additional warm lamps illuminate the side paths, bridge, and stair landings; a fixed pool of nearby lights limits GPU work on desktop and mobile.
- Handrails share their geometry with collision segments. Gate leaves swing away from the path and remain solid, lamp posts block movement, and swept traversal checks prevent shortcuts through thin fences.
- Weathered crosses, pointed headstones, chest tombs, obelisks, and broken monuments have modeled carvings and lichen, with fewer graves and rain streaks on narrow displays.
- Atmosphere runs continuously; there is no Play/Pause control. Reduced-motion preferences remove decorative character bob and gestures while walking, running, seated poses, and weather continue. Hidden tabs stop advancing the scene.
- Sound starts automatically on the first click or keypress, with a separate narration switch that never mutes ambience. One shared audio session continues across the landing page, island, and house; later interactions recover browser-interrupted playback. Footsteps follow walking distance, gate hinges creak when opening or closing, and nearby haunting sites trigger directional moans and whispers with cooldowns. Distant bells toll in the cemetery, thunder follows the lightning, and rowing strokes produce wood creaks and water sounds.
- Narration selects identified English male voices only. If none is installed, captions replace speech; the browser's default female voice is never substituted.
- Voice commands show listening, recognition, and microphone errors on screen; leaving the island cancels speech and microphone input.
- Rock textures use consistent projection across each triangle. Boats float on the same animated ocean as the shore, with water masked out of their open hulls.
- At Boat Landing, use Board the boat or E. WASD and touch arrows row at 9 m/s; Shift increases speed to 14 m/s. Tap open water for a route, or choose Return to dock. The boat waits for input, coasts briefly when released, then settles. Paired wooden oars sweep and lift with each stroke; the seated traveller faces the stern and grips both handles. Offshore travellers also row. Step ashore is available only near the dock. The traveller and boat follow the waves.
- The ocean follows the camera without a travel boundary. Four occupied boats (two on mobile) travel offshore and repopulate beyond the nearby view on long journeys. Shoreline clearance, bridge clearance, and boat separation prevent sailing through obstacles.
- The fence beside the manor has a clear passage, with rocks and graves kept away from its opening. Duplicate corner posts and overlapping bridge wall pieces are removed; bridge walls leave openings for both stair routes.
- Low grave mist, six slowly appearing shrouded figures (four on mobile), drifting veils, glowing eyes, and cold grave lights add haunting effects. Additional warm lanterns illuminate the backyard, side paths and long stair flights.

The 3D architecture is a real-time interpretation of the reference, not an exact photographic reconstruction. The house now has a continuous Gothic hall within the island scene and an open west skills gallery, an empty dining room, and two open wing galleries. The floor plan fits the exterior main building and its side wings. Stone walls, dark wood, vaulted ribs, chandeliers, moonlit windows, candlelight, floating dust, and slowly appearing spirits match the haunted estate. The former B1–B6 lift and gallery records are removed.

Inside, WASD, arrow keys, and touch controls move the same character relative to the camera. Drag to look and use Shift to move faster. Approach a door and press E, tap, or use the door button. Room doors swing away from the visitor and close after crossing and clearing the swing area. Wall, furniture, and door collisions prevent walking through solids; an occupied threshold keeps its door open. Walk to the front door automatically navigates out of any room, opens the necessary doors, and walks outside. Opening the portfolio, hiding the page, or losing focus clears held movement. Reduced motion steadies flames, spirits, and dust while doors remain functional.

Indoor travel uses a 1.45 m/s walk with eased acceleration and a 3.1 m/s Shift run. Floor routes remove safe grid detours and carry movement continuously through turns, without pausing and restarting the gait at each waypoint. Door clearance respects the traveller's height on the stairs. The indoor camera follows the rendered shoulder height and checks the near-plane corners against the interior and exterior masonry. The atmosphere selector and action buttons wrap in separate groups, and View my work has its own full-width label space.

The west library has a two-flight wooden staircase with 32 shared rendered and walkable treads, a turn landing, and handrails. Upstairs, a side landing and hinged door lead into the existing hall, now an open master hall with tall windows and two chandeliers. Moving the stairwell to the west leaves the center clear for future use. Ground-floor passages remain accessible beneath the high timber flight. Movement cannot cross stairwell guardrails or jump between levels. Walk to the master hall navigates upstairs and opens the side door; Walk to the front door finds the way back down.

Throughout the house, the toolbar shows Day and Dark room modes and an independent Lights on/off switch. The switch extinguishes the chandeliers and their flames; daylight remains available with lamps off. Leaving the house restores the island's selected atmosphere. The room settings remain selected for the current exploration session.

Only frames you explicitly create appear in the Projects Room. Up to ten equally sized hinged glass frames fit on each collection page, on the solid side walls clear of the windows and stair door. Walnut edges, fine brass inlays, recessed warm light, and a soft wall glow replace the protruding picture lamps. Frame lighting follows the room's Lights switch and is softer in Day mode. Closed frames show proportionate exhibition covers with wrapped titles, short descriptions, and website addresses; unfilled frames have a quiet Coming soon cover. Saved frames open an embedded live demo with an Open website fallback for sites that block embedding. The former library is an open skills gallery with timber flooring and floating colored cards; the master hall uses large stone floor tiles.

Project editing is local-only. Run `npm.cmd run dev`, enter the master hall, and choose Add frame or Manage frames. Save writes the title, URL, and description to `content/hall-projects.json`. Publish the updated source to show the same collection to every visitor. Published builds have no editing controls or write endpoint; changing browser storage cannot modify the shared portfolio. The development endpoint binds to loopback, rejects remote and cross-origin writes, validates project fields, and saves atomically. Use Import browser drafts in the local editor to copy older browser-saved projects into empty frames without replacing saved projects. Open the same browser and local address used for the old drafts (for example `http://localhost:3000`); the original drafts are preserved. Frames 1–4 retain their project IDs.

## Validation

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Checks cover every destination and stair route on desktop and mobile, fence and bridge collisions, the manor-side passage, human gait and sitting, long-distance sailing, safe return routes, occupied offshore traffic, camera-following water, weather, and preserved portfolio logic. These are deterministic source and geometry checks, not GPU rendering verification.

Visual quality takes priority over frame rate. Rendering retains the earlier pixel-ratio limits (1.7 on desktop, 1.25 on mobile) without automatically lowering resolution. Desktop shadows refresh every frame; ten nearby lights on desktop and five on mobile illuminate the paths. Cold ghost lights illuminate nearby scenery, eight cliff-mist layers (four on mobile) restore the fuller atmosphere, and offshore rowers animate every frame. The scene still shares geometry and materials and merges static scenery. Narrow displays target 30 fps, hidden tabs stop simulation, and resources release on unmount. Device frame rates and final visual fidelity require browser verification.

## Assets

- Sky and social artwork: original AI-generated Nocturne images.
- Photographic surface maps: Poly Haven CC0 assets, documented in `public/materials/ATTRIBUTION.md`.
- Gothic gate statues: Poly Haven CC0, with source URLs and verified source checksums in `public/models/coast/attribution.json`.
- Architecture, terrain, fallback player character, wildlife, and ambient audio: generated locally.
- The island loads `public/models/human-traveller.glb`, a realistically proportioned civilian from Microsoft's MIT-licensed Rocketbox library with textured skin, hair, a sweater, and trousers. It includes matching idle, walking, running, waving, and sitting animations. Attribution and license are in `public/models/HUMAN-ATTRIBUTION.md` and `HUMAN-LICENSE.txt`. This is a generic human avatar, not Rakshith's likeness. The entry overlay waits for the detailed traveller or a 12-second fallback choice. That appearance remains fixed for the session, including late model responses.

September 29 scene repairs: retaining faces along the boat stairs now face the path and use world-scaled texture coordinates; the regression uses normal one-sided materials. House windows share real openings with the exterior shell, with masonry reveals, leaded glass and sills. Removed duplicated main-room ceilings and replaced the full-height stair blocks with open timber flights and stringers. Static furnishings and masonry are batched by material. Apparitions have darker hooded faces and stronger eye glow; nearby candles slowly dim with the haunting cycle. Reduced-motion mode steadies these indoor effects.

Island preparation now waits until the landing page finishes loading, then uses idle time; pointer and keyboard intent can start preparation immediately. Movement becomes available after the avatar appearance is chosen and the first scene frame renders. A stalled model download chooses the articulated fallback once, without changing the character during play.

### Hall projector and larger project collections

Press the glowing projector at the center of the entrance hall, press E while nearby, or choose Activate hologram. A translucent human floats above its light beam and the contact panel types the saved profile quickly. Show all skips the typing, Escape closes it, and reduced-motion preferences show everything immediately. Edit photo & contact details fills optional email, phone, location and social links; blank fields remain hidden.

Add frame creates exactly one new, saved frame and opens its editor. Remove this frame asks you to confirm removal of that frame and its saved project details. Removing the last frame leaves a clean gallery with an Add frame control; deleted frames do not return after a reload. Unused wall positions are hidden and cannot be clicked. Previous/next collection controls show up to ten frames per page, with no ten-project storage limit. Creation and removal are serialized by the local editor, so concurrent Add frame requests receive different IDs. Existing project IDs and content are preserved; the nine original unused placeholders have been removed. Publish after local changes to share the collection.

### Floating skills and covers

The left ground-floor room is the skills gallery. Use Edit floating skills to add a name, explanation and color, edit or remove an existing skill. Skills save to content/skills.json through the local-only editor. Every saved skill keeps a visible card. High-resolution canvas labels use measured word wrapping, adaptive heading sizes, a high-contrast text column, and clipped description previews. Soft edge lighting and a slow float keep the hologram alive without distorting its text. Open a card to read its full explanation. The first six occupy the Skills Room, the next twelve occupy the wing galleries, and further cards fill the backyard in fixed rows and tiers. All skills also provides a single scrollable reading view with every explanation; visitors never need to switch collection pages. Both former library and dining-room furniture and their collision boxes are removed. Day/dark mode and Lights on/off work throughout the house; gold and colored particles drift through both rooms.

Project frames support uploaded PNG/JPEG/WebP screenshots (up to 5 MB) and render richer colored posters when no cover is supplied. The existing chatbot frames use a captured screenshot of their live project. The first-screen image and sky now use compressed WebP copies; background asset preloading waits until the initial page has loaded.

### Public viewing, local editing

Published visitors can explore and read all portfolio content. Editing skills, projects, profile, images and resume stays available only through the local development server on this computer. Published builds omit all write middleware, and production PUT requests to the three content endpoints return 404. There is no browser password or storage flag that grants editing. After local saves, commit and publish the updated source to update public content.

Narration has an independent speaker control; footsteps and island ambience continue. Voice commands work indoors as well as outdoors. All skills shows every description together and offers Read aloud. The study furniture is removed; its wing is an extension of the skills gallery. Gold particles fill the entrance hall, both side rooms, both wings and the upper project hall. The contact hologram stays illuminated when idle. Guardian occupancy holds doors open, and blocked follower queues dissolve back onto a safe recorded trail.

## AI assistant and voice mode

The island's AI button opens a shared chat and voice assistant. The toolbar microphone opens the same assistant. Select a voice language, dictate a request, finish dictation, and send. Requests can contain multiple instructions and up to 12,000 characters. Shift+Enter inserts a newline. Browser speech recognition and installed voices determine language availability; text input always remains available.

Try “Show skills”, “Read portfolio”, “Start tour”, “Pause the tour”, “Take me to the manor”, “Change to winter mode”, or a longer request such as “Show my skills and then read them aloud; do not start a tour.” Short commands work locally without an API key. Questions and longer or multilingual instructions use Groq. Spoken replies can be switched on or off. Read aloud, pause, resume, and stop work with long content in short speech chunks. Stop cancels speech, pending AI actions, travel and tours. Closing chat or hiding the page cancels its microphone, request and reading.

The assistant can show and read published profile, skills and projects, control the narrated tour, request island travel, change the atmosphere, and invoke the available avatar and boat actions. It cannot perform arbitrary tasks outside this app or modify published content. Résumé requests open the profile's PDF access controls; PDF extraction and PDF narration are not implemented. Descriptions that have not been added are reported honestly.

Copy .env.example to .env.local and set GROQ_API_KEY for AI answers. GROQ_MODEL optionally overrides the default openai/gpt-oss-120b model served by Groq. Local secrets never enter the browser bundle; hosted secrets must be configured separately in Sites. The prior llama-3.3-70b-versatile default was retired for standard Groq accounts. See https://console.groq.com/docs/deprecations.

The API uses server-owned portfolio facts, validates message roles and sizes, rejects cross-origin requests, bounds provider timeouts, and validates every returned action against the same client/server allowlist. It never executes model-generated code or arbitrary URLs. Microphone audio is handled by the browser's speech service; sent text and published portfolio context are sent to Groq. Chat is kept in memory for the current visit.

### October 3 desktop/mobile repairs

Quick Portfolio and the island now use the same published content, including HTML. Local editing must save successfully to the project files before changes appear as saved. Commit and publish those files to share updates across devices. Published pages no longer offer browser-password editing.

Live effects follows the system motion preference by default. Its visible toggle in Quick Portfolio, the contact hologram and the island lets visitors enable or disable decorative animation explicitly, including on Windows. The guided tour sits on the left with progress markers and grouped controls. Buttons have a gentle light sweep.

Day and night share green tree canopies, with drifting and falling leaves; night adds an eerie green glow. Winter alone switches the canopy and falling particles to light pink blossoms. Reduced motion hides falling foliage. Instance counts are lower on mobile, and changing seasons reuses GPU resources.

Ground clicks can approach the nearest reachable point if the target is obstructed; walls, graves and cliff edges remain solid. Wooden perimeter rails and their collisions stay clear of manor foundations and towers. A stalled character download uses the existing animated fallback instead of blocking the island.

See [SECURITY-REVIEW.md](SECURITY-REVIEW.md) for the chat/API repairs and the remaining unpatched dependency advisory.
