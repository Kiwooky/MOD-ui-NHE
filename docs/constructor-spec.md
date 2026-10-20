# Touch friendly constructor (draft)

A builder for phones and tablets where wiring is automatic: pedals sit on a
grid, and adding one is a single dialog that says what feeds it and where
it goes. Figma: section "Touch friendly constructor" (`201:2996`), six phone
screens and two desktop / tablet screens.

Status: being worked out with Niels; open points are marked **Open**.

## The work surface

- A grid on the work surface (SET → Work surface). It starts at the size of
  the screen.
- MOD's own ports sit on the edges: Audio In L / R and MIDI In on the left,
  Audio Out L / R and MIDI Out on the right.
- Every free cell shows a round **+**. Tapping it adds a pedal there (the
  + dialog, below).
- **Always one empty row and one empty column**, at the bottom and the right.
  An **Expand surface** button shows only when there is none left (it adds
  one). When two rows or columns are empty, one is removed again. Phone and
  desktop alike.
- **Moving around:** drag to pan, everywhere. Zoom: pinch on a phone or
  tablet; on desktop also + / − magnifier buttons. Pressing on a pedal and
  dragging may have to be kept apart from panning: panning might need to
  start next to a pedal rather than on it (to be tried).

### Pedals on the grid

- **Desktop / tablet:** the pedal's own face (its modgui). Zoomed in, the
  face can be played directly, as in MOD's builder now.
- **Phone:** a card with the pedal's preview, name and brand (as in the +
  dialog). No playable face: tapping it opens the pedal's settings screen.
- A pedal takes one cell, or **two cells wide or two tall** when its face
  needs it. **Open:** the rule. A proposal: scale the face to fit one cell;
  if its width is at least 1.8 × its height, give it two cells across (two
  down for 1.8 × taller than wide).
- **Long-press and drag** moves a pedal: it snaps to the nearest free cell
  and keeps its wiring.
- **Tapping a pedal** opens its settings screen (NHE's). Rewiring, Delete
  and Info move there too.

### Wires

- Drawn by NHE: straight runs with rounded right-angle corners, along the
  gaps between cells (MOD draws curves).
- **Desktop:** MOD's dragging from a jack to wire by hand stays, for fine
  control. **Phone:** no hand wiring (a finger isn't precise enough); the
  + dialog and the settings screen do it.

## The + dialog

Full screen on a phone; the bottom menu bar gives way to **Cancel** and
**Place**.

- At the top: category tabs (Favourites, All (238), Control Voltage (27),
  …) and a search field.
- Three columns, each scrolling on its own:
  - **Input from:** pedals on the surface that have outputs which can feed
    the new pedal, and MOD's inputs. Several can be picked; a picked one
    shows a tick.
  - **The pedal to add** (MOD's bottom bar of plugins today), narrowed by
    the tabs and the search. The picked one has a ring. Each has an **info
    icon** where the side columns show their tick: it opens the pedal's
    info over the whole dialog, with **Back** at the top (Escape too) to
    return to the dialog as it was. The same information as MOD's plugin
    info, in three columns (one on a phone): the screenshot with MOD's
    build badge (LOCAL, …); the name with a favourite star, brand, URI,
    category, author, homepage, installed version, licence, its audio /
    MIDI / CV ins and outs, **See online** and the description; then the
    control ports (default / min / max, MOD's number format) and CV ins
    and outs. MOD's Install / Upgrade / Remove are store actions, left out.
  - **Output to:** pedals and MOD's outputs, several, with ticks.
- **Order:** pick the pedal first; the side columns then list only what can
  connect to it.
- **Nearest first:** the side columns list what is nearest the tapped +
  first (grid steps across plus down; MOD's ports count as sitting just
  outside the edges). On a tie, what sits before the + (to its left) leads
  Input from, and what sits after it leads Output to.
- **Inserting:** picking X as input and Y as output, when X already feeds
  Y, puts the new pedal between them (the X → Y wire goes).
- **Series or parallel: Open.** What the prototype does now: the new pedal
  goes *in series* only when a picked input already feeds a picked output
  (that wire is replaced). Otherwise it is added *alongside*: the picked
  inputs keep feeding whatever they fed and now feed the new pedal too, and
  the picked outputs get the new pedal mixed in with what already feeds
  them. To be worked out once the prototype has been tried on a real
  surface.
- **Ports are chosen automatically** (to be tried, then refined):
  L → L and R → R; a mono output into a stereo pedal feeds both inputs;
  stereo into mono takes L; MIDI only to MIDI, CV only to CV.

## The bars (phone)

- **Top:** the pedalboard's name; Snapshots (camera).
- **Bottom**, one version only:
  - **Sparkle:** new pedalboard.
  - **Meters:** CPU / RAM, with small coloured numbers above for the load.
  - **Four dots:** the main menu: Plug-in store, Library, Banks, File
    manager, Manage CV ports, Global tempo & sync, Share your setup,
    Report a problem (Figma "iPhone 13 & 14 - 11").
  - **Play:** transport start / stop, with the tempo in BPM above.
  - **Floppy:** the save menu (Save, Save as).
- Snapshots and Save drop down from the top (Figma "- 12", "- 13").

## The bars (desktop / tablet)

- Top right: New pedalboard (sparkle), Snapshots, Save, Share; the
  snapshots as chips below (Intro, Verse, Chorus, Interlude).
- Footer: Constructor, Library, Banks, File manager, Store; CPU / RAM with
  the xrun count, tempo, Play, **CV ports** (the diamond: assign CV),
  Report a problem.

## How it maps onto MOD

- MOD keeps each pedal's position as x / y on the pedalboard: the grid
  snaps them. Connections go through MOD's own connect / disconnect (added
  to the adapter), so the device, MOD's own builder and other browsers stay
  in step.
- The wire drawing is NHE's own, over or instead of MOD's cables on this
  surface: the largest single piece.
- Built so far: the **+ dialog** (`nhe/components/constructor/add.js`,
  `constructor.css`) and the **wiring rules** (`autowire.js`, pure, no MOD),
  tried in `playground/constructor.html`: MOD Desktop's real plugin list and
  thumbnails (ports fetched when a pedal is picked, as on MOD), a pretend
  board (DS1 → Neural Amp Modeler → Bollie Delay → Dragonfly), and Place
  applying the plan to it. Not wired into MOD yet.
