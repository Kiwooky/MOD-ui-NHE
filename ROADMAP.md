# Status and roadmap

Where NHE stands and what comes next. For how it works and how to install it, see [README.md](README.md); the design specs are in [docs/](docs/).

## Working now

Tested with MOD Desktop (MOD 1.14) in Chrome, with a mouse.

- **Plugin settings screen** in MOD's settings window: sliders, toggles, triggers, option lists, presets, file lists (NAM models, IRs, with Tone3000 browsing), plugin on/off, stacking into columns, sideways scrolling by drag, trackpad or arrows. System bar with tempo, CPU / RAM, xruns and the signal chain. NHE / MOD switch.
- **Addressing dialog**: assign a control to MIDI, CV and (on a device) footswitches and knobs, with label, range and MOD's extra settings; minimise / expand sliders.
- **Plugin colours**: one of MOD's colours per plugin type.
- **Preset Save as / Rename** in NHE's name dialog.
- **Performance view**: the pedal carousel; Flip and Hide on the centred pedal; the back of a flipped pedal is its settings screen; the chain jumps between backs; hidden pedals in a grid tile.

## Not tested yet

- On a MOD device (Duo, Duo X, Dwarf): footswitch and knob assignment and their settings (sensitivity, latching / momentary, LED colour), tempo sync, the File Manager and Banks, which MOD Desktop hides.
- On a tablet with touch.
- Saving a real preset through the name dialog.
- The browser tests in `test/` after the performance view's flip (see test/README.md).

## Next

- Run it on a Duo and a tablet; fix what turns up.
- **Add to surface**: a performance surface that gathers starred controls from every plugin on the pedalboard on one screen. The star is in the addressing dialog, switched off for now.
- Text parameters (e.g. Button to CV's labels), not handled by the NHE screen yet: use the MOD view.
- Offer the performance view (`nhe/features/performance/performance.js` and `.css`) back to mod-ui: they are written to work without the rest of NHE, with MOD's own settings panel on a pedal's back.
