# Tour spec reference (version 1)

A tour is JSON loaded by the player at startup (`?tour=path/to/tour.json`, default `tours/demo/tour.json`). Units are metres. The coordinate system is a north-up floor plan: **X increases east (right), Z increases south (down), Y is up.** Angles are degrees.

## TourSpec

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `version` | `1` | required | |
| `title` | string | required | Shown in the HUD and start screen |
| `subtitle` | string | | |
| `wallThickness` | number | 0.18 | Rooms that abut must be spaced by exactly this amount for their shared wall to be detected |
| `roomHeight` | number | 2.7 | Default ceiling height |
| `eyeHeight` | number | 1.6 | Camera height |
| `exterior` | ExteriorSpec | city | What windows look out on |
| `start` | string | first room | Room id to start in |
| `rooms` | RoomSpec[] | required | |
| `credits` | string | | Shown on the start screen |

## RoomSpec

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | string | required | Unique |
| `name` | string | required | |
| `origin` | [x, z] | required | South-west corner. On the plan this is the **bottom-left** corner of the interior |
| `size` | [width, depth] | required | Interior dimensions along X and Z |
| `height` | number | tour default | |
| `floor` | MaterialSpec | required | |
| `walls` | MaterialSpec | required | |
| `ceiling` | MaterialSpec | off-white paint | |
| `wallOverrides` | `{ north?, south?, east?, west? }` | | Accent walls |
| `openings` | OpeningSpec[] | | |
| `furniture` | FurnitureSpec[] | | |
| `hotspots` | HotspotSpec[] | | |
| `entry` | [x, z] | room centre | Relative to origin. Where room chips and the minimap put the player |
| `entryHeading` | number | 0 | Degrees clockwise from north: 0 north, 90 east, 180 south, 270 west |
| `lights` | [x, z][] | auto | Ceiling fixtures, relative to origin. Auto places one or two |
| `area` | number | width × depth | Displayed value, so you can show the listed area |
| `photo` | string | | Reference photo URL |

Room layout rules:

- Rooms are rectangles and must not overlap.
- Two rooms share a wall when one's edge is exactly `wallThickness` away from the other's and their spans overlap. The shared wall is built once with each room's material on its own face.
- Any part of a wall with no neighbour is an exterior wall.
- Floors extend half a wall under the walls so doorways are seamless.

## OpeningSpec

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `type` | `door` \| `window` \| `passage` | required | A passage is a frameless opening you can walk through |
| `wall` | `north` \| `south` \| `east` \| `west` | required | |
| `at` | number | required | Centre along the wall, from the **west end** (north/south walls) or the **north end** (east/west walls). Left or top on the plan |
| `width` | number | required | |
| `height` | number | required | |
| `sill` | number | 0 for doors, 0.9 for windows | Bottom of the opening above the floor |
| `leaf` | boolean | false | Door only. Draws an open door leaf. It swings **away** from the room that declares it, so declare the leaf from the corridor side to have doors open into rooms |

A door between two rooms can be declared on both sides at the same world position; the two are merged. Declaring it once is enough.

## MaterialSpec

| Field | Type | Notes |
| --- | --- | --- |
| `kind` | `plaster` `paint` `wood` `tile` `concrete` `fabric` `marble` `glass` `metal` `flat` | Procedural texture generator |
| `color` | hex string | Base colour, sample it from the photo |
| `accent` | hex string | Grain for wood, grout for tile, veins for marble |
| `roughness` | 0..1 | Per-kind default |
| `metalness` | 0..1 | |
| `scale` | number | Metres per texture tile. Tile: tile pitch × 4. Wood: plank length |

## FurnitureSpec

| Field | Type | Notes |
| --- | --- | --- |
| `kind` | string | A factory name from the table below |
| `at` | [x, z] | Centre of the footprint, relative to the room origin |
| `rotation` | number | Degrees, counter-clockwise on the plan. 0 faces south (toward +Z), 90 east, 180 north, 270 west. "Faces" means the side a person uses: the front of a sofa, the foot of a bed, the doors of a wardrobe |
| `options` | object | Factory-specific, all optional |

Factories and their options. Colours are hex strings, sizes are metres.

| kind | footprint | options |
| --- | --- | --- |
| `sofa` | width × 0.95 | `width` 2.2, `color`, `cushion`, `legs` |
| `armchair` | 0.95 × 0.95 | `color`, `cushion`, `legs` |
| `coffeeTable` | width × depth | `width` 1.1, `depth` 0.6, `color`, `legs` |
| `diningTable` | width+0.2 × depth+1.3 | `width` 1.6, `depth` 0.9, `seats` 4, `color`, `legs`, `chair` |
| `bed` | width+0.1 × length+0.1 | `width` 1.6, `length` 2.0, `frame`, `mattress`, `duvet`, `pillow`. Headboard is at the back (north at rotation 0) |
| `nightstand` | 0.5 × 0.4 | `color`. Includes a lamp |
| `wardrobe` | width × 0.6 | `width` 1.8, `color` |
| `kitchenCounter` | width × 0.6 | `width` 2.8, `color` fronts, `top`, `uppers` true, `splashback` true, `splash` colour. Includes sink and hob |
| `fridge` | 0.7 × 0.68 | `color` |
| `tvUnit` | width × 0.42 | `width` 1.8, `tv` 1.4 screen width, `color` |
| `bookshelf` | width × 0.3 | `width` 1.0, `height` 2.0, `color`. Filled with books |
| `rug` | width × depth | `width` 2.0, `depth` 1.4, `color`, `accent`. Walkable |
| `plant` | 0.4 × 0.4 | `color` leaves, `pot` |
| `floorLamp` | 0.3 × 0.3 | `color` stem, `shade`. Emits light |
| `desk` | width × 1.3 | `width` 1.4, `color`, `chair`. Includes monitor and chair |
| `toilet` | 0.4 × 0.7 | Tank at the back |
| `vanity` | width × 0.48 | `width` 0.9, `color`. Mirror at the back |
| `shower` | width × depth | `width` 0.9, `depth` 0.9. Glass on the front and right |
| `bathtub` | width × 0.75 | `width` 1.7 |
| `washingMachine` | 0.6 × 0.6 | |
| `sideboard` | width × 0.45 | `width` 1.6, `color` |
| `curtain` | width × 0.12 | `width` 1.8, `height` 2.5, `color`. Two panels flanking a window; place its centre on the window centre, against the wall. Walkable |
| `artwork` | width × 0.05 | `width` 1.0, `height` 0.7, `y` 1.5 top edge, `color`, `frame`, `accent`. Hangs on the wall behind it. Walkable |

Every non-walkable piece becomes a collision box.

## HotspotSpec

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | Unique |
| `title` | string | |
| `body` | string | |
| `at` | [x, y, z] | Relative to the room origin; y is height above the floor |
| `photo` | string | URL of the reference photo. Shown in the info card so viewers can compare |

## ExteriorSpec

| Field | Type | Default |
| --- | --- | --- |
| `kind` | `city` \| `garden` \| `sea` \| `none` | city |
| `skyTop`, `skyBottom` | hex | blue gradient |
| `sunAzimuth` | degrees | 210 |
| `sunElevation` | degrees | 42 |

## Debugging a spec

The page exposes `window.estatePlayer` with `engine`, `tour`, `controls`, `exterior` and `spec`. Useful calls from the console:

```js
estatePlayer.controls.place(x, z, headingDeg)   // jump the camera
estatePlayer.tour.walkable.roomAt(x, z)          // which room is at a point
estatePlayer.tour.walkable.blockers               // furniture collision boxes
estatePlayer.engine.renderer.info.render          // draw calls and triangles
```
