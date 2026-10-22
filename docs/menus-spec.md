# Menu bars, top and bottom (draft)

NHE's top and bottom bars for MOD's page, phone and desktop / tablet.
Figma: section "Touch friendly constructor menus" (`201:2996`): seven phone
screens (390 × 844) and six desktop / tablet screens (2321 × 1433).

Status: desktop / tablet bars and the phone's (held upright) built.

## What the designs show

### Desktop / tablet

**Top bar** (dark, one row):

- Left: MOD's logo, then the pedalboard's name with its snapshot
  (UNTITLED - DEFAULT).
- Right, icon buttons: **New** (sparkle, with its label), **Snapshots**
  (camera), **Save** (floppy), **Share**.
- Under the bar, over the surface's top left: the board's **snapshots as
  chips** (INTRO, VERSE, CHORUS, INTERLUDE), the current one in the accent
  colour. A tap loads that snapshot.
- **Save** drops a small panel down under the bar, at the right: two
  choices with radio buttons, *Save* (the board's name beside it) and
  *Save as*, then Cancel / Save. ("Placement of save/snapshot menus".)

**Bottom bar** (dark, one row):

- Left, the main screens: **Constructor** (puzzle), **Library** (book),
  **Banks** (four dots), **File manager** (folder), **Store** (cart). The
  current one shows its label (CONSTRUCTOR, LIBRARY) and an orange icon;
  the others are icons only.
- Right: **meters** (gauge icon, CPU and RAM as two thin bars with their
  %), the **xruns** count in a red pill, **tempo** (metronome, 120BPM),
  **Play** (transport), **CV** (the diamond: Manage CV ports), **Report a
  problem** (speech bubble).
- The Library, Banks, File manager and Store frames show the same bars,
  only the active item changes (their content is MOD's own screens).

### Phone

**Top bar**: MOD's logo, the pedalboard's name and snapshot, a camera at
the right (snapshots). Under it, the snapshot chips, as on desktop.

**Bottom bar**, five buttons with labels: **New** (sparkle), the
**meters** (gauge, with CPU and RAM as two small coloured numbers, 50 / 17),
**Menu** (three dots), **Tempo / Play** (play icon, 80bpm), **Save**
(floppy). The open one is orange.

- **Menu** opens a full-height list over the surface (× to close):
  Constructor, Plug-in store, Library, Banks, File manager, Manage CV ports,
  Global tempo & sync, Share your setup, Report a problem.
- **Save** opens a panel above the bottom bar: *Save* (with the name) /
  *Save as* as radio choices, a name field for Save as, Cancel / Save.
- **Snapshots** (the camera, orange while open) opens a panel under the top
  bar: *Save snapshot* / *Save snapshot as* (with a name field), Cancel /
  Save, then **Load / manage snapshots**: a list (the current one
  highlighted) with Rename and Delete under it.

## How it maps onto MOD

Everything goes through MOD's own controls or HTTP endpoints, as the rest
of NHE does (the adapter). MOD's own bars stay in the page, hidden.

| Item | MOD |
| --- | --- |
| Name / snapshot | `desktop.title`, the snapshot name (`/snapshot/name`, ws) |
| Snapshot chips | `/snapshot/list`, `/snapshot/load?id=` |
| Save snapshot / as | MOD's Snapshots menu: `.js-preset-save`, `.js-preset-save-as` (`/snapshot/save`, `/snapshot/saveas`) |
| Load / manage, rename, delete | `/snapshot/list`, `/snapshot/rename`, `/snapshot/remove` (snapshot.js) |
| New | `.js-reset` (MOD's own "are you sure") |
| Save / Save as | `.js-save`, `.js-save-as` (desktop.js; Save as asks for a name: NHE's field, MOD's checks) |
| Share | `.js-cloud` (hidden on MOD Desktop) |
| Constructor, Library, Banks, File manager, Store | `#mod-plugins`, `#mod-pedalboard`, `#mod-bank`, `#mod-file-manager`, `#mod-cloud-plugins` |
| CPU, RAM, xruns | `#cpu-bar-text`, `#ram-bar-text`, `#mod-xruns` (NHE.mod.stats already) |
| Tempo | `desktop.transportControls` (NHE.mod.tempo / setTempo already) |
| Play | the transport's `:rolling` port (`transport-rolling` over the ws) |
| CV ports | `#js-cv-addressing-toggle` |
| Report a problem | `#mod-report` |

## Not in the designs

MOD's footer also has, on a device: the **Bypass 1 / 2** buttons, **MIDI
ports**, the **device settings** gear, the **update** and **devices**
status icons, and NHE's own **Performance view** (bolt). Decided: on
desktop / tablet they're small icons in the bottom bar's right group; on a
phone, extra rows in the Menu list.

## Building it

Decided:

- NHE's bars replace MOD's **everywhere** (MOD's builder too), with their
  own SET switch (Menus: NHE / MOD), independent of the builder choice.
- **Desktop / tablet first** (top and bottom bars, snapshot chips, the Save
  panel), then the phone bars, then the Snapshot panel and the Menu list.
- A feature (`nhe/features/bars/`, off with `nhe-bars`); MOD's own bars
  stay in the page, hidden, and NHE's buttons drive them.

## Built so far (desktop / tablet)

`nhe/features/bars/` (preference `nhe-bars`; SET → Menus, NHE's by
default): NHE's top bar inside MOD's `#pedalboard-actions` and its bottom
bar inside `#main-menu`, MOD's own contents hidden (they still run: NHE's
items click them). 45 px tall, as MOD's.

- **Top:** MOD's logo, the board's name and snapshot, New (with its label),
  Snapshots, Save (an orange dot while there are unsaved changes), Share
  (when MOD offers it). Save and Snapshots drop a panel down: Save / Save as, Save snapshot / Save snapshot as; picking an *as* shows a field for the new name (the current one suggested), and NHE answers MOD's own name window with it, so MOD saves as usual. Under the Snapshots choices, Load / manage snapshots lists them (the current one highlighted): a tap loads one, the pencil renames it in place, the bin deletes it after a yes.
- **Bottom:** Constructor, Library, Banks, File manager, Store (the current
  one orange with its name; MOD Desktop's locked ones greyed), then on the
  right the CPU / RAM meters and xruns (as tall as the bar), tempo, Play /
  Stop, Bypass 1 and 2 (a device only; framed in orange while true bypass
  is on) and the sliders button. That opens a menu up from the bar: MIDI
  ports, Manage CV ports, Global tempo & sync, Performance view (only with
  MOD's builder: NHE's has the bolt beside a zoomed-in pedal's gear), Report a
  problem, Devices, System settings, and System is up to date / Update
  available (an orange dot on the button while one waits), each when MOD
  shows it (MIDI ports, Devices, Settings and Update on a device only). The
  device-only items used to sit in the bar, where on the Duo they ended up
  behind the meters.
- **Tempo and sync** (the tempo button): NHE's dialog in place of MOD's
  transport window (components/controls/tempo.js), centred, full screen on
  a phone. The sync mode list with the transport (stop / play) under it,
  then BPM and beats per bar as sliders; each settings icon opens NHE's
  addressing dialog for MOD's `/pedalboard/:bpm`, `:bpb` or `:rolling`. BPM
  is locked while MIDI clock drives it, and can't be assigned under Link or
  MIDI clock (as in MOD).
- Still to do here: MOD's Library, Banks, File manager and Store windows
  cover the top bar (the designs keep it).

## Built: the phone (held upright)

When `NHE.zoom() > 1` (MOD's page shrunk onto an upright phone) both bars
take `is-phone`: drawn at the design's 390 px across the screen (CSS zoom,
`--nhe-bar-zoom`), 64 px top and 62 px bottom in the design's px. NHE's
builder keeps clear of them (`--nhe-bars-top` / `--nhe-bars-bottom`).

- **Top:** logo, name and snapshot, the camera (Snapshots panel, full width).
- **Bottom:** New, the meters (CPU and RAM as two coloured numbers), Menu,
  Play / Stop with the tempo under it, Save (its panel opens up from the
  bar, full width; the orange dot for unsaved changes).
- **Menu:** a list from the top bar down to the bottom one (× closes it):
  Constructor, Plug-in store, Library, Banks, File manager, Manage CV ports,
  Global tempo & sync, Performance view, Share your setup, Report a
  problem, and on a device MIDI ports, Bypass 1 / 2, Devices, System
  settings and the update state. The current screen's icon is lit; MOD
  Desktop's locked screens greyed.
- Held sideways (zoom 1) a phone gets the desktop / tablet bars.

