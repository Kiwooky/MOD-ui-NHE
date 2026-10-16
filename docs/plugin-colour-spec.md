# Plugin colour

A plugin can take one of MOD's colours in place of the system accent
(purple), so a reverb can be green everywhere it shows in NHE.

## Behaviour

- A palette icon (Phosphor Palette, Figma `84:17231`) at the right of the coloured bar with the plugin's name
  (the plugin header, top of the settings panel) opens the picker.
- The picker is a dialog in the addressing dialog's frame: the plugin name
  with a "Colour" pill, then a grid of swatches. **System** (two cells wide)
  goes back to the theme purple. Tapping a swatch selects it and previews it in
  the dialog; Save applies it, Cancel or Escape leaves it as it was.
- The colour belongs to the plugin type: every copy of it, on every
  pedalboard. Kept per browser in `localStorage['nhe-plugin-colours']`
  (`{ pluginUri: '#rrggbb' }`).
- It recolours that plugin's settings panel (header bar, slider fills and
  zero-crossing tint, selected rows, segments, toggles, focus outlines,
  primary buttons, the system bar's active tab) and its addressing dialog.
  The NHE / MOD switch keeps the system colour.

## Palette

MOD's 32 port-group colours (`--group-N-color`, in tokens.css as
`--nhe-color-mod-group-N`) minus the extremes, which are left out rather
than adjusted:

- near-black ones (relative luminance below 0.03: `#341b05`, `#080f1f`)
  would vanish into the dark panel and the slider tracks;
- pale ones (luminance above 0.35, e.g. `#ebe65a`, `#81dea8`, `#dfb6a5`)
  can't carry the white text on headers, selected rows and buttons.

That leaves 21 colours. `accent-strong` (the zero-crossing tint, pressed
buttons) is the colour darkened to 58 %, as purple-800 is to purple-500.

## Implementation

`nhe/components/controls/colour.js`: `NHE.accent.palette()`,
`NHE.accent.apply(element, hex)` (sets `--nhe-accent-default`,
`--nhe-accent-strong`, `--nhe-selection` and `--nhe-border-focus` on the
element; the last two have to be set as well, since on `:root` they resolve
to the system accent before they inherit) and `NHE.ColourDialog`. The
plugin header shows the button when it's given `onColour`. The plugin's URI
comes from `NHE.mod.pluginInfo(instance).uri`. Playground:
`playground/addressing.html` ("Pick a colour").
