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
- **Gallery view** (the performance view; renamed, with Figma's Gallery icon in place of the bolt): the pedal carousel; Flip and Hide on the centred pedal; the back of a flipped pedal is its settings screen; the chain jumps between backs; hidden pedals in a grid tile.

- **NHE's builder (first step)**: SET → Builder: NHE shows the constructor surface over MOD's builder on the real pedalboard. Checked in MOD Desktop: wiring by hand, moving a pedal, adding one with the + dialog and inserting one with a cable's + all change MOD's board, and survive a reload. A tapped face zooms to 100% and plays (MOD's own GUI); tall pedals take one cell; a double click zooms out to the whole grid.

- **Menu bars**: NHE's top and bottom bars in place of MOD's (SET → Menus), desktop / tablet and phone (held upright): name and snapshot, New, Snapshots (load / manage), Save panels, snapshot chips; screens, meters, tempo and sync dialog, play, bypass, and a menu for the rest (docs/menus-spec.md). Manage CV ports shows its ticks on NHE's builder.
- **Live surface**: Add to surface in a control's addressing dialog puts it on one screen with the controls picked from other plugins, each plugin's under its name and on / off as on top of its settings screen (the on / off there as soon as one of its controls is), in the colour picked for it (else the accent), at least two columns wide; a control that's on it shows a star by its settings icon on the plugin's settings screen. The bottom bar's star (left of Constructor) and the phone Menu open it; the board's snapshots run across its top (80 px, the labels as big as fits); it has the meters but no Exit, SET or Chain tab. Kept per board on the MOD; a removed plugin's controls go with it. Checked in MOD Desktop (desktop and the phone layout).
- **Dialogs fit the screen**: on a touch screen (phone or tablet) NHE's dialogs run full screen, except the short ones (delete and other yes / no, tempo and sync, a control's settings, the plugin colour, its presets file), which stay a centred card on a tablet; a card that would spill goes full screen too.
- **Morph targets** (features/morph): the live surface's system bar has a Morph tab (Figma's Target icon) beside the meters: a Morph targets switch, Set, and a message in a chain card. Switched on, a Morph slider stands before the surface's controls; Set records position A of the surface's sliders, Set again position B, and the ones that changed (up to 10) morph between them (B may be below A). It runs on the MOD: NHE adds MOD's Control to CV plugin (hidden in NHE's builder unless Show in builder is ticked), makes its output a CV source and CV-addresses each slider over A .. B, so a knob, MIDI or an expression pedal on the Morph slider works with the tablet closed. A morphed slider moved on the surface breaks free and snaps back when Morph moves; Set while some are free keeps them (in A or B, whichever Morph is nearer); Set with none free starts a new morph. Switching off releases them, A and B kept. Green ring: a slider Morph moves or can; orange: assigned to something else. Kept per board on the MOD. Checked in MOD Desktop and on a Duo (3 sliders: switching on 1.1 s, creating 0.5 s, off 0.3 s, on 0.4 s; a board loaded again unsaved gets the plugin and addressings back; the orange ring with a knob assignment).
- **Settings kept on the MOD**: NHE's settings (colours, editor, builder, menus, work surface, performance view) are stored on the MOD itself, shared by every browser that opens it; SET → Settings file exports / imports them.

## Not tested yet

- NHE's builder: Rewire on a phone; loading another pedalboard while it shows; touch on a tablet; the Duo.

- On a MOD device (Duo, Duo X, Dwarf): footswitch and knob assignment and their settings (sensitivity, latching / momentary, LED colour), tempo sync, the File Manager and Banks, which MOD Desktop hides.
- On a tablet with touch (an iPad: dialogs ran off screen before they went full screen on touch).
- Settings kept on a Duo (only MOD Desktop so far).
- Saving a real preset through the name dialog.
- Live surface: on an iPad and a phone (only the browser pane's emulation so far); removing a plugin that has controls on it; a board saved as another; with MOD's menu bars (SET → Menus → MOD) it has no button.
- The browser tests in `test/` after the performance view's flip (see test/README.md).
- Morph targets: Morph turned by a real knob or expression pedal (sweeping it from the tablet at 20 a second slowed the Duo's server to ~250 ms replies, sound fine); 10 sliders on the Duo; a board saved with it and loaded again; the gallery view shows the Control to CV pedal; the Morph tab's message is cut off on short screens.

## Next

- **Slider titles get cut off** (seen on the Duo): a minimised slider's title can be clipped at the column edge ("FEEDBACK" shows as "FEEDBAC"), and possibly a regular slider's too. Check whether it is the title's width / overflow or the next column drawn over it (stacking order).
- **Locked slider's fill at 50 % opacity:** while CV drives a slider (thumb parked at the bottom), the grey fill showing the value can be half-transparent: still visible, less distracting.
- **Darker overlay behind dialogs:** the 60 % black under NHE's dialogs (`--nhe-surface-scrim`) can go a bit darker.
- **System bar, Chain tab:** bigger IN / OUT headings and cards (a larger font), so the chain is easier to step through. Explore how to hop through parallel chains (where a plugin feeds or is fed by more than one): harder, but worth trying.
- **System bar, Meters tab** (the "dashboard"): CPU / RAM need not take all the height. It could hold actions that now mean a trip to the builder: transport (start / stop, for MIDI clock), snapshots, and so on.
- **Morph targets, footswitch with a ramp: an NHE helper plugin.** MOD only lets footswitches drive switches and lists, so a footswitch can't drive Control to CV's slider (tested on the Duo, which offered only its knobs). The plugin would replace Control to CV, with a morph slider (knob / expression), an on / off for a footswitch, a ramp time in seconds and the CV output. On the Duo, Control to CV's own Smoothing glides a fixed 0.3–0.4 s; MOD's Slew Rate Limiter (marked testing, not installed on the Duo) goes up to 1 s only.
- **Phones and tablets, MOD's own screens:**
  - On first load, MOD's top and bottom bars need proper scaling for the screen.
  - The builder (constructor) should be about wiring: fewer tap interactions on a pedal there, so taps don't fight with making connections.
  - When pedals are shown below a certain size, all plugin editing goes to the settings screen rather than the pedal's own controls.
  - Bigger icons above each pedal (in proportion), so they are easy to hit on tablets, phones and small screens.
- Run it on a Duo and a tablet; fix what turns up.
- Text parameters (e.g. Button to CV's labels), not handled by the NHE screen yet: use the MOD view.
- Offer the performance view (`nhe/features/performance/performance.js` and `.css`) back to mod-ui: they are written to work without the rest of NHE, with MOD's own settings panel on a pedal's back.
