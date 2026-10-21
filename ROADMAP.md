# Status and roadmap

Where NHE stands and what comes next. For how it works and how to install it, see [README.md](README.md); the design specs are in [docs/](docs/).

## Working now

Tested with MOD Desktop (MOD 1.14) in Chrome, with a mouse.

- **Plugin settings screen** in MOD's settings window: sliders, toggles, triggers, option lists, presets, file lists (NAM models, IRs, with Tone3000 browsing), plugin on/off, stacking into columns, sideways scrolling by drag, trackpad or arrows. System bar with tempo, CPU / RAM, xruns and the signal chain. NHE / MOD switch.
- **Addressing dialog**: assign a control to MIDI, CV and (on a device) footswitches and knobs, with label, range and MOD's extra settings; minimise / expand sliders.
- **Plugin colours**: one of MOD's colours per plugin type.
- **Preset Save as / Rename** in NHE's name dialog.
- **Settings screen tools** under the plugin's name: colour, info page, delete (with a yes / no; the signal path is healed as if the plugin were bypassed). Under them the plugin's GUI picture (180 px at most; not on short screens), the presets taking the rest.
- **Phones**: held upright, NHE's screens and dialogs are scaled up so the system bar, the presets and one slider fill the width (MOD lays its page out 980 px wide); held sideways, NHE's screens use the full width, past the notch areas, while they show.
- **Performance view**: the pedal carousel; Flip and Hide on the centred pedal; the back of a flipped pedal is its settings screen; the chain jumps between backs; hidden pedals in a grid tile.

- **NHE's builder (first step)**: SET → Builder: NHE shows the constructor surface over MOD's builder on the real pedalboard. Checked in MOD Desktop: wiring by hand, moving a pedal, adding one with the + dialog and inserting one with a cable's + all change MOD's board, and survive a reload. A tapped face zooms to 100% and plays (MOD's own GUI); tall pedals take one cell; a double click zooms out to the whole grid.

- **Menu bars (desktop / tablet)**: NHE's top and bottom bars in place of MOD's (SET → Menus): name and snapshot, New, Snapshots, Save panels, snapshot chips; screens, meters, tempo, play, CV, performance, report (docs/menus-spec.md).

## Not tested yet

- NHE's builder: Rewire on a phone; loading another pedalboard while it shows; touch on a tablet; the Duo.

- On a MOD device (Duo, Duo X, Dwarf): footswitch and knob assignment and their settings (sensitivity, latching / momentary, LED colour), tempo sync, the File Manager and Banks, which MOD Desktop hides.
- On a tablet with touch.
- Saving a real preset through the name dialog.
- The browser tests in `test/` after the performance view's flip (see test/README.md).

## Next

- **Slider titles get cut off** (seen on the Duo): a minimised slider's title can be clipped at the column edge ("FEEDBACK" shows as "FEEDBAC"), and possibly a regular slider's too. Check whether it is the title's width / overflow or the next column drawn over it (stacking order).
- **Locked slider's fill at 50 % opacity:** while CV drives a slider (thumb parked at the bottom), the grey fill showing the value can be half-transparent: still visible, less distracting.
- **Darker overlay behind dialogs:** the 60 % black under NHE's dialogs (`--nhe-surface-scrim`) can go a bit darker.
- **Control settings full screen on a phone**, not a card over the overlay. The dialog already has a full-screen layout for narrow screens (`@media (max-width: 480px)` in controls.css), but it never applies: MOD's page is laid out 980 px wide on a phone, so it needs to go by the phone itself (as `NHE.zoom` does) instead.
- **System bar, Chain tab:** bigger IN / OUT headings and cards (a larger font), so the chain is easier to step through. Explore how to hop through parallel chains (where a plugin feeds or is fed by more than one): harder, but worth trying.
- **System bar, Meters tab** (the "dashboard"): CPU / RAM need not take all the height. It could hold actions that now mean a trip to the builder: transport (start / stop, for MIDI clock), snapshots, and so on.
- **Phones and tablets, MOD's own screens:**
  - On first load, MOD's top and bottom bars need proper scaling for the screen.
  - The builder (constructor) should be about wiring: fewer tap interactions on a pedal there, so taps don't fight with making connections.
  - When pedals are shown below a certain size, all plugin editing goes to the settings screen rather than the pedal's own controls.
  - Bigger icons above each pedal (in proportion), so they are easy to hit on tablets, phones and small screens.
- Run it on a Duo and a tablet; fix what turns up.
- **Add to surface**: a performance surface that gathers starred controls from every plugin on the pedalboard on one screen. The star is in the addressing dialog, switched off for now.
- Text parameters (e.g. Button to CV's labels), not handled by the NHE screen yet: use the MOD view.
- Offer the performance view (`nhe/features/performance/performance.js` and `.css`) back to mod-ui: they are written to work without the rest of NHE, with MOD's own settings panel on a pedal's back.
