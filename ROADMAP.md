# Status and roadmap

Where NHE stands and what comes next. For how it works and how to install it, see [README.md](README.md); the design specs are in [docs/](docs/).

## Working now

Tested with MOD Desktop (MOD 1.14) in Chrome, with a mouse.

- **Plugin settings screen** in MOD's settings window: sliders, toggles, triggers, option lists, presets, file lists (NAM models, IRs, with Tone3000 browsing), plugin on/off, stacking into columns, sideways scrolling by drag, trackpad or arrows. System bar with tempo, CPU / RAM, xruns and the signal chain. NHE / MOD switch.
- **Addressing dialog**: assign a control to MIDI, CV and (on a device) footswitches and knobs, with label, range and MOD's extra settings; minimise / expand sliders.
- **Plugin colours**: one of MOD's colours per plugin type.
- **Preset Save as / Rename** in NHE's name dialog.
- **Settings screen tools** under the plugin's name: user presets to / from a file, colour, info page, delete (with a yes / no; the signal path is healed as if the plugin were bypassed). Under them the plugin's GUI picture (180 px at most; not on short screens), the presets taking the rest.
- **Phones**: held upright, NHE's screens and dialogs are scaled up so the system bar, the presets and one slider fill the width (MOD lays its page out 980 px wide); held sideways, NHE's screens use the full width, past the notch areas, while they show.
- **Performance view**: the pedal carousel; Flip and Hide on the centred pedal; the back of a flipped pedal is its settings screen; the chain jumps between backs; hidden pedals in a grid tile.

- **NHE's builder (first step)**: SET → Builder: NHE shows the constructor surface over MOD's builder on the real pedalboard. Checked in MOD Desktop: wiring by hand, moving a pedal, adding one with the + dialog and inserting one with a cable's + all change MOD's board, and survive a reload. A tapped face zooms to 100% and plays (MOD's own GUI); tall pedals take one cell; a double click zooms out to the whole grid.

- **Menu bars**: NHE's top and bottom bars in place of MOD's (SET → Menus), desktop / tablet and phone (held upright): name and snapshot, New, Snapshots (load / manage), Save panels, snapshot chips; screens, meters, tempo and sync dialog, play, bypass, and a menu for the rest (docs/menus-spec.md). Manage CV ports shows its ticks on NHE's builder.
- **Live surface**: Add to surface in a control's addressing dialog puts it on one screen with the controls picked from other plugins, each plugin's under its name in a bar as on top of its settings screen, in the colour picked for it (else the accent), its on / off first (there as soon as one of its controls is); a control that's on it shows a star by its settings icon on the plugin's settings screen. The bottom bar's star (left of Constructor) and the phone Menu open it; the board's snapshots run across its top (80 px, the labels as big as fits); it has the meters and SET but no Exit or Chain tab. Kept per board on the MOD; a removed plugin's controls go with it. Checked in MOD Desktop (desktop and the phone layout).
- **Dialogs fit the screen**: on a touch screen (phone or tablet) every NHE dialog runs full screen; elsewhere a card that would spill goes full screen too.
- **Settings kept on the MOD**: NHE's settings (colours, editor, builder, menus, work surface, performance view) are stored on the MOD itself, shared by every browser that opens it; SET → Settings file exports / imports them.

## Not tested yet

- NHE's builder: Rewire on a phone; loading another pedalboard while it shows; touch on a tablet; the Duo.

- On a MOD device (Duo, Duo X, Dwarf): footswitch and knob assignment and their settings (sensitivity, latching / momentary, LED colour), tempo sync, the File Manager and Banks, which MOD Desktop hides.
- On a tablet with touch (an iPad: dialogs ran off screen before they went full screen on touch).
- Settings kept on a Duo (only MOD Desktop so far).
- Saving a real preset through the name dialog.
- Live surface: on an iPad and a phone (only the browser pane's emulation so far); removing a plugin that has controls on it; a board saved as another; with MOD's menu bars (SET → Menus → MOD) it has no button.
- The browser tests in `test/` after the performance view's flip (see test/README.md).

## Next

- **Slider titles get cut off** (seen on the Duo): a minimised slider's title can be clipped at the column edge ("FEEDBACK" shows as "FEEDBAC"), and possibly a regular slider's too. Check whether it is the title's width / overflow or the next column drawn over it (stacking order).
- **Locked slider's fill at 50 % opacity:** while CV drives a slider (thumb parked at the bottom), the grey fill showing the value can be half-transparent: still visible, less distracting.
- **Darker overlay behind dialogs:** the 60 % black under NHE's dialogs (`--nhe-surface-scrim`) can go a bit darker.
- **System bar, Chain tab:** bigger IN / OUT headings and cards (a larger font), so the chain is easier to step through. Explore how to hop through parallel chains (where a plugin feeds or is fed by more than one): harder, but worth trying.
- **System bar, Meters tab** (the "dashboard"): CPU / RAM need not take all the height. It could hold actions that now mean a trip to the builder: transport (start / stop, for MIDI clock), snapshots, and so on.
- **Phones and tablets, MOD's own screens:**
  - On first load, MOD's top and bottom bars need proper scaling for the screen.
  - The builder (constructor) should be about wiring: fewer tap interactions on a pedal there, so taps don't fight with making connections.
  - When pedals are shown below a certain size, all plugin editing goes to the settings screen rather than the pedal's own controls.
  - Bigger icons above each pedal (in proportion), so they are easy to hit on tablets, phones and small screens.
- Run it on a Duo and a tablet; fix what turns up.
- Text parameters (e.g. Button to CV's labels), not handled by the NHE screen yet: use the MOD view.
- Offer the performance view (`nhe/features/performance/performance.js` and `.css`) back to mod-ui: they are written to work without the rest of NHE, with MOD's own settings panel on a pedal's back.
