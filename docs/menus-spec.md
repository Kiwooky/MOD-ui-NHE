# Menu bars, top and bottom (draft)

NHE's top and bottom bars for MOD's page, phone and desktop / tablet.
Figma: section "Touch friendly constructor menus" (`201:2996`): seven phone
screens (390 × 844) and six desktop / tablet screens (2321 × 1433).

Status: desktop / tablet bars built (first step); the phone's to come.

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
  (when MOD offers it). Save and Snapshots drop a panel down: Save / Save
  as (MOD's own name window for a new name), Save snapshot / Save snapshot
  as, and Load / manage snapshots (MOD's window). Snapshot chips under the
  bar when the board has more than one; a tap loads it.
- **Bottom:** Constructor, Library, Banks, File manager, Store (the current
  one orange with its name; MOD Desktop's locked ones greyed), then on the
  right the device-only items when MOD shows them, the CPU / RAM meters
  and xruns, tempo, Play / Stop, CV ports, Performance view, Report a
  problem.
- Still to do here: MOD's Library, Banks, File manager and Store windows
  cover the top bar (the designs keep it), and the snapshot chips haven't
  been tried with a board that has several snapshots.
