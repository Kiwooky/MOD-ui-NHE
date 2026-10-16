# Single selects: option lists, presets, segmented switch

Status: draft, 2026-10-16. Design source: Figma "MOD-ui-NHE": the presets column `22:1944` (FACTORY / USER switch, preset list, preset actions) and the Division list `22:2067` (also in the iPad mock-up `26:2887`). Builds on the slider and button specs: same column, band, title, footer, Bound / Locked rules, stacking and tokens.

## What MOD does today (mod-ui 1.14)

| MOD control | Port / data | Widget | Behaviour |
|---|---|---|---|
| **Option list** (`.mod-enumerated`) | `enumeration` property, `scalePoints` | `customSelect` (`modgui.js`) | Tap an option to select it. A value between scale points shows the nearest one. Bound → as any control (shared or locked). |
| **Preset list** (`.mod-presets`) | the plugin's presets; the special `:presets` port when bound | `customSelect` + preset code | Two lists, factory and user, switched by FACTORY / USER radios. Tap loads a preset. No factory presets → the switch is hidden and the user list shows. |
| **Preset actions** | — | `.preset-btn-*` | **Save** (overwrite the selected *user* preset), **Save as** (new user preset, name dialog), **Rename** and **Delete** (user presets only), **Assign all** (binds the whole preset list to an actuator; disabled with only one preset). |
| **File list** (`.mod-file-list`) | LV2 path parameters (IRs, NAM models…) | `customSelectPath` | Folders, back arrow, file icons; an expand button when more than 5 files. |

## Components

### 1. Option list (enumerated port)

A stackable cell like the buttons: 120 wide, title 33, list, footer 48 (settings + binding icon). Replaces `.mod-enumerated` for `enumeration` ports.

- **List:** 104 wide, `surface/sunken`, 1 px `border/focus`, radius 8, clipped. Rows 44 high, 14 px semibold, 8 / 16 padding, one line, then "…".
- **Height:** shows 3½ rows (160 px) so a partly visible last row says "there's more"; fewer options → the list shrinks to fit (no half row). Cell height = 33 + list + 48 (241 at 3½ rows).
- **Selected:** row filled with `selection`. On open and on outside changes the selected row scrolls into view.
- **Interaction:** tap a row to select; the list scrolls by touch or wheel. Arrow keys move the selection when focused.
- **States:** Rest, Hover (row, desktop), Pressed (row), Bound (footer icon), Binding info, Locked, Blocked.

### 2. Preset list

In the plugin column (240 wide), below the plugin on/off header, filling the column's remaining height.

- **FACTORY / USER switch** (segmented, see 3) above the list, titled PRESETS. Hidden when the plugin has no factory presets.
- **Rows:** as the option list, but 224 wide and names may wrap to **two lines** (rows grow to 60), then "…". MOD's names are shown in upper case, as in the mock-up.
- **Selected:** `selection` fill. Selecting loads the preset at once.
- **Actions** (icon buttons) below the list; disabled per MOD's rules. Binding for the whole preset list (`:presets`): the footer icon, Bound / Locked as everywhere.

### 3. Segmented switch (FACTORY / USER)

Two (or more) equal segments in one 28 px box, radius 8, 1 px `border/focus`; the active segment filled with `selection`, the others `surface/sunken`. 14 px semibold upper case. Tap a segment to switch.

### 4. File list (LV2 path parameters: NAM models, IRs…)

MOD shows these as `.mod-file-list` (`customSelectPath`): rows for the open folder (with a "folder up" icon: tap to go up), other folders, and files; a **T3K** button (Tone3000's model browser) and **EXP** (expand, more than 5 files).

- **Its own column** (Niels): 240 wide, after the plugin column, as tall as the other columns; the same 44 band on top so its title lines up.
- Rows as the preset list's (two lines, then …), in the file's own case, with a folder-up / folder / file icon (placeholders drawn in code; to be replaced from Figma).
- **T3K** stays (opens MOD's Tone3000 browser); **no EXP**: the list already uses the full column height.
- The panel reads MOD's own list and taps MOD's rows, so MOD keeps doing the folder navigation and setting the parameter.

Not covered yet: **text parameters** (Button to CV's press texts): use the MOD view.

## Decisions (2026-10-16)

| Topic | Decision |
|---|---|
| Preset actions | Four icons: **FilePlus = Save as**, **FloppyDisk = Save** (overwrite; replaced CirclesThreePlus in the iPhone mock-up, and in `Button / Icon`'s swap options), **Pencil = Rename**, **Trash = Delete**. MOD's **Assign all** is not a separate button: it does exactly what the presets' **settings icon** does (bind the preset list), so the settings icon handles it. Icons to be refined by Niels. |
| Option lists in stacks | **Yes.** Option-list cells join button stacks; a column fills with cells of mixed height (169 for buttons, 241 for a 3½-row list) until the next one doesn't fit. |
| Locked list | The binding icon sits **on the selected row**, right-aligned, and the selection fill turns grey (`fill/disabled`). A touch shows Blocked (orange outline on the list + overlay). |
| No presets at all | **The action row alone** (Niels): no list and no FACTORY / USER switch, Save as active, so a first preset can be saved. |
| File lists | **Own column**, T3K yes, no EXP (see 4). |
| Selection colour | **Follows the theme colour.** `selection` and `border/focus` now point at `accent/default`, so the selected row, the active segment and every readout border change with the user's colour. |

## The components (Figma, built 2026-10-16)

Section **Control / Selects** (`81:16403`), below Control / Buttons. All colours, radii, spacing and type sizes are bound to the variables; the selected row and active segment use `selection`, which now follows the theme colour.

| Set | Variants | Properties |
|---|---|---|
| **Control / Option row** (`81:16428`) | `Size` Narrow (104, one line) · Wide (224, two lines then …) × `State` Default · Hover · Pressed · Selected · Selected locked | `Label`, `Binding type` (the icon in Selected locked) |
| **Control / Option list** (`81:16542`) | `State` Rest · Bound · Binding info · Locked · Blocked (120 × 241, 3½ rows) | `Title`, `Binding type`, `Binding kind`, `Binding label`; rows are Option row instances (edit their labels directly) |
| **Control / Segmented** (`81:16553`) | `Active` Left · Right (224 × 28) | `Left label`, `Right label` |
| **Control / Preset list** (`81:16851`) | `State` Factory · User · No factory · Bound · Binding info · Locked · Blocked (240 × 546) | `Binding type`, `Binding kind`, `Binding label`; rows are Wide Option rows |

Notes:
- **Preset actions follow MOD:** Save as is always available; Save, Rename and Delete only for a user preset, and not while the preset list is locked.
- **Save as and Rename ask for the name in NHE's name dialog** (`components/controls/name.js`, the addressing dialog's frame: plugin name with a "Save as" / "Rename" pill, a Preset name field, Cancel / Save; Save is off while the name is empty). MOD's own buttons still do the work: the adapter swaps `desktop.openPresetSaveWindow` for the one click, so MOD's saving runs unchanged.
- **Locked lists:** the selected row becomes `Selected locked` (grey, binding icon right). In Locked / Blocked variants that row is an exposed instance: set its `Binding type` to match the list's (Figma can't link a parent property into a nested instance).
- **Settings panel mock-up** (`81:15319`): the preset list fills the plugin column under the on/off header, and a Division option list stacks with Tails and Reverse in the Delay group (44 + 169 + 169 + 241 = 623 of 646).

## Implementation (code)

`nhe/components/controls/controls.js` (`NHE.OptionList`, `NHE.Segmented`, `NHE.PresetList`) and `controls.css`. Checked in the browser on 2026-10-16: picking an option; locked list refused with the icon on the selected row; preset actions follow MOD (Save as always; Save / Rename / Delete only for a user preset, not while locked); no factory presets hides the switch; loading a preset from the other tab. Not wired into MOD yet.

File list in code: `NHE.FileList` (`controls.js`), a `files` option on `NHE.Panel`, adapter `fileLists`, `fileAction`, `fileT3K`, `onFilesChange`. Checked in MOD Desktop with Neural Amp Modeler: picking a model sets MOD's parameter, going up and back into a folder, T3K shown; NAM has no presets, so its preset section is the action row with Save as only.
