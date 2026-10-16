# Addressing dialog

The dialog that opens from a control's settings icon: what the control is
assigned to (device, MIDI, Control Chain, CV), its label, range and the
settings that go with the assignment. It replaces MOD's addressing window
(`html/include/addressing.html`, `hardware.js` `open()`).

Figma: the mobile mock-up `22:1942` (390 × 646). Built straight in code (no
Figma component): `nhe/components/controls/addressing.js`, playground
`playground/addressing.html`.

## Layout

- **Phone:** full screen.
- **Tablet and desktop:** the same 390 px layout in a centred card over a
  black overlay at 60 %. Content height, scrolls inside when taller than the
  screen.
- **Header:** the plugin name on the accent bar, with the control's name in
  a white pill (label style) to show which control this is for. For the
  plugin on/off and presets, the pill says "On/off" / "Presets".
- **Assign to:** two bordered lists side by side.
  - Left: the binding type (None, Device, MIDI, Control Chain, CV). A type
    MOD can't offer for this control is not shown (as MOD does).
  - Right: what the type offers.
    - Device: the actuators (Footswitch 1, Knob 1, …). One already in use
      elsewhere is greyed out.
    - Control Chain and CV: the available actuators / CV ports.
    - MIDI: no list; the right side shows MOD's message instead: press Save,
      then move the control on the MIDI device. When already mapped:
      "Mapped to MIDI Ch.1 CC#7. To map a different control, press Save and
      move it; Cancel keeps the current mapping."
    - Nothing available: MOD's message (no Control Chain device, all its
      actuators in use, no CV ports and how to add one).
    - None: empty.
- **More settings** (shown directly, no "Advanced" layer), each a titled
  row with a Segmented control, only when it applies. They come straight
  after Assign to, since they belong to the assignment; the control's own
  label and range follow them:
  - Sensitivity: Low / Medium / High (device knobs, not for MIDI or CV);
  - Mode: Latching / Momentary on / Momentary off (footswitches, for
    toggles);
  - LED colour: Static / Cycle (footswitches with coloured LEDs, for lists);
  - CV range: −10–0 / ±5 / 0–+10 (plugin CV ports);
  - Tempo: a toggle "Follow tempo" plus the note values, for controls MOD
    can sync to tempo; Min / Max and Sensitivity are switched off while it
    is on.
- **Control label:** a text field, the control's name by default.
- **Min / Max:** two number fields. Hidden for toggles, triggers and lists
  (MOD does the same).
- **Cancel / Save** at the bottom (Secondary / Primary text buttons). Save is
  off when there is nothing to save (None on a control that had no
  assignment, or no CC / CV source). Enter saves, Escape cancels.

## NHE extras

A row of two icon-and-label items under the settings, above Cancel / Save:

- **Minimise control** (ArrowsIn), sliders only: switches the slider to its
  minimised state (half width, display only, not adjustable in the panel;
  the Slider "Narrow" design). On a minimised slider the same item reads
  **Expand control** (ArrowsOut) and switches it back. Other control types
  don't show the item.
- **Add to surface** (Star), shown disabled for now. Later: a separate
  performance surface that gathers the starred controls from every plugin
  on the pedalboard on one screen.

Minimised is NHE's own state, kept per browser (like the NHE / MOD view),
per plugin instance and control. Like the rest of the dialog it takes effect
on Save; Cancel leaves it as it was. Save stays available when only the
minimised state changed, even if MOD has nothing to save.

## Implementation

MOD's own form does the work for the assignment: the adapter opens it hidden, the dialog sets
its fields (type buttons, device cells, selects, inputs) and presses its
Save, so MOD's checks and saving (`saveAddressing`) run unchanged. MOD's Save is only pressed when something MOD keeps has changed; the minimised state is saved by NHE.

- The dialog draws from a model (`state()`, `setType`, `setTarget`,
  `setSetting`, `setTempo`, `setDivider`, `save`, `cancel`). On MOD the model
  is `NHE.mod.addressing(instance, symbol)` in the adapter; the playground
  has a fake one with a Duo's knobs and footswitches.
- MOD's labels are kept, except the CV range options (MOD's are sentences:
  "+ Unipolar (0 to +10)" becomes "0 – +10 V").
- MOD Desktop marks Device and Control Chain as locked (an upsell card in its
  own window). The dialog lists them and says they need a MOD device; Save
  stays off.
- The dialog and its lists scroll by drag (`NHE.dragScroll`), since MOD
  blocks touch scrolling.
- Settings feature: a control's settings icon opens this dialog in the NHE
  view; MOD's view keeps MOD's window. Minimised sliders are kept in
  `localStorage['nhe-minimised']` (`{ 'instance/symbol': true }`).
