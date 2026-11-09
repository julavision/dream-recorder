# Estate Player

A navigable 3D environment player for real estate. You walk through an apartment or house in the browser, room to room, with a floor-plan minimap, info hotspots, a day/night toggle, and touch controls on phones.

The scene is **code-only**. No meshes, textures or panoramas are downloaded. A tour is a small JSON file that describes rooms, openings, materials and furniture, and the player builds everything procedurally in Three.js. That spec is what an AI agent writes after looking at a handful of listing photos with the [img2threejs](https://github.com/img2threejs/img2threejs) skill, the same approach Leo Becker showed in the reel this project started from: a few photos from a developer's website in, a walkable unit out.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
npm run preview    # serve dist/
```

Open the page, click **Enter**, and walk.

| Input | Action |
| --- | --- |
| Drag | Look around (grabs the scene, street-view style) |
| W A S D / arrows | Walk, Shift to run |
| Click on the floor | Walk to that spot |
| Click a marker | Open the info card |
| Double-click | Mouse-look mode (Esc or double-click again to leave) |
| Touch, left side | Virtual joystick to walk |
| Touch, right side | Drag to look, tap to walk or open a marker |
| Minimap | Click a room to jump there |
| Room chips | Jump to a room's entry point |

Load a different tour with `?tour=tours/my-unit/tour.json`.

## What is in the box

```
src/
  spec/types.ts         Tour spec: rooms, openings, materials, furniture, hotspots
  scene/buildTour.ts    Rooms, shared walls, floors, lights, furniture, collision rects
  scene/walls.ts        Wall runs with door / window / passage openings, leaves, baseboards
  scene/furniture.ts    23 procedural furniture factories (sofa, bed, kitchen, shower, ...)
  scene/exterior.ts     Sky dome, sun, ground, city skyline or garden seen through windows
  engine/textures.ts    Canvas-generated plaster, wood, tile, marble, fabric, concrete
  engine/materials.ts   PBR materials with physical texture scale, cached
  engine/Engine.ts      Renderer, camera, environment map, frame loop
  controls/             First-person walk controls and the walkable-area collision model
  ui/                   HUD, minimap, info cards, touch joystick, start screen
public/tours/demo/      A 70 m², two-bedroom demo unit
docs/SPEC.md            Tour JSON reference
docs/PIPELINE.md        Photos -> img2threejs -> tour spec, step by step
```

## Writing a tour

A tour is a list of axis-aligned rooms on a shared floor plan (metres, X east, Z south, Y up). Walls between rooms that touch are detected automatically and built once, with each room's material on its own face. Doors declared on either side of a shared wall are merged.

```jsonc
{
  "version": 1,
  "title": "Unit 702",
  "wallThickness": 0.2,
  "rooms": [
    {
      "id": "living", "name": "Living room",
      "origin": [0, 0], "size": [5, 4.4],
      "floor": { "kind": "wood", "color": "#9c7a55", "accent": "#6e4f33" },
      "walls": { "kind": "plaster", "color": "#ece7df" },
      "openings": [
        { "type": "window", "wall": "north", "at": 1.3, "width": 1.6, "height": 1.5, "sill": 0.9 },
        { "type": "door",   "wall": "south", "at": 4.3, "width": 0.9, "height": 2.1 }
      ],
      "furniture": [
        { "kind": "sofa", "at": [3.2, 2.6], "rotation": 270, "options": { "color": "#7f8781" } }
      ],
      "hotspots": [
        { "id": "living-1", "title": "Open-plan living", "body": "...", "at": [2.4, 1.5, 1.8], "photo": "photos/living.jpg" }
      ]
    }
  ]
}
```

See [docs/SPEC.md](docs/SPEC.md) for every field and [docs/PIPELINE.md](docs/PIPELINE.md) for how to get from listing photos to this file with an agent.

## Why procedural

- A whole unit is a few kilobytes of JSON plus the player bundle. No asset pipeline, no CDN, no photogrammetry rig.
- Everything is editable in text: swap a floor, move a wall, recolour a sofa, add a hotspot. Diffs are reviewable.
- It is honest about what it is: a clean, consistent reconstruction of the layout and finishes, not a photoreal scan. Reference photos can be attached to hotspots so a viewer can compare.
- Agents are good at this. Describing a room as rectangles, openings and a palette is exactly the kind of structured output the img2threejs pipeline produces and gates.

## Roadmap

- Merge static wall and furniture geometry per material to cut draw calls (currently about 1.3k for the demo).
- L-shaped and non-rectangular rooms via polygon footprints.
- Balconies and terraces with railings and a floor-to-ceiling glass wall type.
- Ceiling variants: cove lighting, pendants, exposed beams.
- A small in-browser editor that writes the spec back out.
- Photo-matched camera views: store the camera pose for each reference photo so the agent's comparison sheets line up.
- Multi-floor tours with stairs.

## Credits

Inspired by Leo Becker's navigable room player reel and built on the ideas of the img2threejs project. Three.js does the rendering. MIT licensed.
