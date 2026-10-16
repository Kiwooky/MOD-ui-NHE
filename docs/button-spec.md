# Buttons: toggles, triggers, plugin on/off, icon and text buttons

Status: draft, 2026-10-16. Design source: Figma "MOD-ui-NHE": the iPad mock-up (`26:2667`; Tempo mode `26:2930`, Tap `26:2940`, Tails `26:2948`, plugin on/off `26:2762`), the standalone column `22:2112` (same controls, grey bands), and the slider settings modal (`22:2190`, Cancel / Save). Builds on the slider: same column, band, title, footer, binding and tokens (`docs/slider-spec.md`).

## What MOD does today (mod-ui 1.14)

| MOD control | Port | Widget | Behaviour |
|---|---|---|---|
| **Toggle** (`.mod-switch`) | `toggled` property | `film` (`modgui.js`) | Click or tap flips between minimum and maximum. Drag and wheel also change it (one step). Shift-click goes the other way. |
| **Trigger** (`.mod-footswitch-image`) | `trigger` property | `film` | Press sends the maximum; the plugin resets it. No click or wheel. |
| **Momentary toggle** | `toggled` + `preferMomentaryOnByDefault` / `…OffByDefault`, or a momentary hardware binding | `film` / `switchWidget` | Press sets one value, release the other; clicks are ignored. (Separate "momentary inputs" spec later.) |
| **Plugin on/off** (bypass) | the special `:bypass` port | `bypassWidget` + `bypass-light` | A toggle with the meaning inverted: value 1 = bypassed, so the switch shows ON when the value is 0. Bindable like any control. |
| **Preset buttons** | — | `.preset-btn-*` | Save, Save as, Rename, Delete, Assign all; disabled per preset (factory presets can't be renamed or deleted; save only when modified). |
| **Bound** (any of the above) | — | `setPortEnabled` / `addressPort` | **With feedback** (MIDI; hardware by default): stays adjustable. **Without feedback** (CV; actuators marked so): locked, touch refused with the "blocked" notice, value still updates live. |

## Components

### 1. Toggle (on/off control)

Sits in the same 120 px column as a slider: band (group), title, the switch, footer (settings + binding icon). Replaces `.mod-switch` for `toggled` ports.

- **Switch:** an 88 × 88 rocker, radius 8, on the track gradient with the track's inner shadow. A 55 px dark pad (thumb gradient, black 1 px edge) and a 33 px label band:
  - **On:** label band "ON" at the **top**, pad at the bottom (pressed down).
  - **Off:** pad at the top, label band "OFF" at the **bottom**.
- **Interaction:** a tap anywhere on the switch flips it. Enter / Space when focused. No drag, no wheel (MOD's drag-to-toggle is easy to trigger by accident while scrolling a tablet).
- **States:** On, Off, Hover (white 2 px ring, desktop), Pressed (while the finger is down), Bound (shared: normal look, binding icon in the footer), Binding info (overlay), Locked (grey, binding icon on the pad only), Blocked (Locked + orange ring + overlay).
- **No minimised version:** button cells are always slider width (120); they save space by stacking instead (see Stacking).

### 2. Trigger (Tap)

A round 88 px button like the slider thumb (outer and inner disc, same gradients and black edge), in the same column. Replaces `.mod-footswitch-image` for `trigger` ports.

- **Interaction:** press sends the maximum (as MOD does); release does nothing; the plugin resets the value.
- **States:** Rest, Hover, **Pressed** (accent ring, like the slider's Fine state, while the finger is down, and at least 150 ms so a quick tap is visible), Bound (footer icon), Binding info, Locked (binding icon in the centre), Blocked.

### 3. Plugin on/off (bypass)

Top of the panel, under the plugin name: a 140 × 32 horizontal switch, radius 8, inner shadow, next to the settings icon and the binding icon.

- **On (plugin active):** white half with "ON" in black, pad on the left.
- **Off (bypassed):** not drawn yet (see open questions).
- **Interaction:** tap flips it. Bindable (usually to a footswitch): Bound shows the icon next to settings; Locked greys the switch and puts the icon on the pad; Blocked and Binding info as above.

### 4. Icon buttons

32 px icons in `icon/default`, 44 × 44 touch target. Used for the preset actions (save as, save, rename, delete) and the footer icons.

- **States:** Rest, Hover (desktop), Pressed (50 % opacity), Disabled (35 % opacity, no touch) for actions MOD disables.

### 5. Text buttons

Pill buttons (radius full), 48 px high, 16 px semibold upper case, from the slider settings modal:

- **Primary** (Save): `accent/default` fill, white text.
- **Secondary** (Cancel): transparent, 1 px white outline, white text.
- **States:** Rest, Hover, Pressed (darker: `accent/strong` for primary, 10 % white fill for secondary), Disabled (35 % opacity).

Not in this spec: the FACTORY / USER switch and preset list (single selects, next spec), and momentary inputs.

## Stacking

Buttons are cells in a column as wide as a slider (120) and as tall as the slider area, so a stack of buttons takes the room of one slider instead of one slider each.

0. **What stacks:** button cells (toggles, triggers) and option-list cells (select spec); sliders never do.
1. **Segments.** Walk the plugin's controls in MOD's port order and split them into segments: a stretch of controls in the same port group, or a stretch of ungrouped controls between groups.
2. **Gather the buttons of a segment** (decision: gather). Within a segment, all stackable controls (toggles, triggers, option lists) are taken out and placed together as one stack, **where the first of them was**. Sliders (and other controls) keep their order. Buttons never move to another segment.
3. **Fill, then wrap.** A stack fills a column top to bottom with cells of their own height (169 for buttons, 241 for a 3½-row list); when the next cell doesn't fit, it starts a new column to the right. At the default height (646: band 44 + 602 for cells) a column holds **3 cells** (3 × 169 = 507).
4. **Spare height stays at the bottom** (decision): cells keep their 169 px and are top-aligned; the column ends with empty space, as in the iPad mock-up.
5. **Height follows the panel.** Cells per column = floor((slider height − 44) / 169), at least 1.
6. **A group change always starts a new column** (decision), so every column has exactly one group band, at the top (Start / Middle / End / Single across the group's columns, name on the first). Since buttons never leave their segment, this follows from rule 2.
7. **Dividers:** a 1 px `border/divider` line between cells, none above the first cell in a column.

**Scroll hint** (Figma `81:17110`): when the panel is wider than the screen, a 60 px overlay sits at the right edge of the scrolling area, as tall as the columns: a fade from transparent to `surface/base` with the white ArrowFatLineRight icon (32, right-aligned, vertically centred). It shows only while there are more columns to the right and fades out at the end. Tapping the arrow scrolls right by most of a screen. Code: `NHE.scrollHint(element)` in `panel.js`.

Mock-up: Figma section **Layout / Settings panel** (`81:15319`), a full panel built from the components with two groups and a stack that wraps (Delay: [Sync, Ping-pong, Freeze] → [Tails, Reverse]).

Example: an ungrouped run `Gain (slider) · Bypass tails (toggle) · Tone (slider) · Tap (trigger) · Mix (slider)` becomes `Gain · [Bypass tails, Tap] · Tone · Mix`: one column holding two cells instead of two columns.

## Decisions (2026-10-16)

| Topic | Decision |
|---|---|
| Toggle colours | **Coloured bands** (iPad mock-up): the ON band in `accent/default`, the OFF band in `accent/strong`. |
| Plugin on/off when bypassed | **Mirror it:** pad moves to the right, the left half turns dark grey with "OFF" in white, and the plugin name bar greys out. |
| Crossed-out plug icon | An earlier generic binding indicator. That spot is where the **binding-type icon** appears when the bypass is bound (MIDI, CV, Device, Control Chain); nothing shows there when unbound. |
| Toggle interaction | **Tap only** (and Enter / Space); no drag, no wheel. |
| Stacking | Buttons of a segment are **gathered** into one stack where the first was; a group change starts a new column; spare height stays at the bottom. |
| Trigger feedback | **Accent ring while pressed**, held for at least 150 ms so a quick tap is visible. |
| Bound vs Locked | As the slider (refinement 12): **Bound** (shared) = normal, binding icon next to settings; **Locked** = grey, the icon moves onto the control face (pad, button centre); a touch shows **Blocked** (orange ring + overlay). Overlay: kind / detail / Shared or Locked. |

Note: `accent/strong` is now the darker `purple/800` (slider refinement 11), so the OFF band is darker than in the iPad mock-up (`purple/700`). Check it when the component is built.

## The components (Figma, built 2026-10-16)

Section **Control / Buttons** (`81:13934`), next to Control / Slider. All colours, radii, spacing and type sizes are bound to the variables. New Theme roles: `border/divider` (grey 500), `surface/switch-on` (white), `text/on-switch` (black), also in `tokens.css`.

| Set | Variants | Properties |
|---|---|---|
| **Control / Toggle** (`81:14111`) | `Value` On · Off × `State` Rest · Hover · Pressed · Bound · Binding info · Locked · Blocked (120 × 169) | `Title`, `Binding type` (swap: MIDI, CV, Device, Control Chain; drives the pad icon and the footer icon together), `Binding kind`, `Binding label` |
| **Control / Trigger** (`81:14186`) | `State` Rest · Hover · Pressed · Bound · Binding info · Locked · Blocked | as Toggle |
| **Control / Plugin on-off** (`81:14264`) | `State` On · Off · Bound · Binding info · Locked · Blocked (240 wide) | `Plugin name`, `Binding type`, `Binding kind`, `Binding label` |
| **Button / Icon** (`81:14277`) | `State` Rest · Hover · Pressed · Disabled (44 × 44) | `Icon` (swap: Sliders, FilePlus, FloppyDisk, PencilSimpleLine, Trash) |
| **Button / Text** (`81:14294`) | `Variant` Primary · Secondary × `State` Rest · Hover · Pressed · Disabled | `Label` |

An **Examples** board (`81:14295`) shows them together: the plugin header with preset actions (rename and delete disabled for a factory preset), a stacked column like the iPad mock-up (Tempo mode on, Tap, Tails off and bound to a device, shared), and Cancel / Save.

Notes:
- **Cells stack.** Toggle and Trigger are 120 × 169 cells (title 33, control 88, footer 48) with a 1 px `border/divider` line along the top, so a column of them reads like the mock-up. The group band sits once at the top of the column, not in each cell.
- **Hover / Pressed washes** are `text/primary` at 10–20 % opacity; Disabled is the whole button at 35 %.
- `Button / Text` has one `Label` property for both variants (default "Save"); set it per button.

## Implementation (code)

`nhe/components/controls/controls.js` (`NHE.Toggle`, `NHE.Trigger`, `NHE.PluginHeader`, `NHE.iconButton`, `NHE.textButton`) and `controls.css`; stacking in `nhe/components/controls/panel.js` (`NHE.Panel`, `NHE.Panel.columns`). ES5, tokens only. Tried out in `playground/controls.html`. Checked in the browser on 2026-10-16: toggle flips; shared binding flips, footer icon, overlay "Shared"; locked binding refused, grey, face icon, no footer icon, overlay "Locked"; trigger shows Pressed ≥ 150 ms; plugin header off greys the name bar; stacking at 400 / 646 / 900 px (2 / 3 / 5 cells per column, lists wrap when they don't fit), group names 584 and 404 px. Not wired into MOD yet.
