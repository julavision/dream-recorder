# From listing photos to a walkable tour

This is the workflow the player is designed around: an agent looks at a few photos of a unit and writes a `tour.json`. It is the same idea as [img2threejs](https://github.com/img2threejs/img2threejs) (rebuild what is in a photo as code, gate it with renders, iterate) applied to rooms instead of objects. The output is a spec, not a mesh, so each pass is small and reviewable.

## 0. What you need

- 4 to 12 photos of the unit. Listing photos from a developer's website are enough. Wide shots of each room beat detail shots.
- Any floor-plan image or the listed areas, if available. They remove most of the guesswork about dimensions.
- An agent that can look at images: Claude Code, Codex, OpenCode or similar, with the img2threejs skill installed for the material and furniture passes.

Put the photos in `public/tours/<unit>/photos/` so hotspots can reference them.

## 1. Intake: rooms and dimensions

For each photo, record:

- which room it shows and from where (roughly where the camera stood and which wall it faces),
- the openings visible: windows (count, approximate width, sill height), doors and passages (which wall, which room they lead to),
- the finishes: floor material and colour, wall colour, any accent wall, ceiling,
- the large furniture and where it sits against which wall.

Then draw the plan. Rooms are axis-aligned rectangles on a north-up plan. If you have a floor plan, trace it. If not, estimate from the listed area and standard sizes (doors 0.8 to 0.9 m, windows 1.2 to 1.6 m, ceiling 2.6 to 2.8 m, kitchen counters 0.6 m deep, beds 1.6 × 2.0 m). Write `origin` and `size` for each room so that abutting rooms are spaced by exactly `wallThickness`.

Prompt to use with your agent:

```
Here are N photos of a two-bedroom unit (attached) and its listed area (70 m²).
Produce a tour spec in the format of docs/SPEC.md:
1. List rooms with plausible metric sizes that add up to the listed area.
2. Lay them out on a north-up plan with 0.2 m walls, spacing abutting rooms by exactly 0.2.
3. For every window and door you can see, add an opening with its wall and position.
4. Sample a floor, wall and accent colour per room from the photos as hex values.
5. Place the furniture you see with the factories in docs/SPEC.md. Do not invent pieces that are not in the photos.
6. Add one hotspot per room that cites the photo it was built from.
Output only the JSON.
```

## 2. Build and look

Save the JSON to `public/tours/<unit>/tour.json`, run `npm run dev`, open `http://localhost:5173/?tour=tours/<unit>/tour.json`.

Stand roughly where each photo was taken (`estatePlayer.controls.place(x, z, heading)` in the console) and compare against the photo. This is the img2threejs comparison-sheet step. Check in this order, because each layer depends on the previous one:

1. **Layout.** Are the rooms the right proportions? Do doors connect the right rooms? Does the minimap look like the floor plan?
2. **Openings.** Window count, size and sill height. Door positions.
3. **Materials.** Floor colour and grain direction, wall colour, accent walls, tile size.
4. **Furniture.** Presence, position, rotation, size, colour.
5. **Light.** Sun direction (`exterior.sunAzimuth`) so windows throw light the way the photos show.

Fix the spec, reload, repeat. Expect two or three passes.

## 3. Pieces the library does not have

The furniture library covers the common pieces. When a photo shows something it cannot express (a sculptural lamp, a specific kitchen island, a built-in bookcase), there are two routes:

- **Approximate** with the nearest factory and the right colours. For a real estate tour this is usually fine: the viewer needs the layout and the feel, not the exact chair.
- **Add a factory.** Run img2threejs on a crop of the object and paste its generated geometry into a new entry in `src/scene/furniture.ts`, returning `{ group, footprint }`. Keep it code-only, primitives and procedural shaders, so the tour stays small.

## 4. Ship

`npm run build` produces a static `dist/` that can be hosted anywhere (GitHub Pages, Netlify, an S3 bucket, a WordPress media folder). Each unit is its own `tours/<unit>/tour.json`. Embed with an iframe:

```html
<iframe src="https://player.example.com/?tour=tours/unit-702/tour.json" width="100%" height="600" allowfullscreen></iframe>
```

## Honest limits

- Single photos hide what is behind the camera. The agent will guess; mark guesses in hotspot text or leave those walls bare.
- Rooms are rectangles for now. L-shaped living rooms become two rooms joined by a wide `passage`.
- This is a reconstruction, not a scan. Attach the reference photos to hotspots so buyers can see the real thing next to the walkable version.
