# Slider: replacing MOD's knob in the settings panel

Status: draft, 2026-10-16. Design source: Figma "MOD-ui-NHE", section **Slider states** (`62:3396`).

The slider replaces every `.mod-knob` in the plugin settings panel (and so in the performance view's strip). It must do everything the knob does. This file lists what that is, read from mod-ui 1.14 (`html/resources/settings.html`, `html/js/modgui.js`: `baseWidget`, `film`, `setupValueField`).

## What MOD's knob does today

### What it shows

| Element | Source | Notes |
|---|---|---|
| Title | `shortName` | Tooltip is the port `comment`. |
| Current value | `[mod-role=input-control-value]` | Formatted with `units.render` (e.g. `%f Hz`), `%.2f` by default, `%d` for integer ports. Values like `7500.00 Hz` and `120.00 BPM` are common. |
| Minimum / maximum | `input-control-minimum` / `-maximum` | Same formatting, without forced 2 decimals (`20 Hz`, `22000 Hz`, `0.125`). |
| Group colour | `.mod-group-<n>`, `--group-<n>-color` | Background tint; first/last in group marked with `mod-group-start` / `-end`. |
| Steps | `.mod-knob-image-steps-<n>` | Integer ports: n discrete positions. |
| Address button | `.mod-address` | `.addressed` when bound; hidden for `expensive` ports. Opens the addressing dialog. |

### How it is used

| Input | Behaviour |
|---|---|
| Drag (mouse or one finger) | **Relative**: moving up or right raises the value. Never jumps to the pointer. Sensitivity depends on step count. |
| Click / tap | +1 step. Shift-click: −1 step. Clamped at the ends. |
| Mouse wheel / trackpad | Steps, buffered. |
| Pinch (iOS) | Coarse change, centred on the widget. |
| Type a value | The value field is editable: focus shows the raw number, digits `.` `-` only, Enter or blur commits, out-of-range values are clamped, nonsense reverts. |
| Double-click | Swallowed (no reset to default in MOD). |
| Value scales | Linear, logarithmic (`logarithmic` with positive bounds), integer, `rangeSteps`. |
| External changes | Host feedback, MIDI, snapshots and presets move the control without a `valuechange`. |
| Bound (addressed) | Control is disabled: drag/click/wheel show a "blocked" icon and the notice "Parameter value change blocked by the active adressing"; the value field is not editable, but the value still updates live. |

## What the Figma states cover

| Figma frame | State |
|---|---|
| Slider (`62:3373`) | Resting: group bar, title, small value box, track with fill and thumb, settings icon. |
| Active value change (`62:3095`) | Dragging: title gives way to a large value box. |
| Micro adjustment (`62:3119`) | Fine adjustment: large value, magnifier, accent ring on the thumb. |

Layers for min/max labels (`100`, `0`) exist but don't show.

## Gaps to resolve in the component

1. **Bound state.** Disabled look, plus which binding: hardware actuator name, `MIDI CC 7 · ch 1`, CV port, tempo (BPM). Icons exist (MIDI, sliders, CV, `17:1024`).
2. **Unbindable** (`expensive`): no address icon.
3. **Typing a value:** focused value box with caret.
4. **Units and long values:** `7500.00 Hz`, `120.00 BPM` in the small and large boxes.
5. **Min / max labels:** show or drop.
6. **Integer / stepped** ports: tick marks or snapping only.
7. **Bipolar ranges** (e.g. −12…+12 dB, pan): fill from the bottom or from zero.
8. **Long titles:** two lines ("HIGH CUT FREQUENCY") or truncate.
9. **Hover and keyboard focus** (desktop).
10. **Blocked feedback** when touched while bound.
11. **Grouping:** first / middle / last in group, ungrouped.
12. **Widths:** 120 (settings), 60 (narrow, in the iPad mock), 240; the performance strip scales to 75 %.
13. **Ends of travel:** thumb at 0 and at max.

## Proposed component (Figma)

One component set, **Control / Slider**, with:

- `State`: Rest · Hover · Dragging · Fine · Editing · Bound · Blocked
- `Size`: Regular (120) · Minimised (60, display only)
- `Group`: None · Start · Middle · End
- Boolean props: `Show min/max`, `Addressable`
- Text props: `Title`, `Value`, `Min`, `Max`, `Binding label`
- Fill height driven by one number (0–100 %) so value and fill stay in sync in mocks.

Colours, spacing and type come from the Theme and Primitives variables only.

## Decisions (2026-10-16)

| Topic | Decision | Consequences |
|---|---|---|
| Drag | **Thumb only.** The thumb follows the finger from where it was grabbed (no jump); the track ignores touches. | Thumb hit area at least 44 × 44 px. A touch on the track can scroll the strip instead. Mouse wheel still works over the whole control. |
| Fine adjustment | **Hold, then drag.** Press the thumb ~400 ms without moving to enter Fine; drag is then 10× finer. Shift-drag on desktop. | The Fine state (magnifier, accent ring) shows while held. Moving before 400 ms is a normal drag. |
| Tap | **Nothing.** | Drops MOD's click = +1 step / shift-click −1. Keyboard and wheel remain for small steps. |
| Bipolar ranges | **Fill from zero** when min < 0 < max. | The part below zero is always the darker accent; the bright fill runs between zero and the value (refinement 11). Zero mark on the track. |

## The component (Figma, built 2026-10-16)

Section **Control / Slider** (`71:3466`), component set `71:5625`, 36 variants: Regular (120) in every `State` (Rest, Hover, Dragging, Fine, Editing, Bound, Binding info, Blocked) × `Group` (None, Start, Middle, End), plus Minimised (60) in `State=Display` × `Group`. An **Examples** board (`71:8910`) shows real MOD content. The fill and thumb are a nested component, **Slider / Level** (`71:8543`, `Size` × `Value` 0–100 in steps of 10), exposed on the slider: set `Value` on the nested Level to move the fill. (Figma ignores size overrides on instance layers, so this is how a mock shows a value.)

Properties: text `Title`, `Binding kind`, `Binding label`, `Group name`; boolean `Steps`; instance swap `Binding type` (Icon / Binding / MIDI, CV, Device, Control Chain).

Structure, top to bottom (646 high): group bar 44 · header 69 (fixed, so the track never moves between states) · track (fills the rest, 485) · footer 48. The fill is a `Level` auto-layout of thumb + fill with negative spacing, so a taller `Fill` moves the thumb up: fill height = thumb/2 + value × (track − thumb). In Figma this lives in the nested Slider / Level component (see above).

All colours, radii, spacing and type sizes are bound to the variables. New Theme roles: `status/warn` (amber) and `fill/disabled` (grey 700).

## Proposals for the open items (to review)

| Item | Proposal |
|---|---|
| Value and units | Number and unit as separate text, unit smaller (`7500.00 Hz`). Minimised shows the number only. |
| Large value box (Dragging, Fine, Editing) | Replaces the title; fixed at the column width. Long values shrink to fit (refinement 9). |
| Min / max | Not shown (refinement 8). |
| Steps | Tick marks beside the track (outside it), one per allowed value, spread over the thumb centre's travel (first tick = minimum, last = maximum). **When:** integer ports (ticks = max − min + 1) and ports with `rangeSteps` (ticks = rangeSteps), **only up to 12 positions** (≈36 px apart over the 397 px travel); above that, no ticks but the thumb still snaps. The thumb snaps to the nearest tick on release; the readout shows whole values. **Not** for enumerations (lists), toggles or triggers (switches/buttons), or continuous ports. In Figma `Steps` always draws 5 ticks, as a look. |
| Long titles | Upper case, up to two lines, then "…". The full name stays in the tooltip. |
| Hover | White 2 px ring on the thumb. |
| Fine | Thumb ring in the accent colour, magnifier in the value box. |
| Editing | Caret in the large box, focus border 2 px. |
| Bound | Fill goes grey (`fill/disabled`); value box loses its border; the binding-type icon sits on the thumb and next to the settings icon (refinement 11). Value still moves live. |
| Blocked | Shown briefly when a touch on a bound slider is refused (MOD's `prevent`). Looks like Bound, except the thumb gets an orange (`status/warn`) 2 px stroke with the binding icon centred in it. |
| Not addressable | Looks like Rest: there is simply never a binding icon. |
| Group | See refinement 10. |

## Refinements (Niels's review)

1. **Value always vertically centred in its box.** Number and unit sit in a `Reading` frame (baseline-aligned, so the unit stays on the number's baseline), which the box centres both ways. Text is trimmed to cap height, so the digits are optically centred. Small boxes are fixed at 28 px; the caret is cap height.

2. **Minimised = display only.** The narrow size is renamed Minimised and has a single state, Display: title, value (number only), a 24 px track with a rounded fill and no thumb, and the settings icon. No bindings, ticks, min/max, fine or editing. Minimising is how a user "disables" a slider; the switch for it lives in the future slider settings modal.
3. **The sliders icon is the slider settings button** (opens the future slider settings modal), always visible in every state and size. Binding is shown separately (see 5). The `Addressable` property is gone.
4. **Fill flush with the bottom of the track.** The fill's 1 px black stroke is now on the top edge only (where it meets the grey track); the bottom and side strokes had made the purple look a couple of pixels short.
5. **Bound shows only the binding-type icon**, beside the settings icon. The icon is the instance-swap property `Binding type` (MIDI, CV, Device, Control Chain). **Tapping it shows the exact binding briefly** (new state `Binding info`): an overlay anchored to the bottom of the slider, covering both footer icons, with the kind as a caption (`Binding kind`, e.g. MIDI) over the detail (`Binding label`, e.g. `CC 7 · Ch 1`), one line each. Accent outline, the file's `shadow` effect style. How long it stays is for the build (proposal: ~2 s, or until the next tap).
6. **Device and Control Chain icons drawn** (Niels): Device is the ComputerTower icon from the icon library, Control Chain the two linked squares. Both are in `Icon / Binding / Device` and `Icon / Binding / Control Chain`, coloured by `icon/default`.
7. **Blocked = thumb only.** Orange stroke on the thumb with the binding icon centred in it; everything else as Bound (no outlines on track, value box or footer icon). The thumb icon is a slot in Slider / Level (`Thumb icon` swap, `Show thumb icon` boolean), set on the exposed Level; it has to match the slider's `Binding type`, since Figma can't link a parent property into a nested instance.
8. **No min/max labels in the track.** The enlarged readout already shows the value while dragging, so the range labels added nothing. Layers and the `Min` / `Max` properties are removed. (MOD's minimum and maximum still bound the value; they just aren't drawn.)
9. **Readout shrinks to fit; Max is the design size.** The value box is now a nested component, **Slider / Readout** (`75:11113`): `Size` (Large, Small, Minimised) × `Fit` (Max, Compact, Tight), with `Value`, `Unit`, `Caret` and `Magnifier` properties, exposed on the slider (the slider's own `Value` / `Unit` properties moved there). Boxes have a fixed width; nothing overflows into neighbours any more.

   | Readout | Max (design) | Compact | Tight |
   |---|---|---|---|
   | Large (104 × 61) | 24 / unit 12 | 16 / 10 | 12 / 10 |
   | Small (104 × 28) | 14 / 10 | 12 / 10 | 10 / 10 |
   | Minimised (52 × 28) | 14 | 12 | 10 |

   **Build rule:** render at Max; if the reading is wider than the box, step down to Compact, then Tight (sizes come from `--nhe-font-size-*`, never in between). If Tight still doesn't fit, drop the unit, then the decimals. Check on every value change; it is a cheap width comparison. Examples: `7500.00 Hz` → Large Compact; `-22000.00 Hz` → Large Tight, Small Compact; `1000.00` → Minimised Tight.
10. **Group rules, with MOD's colours.** `Group` = None · Single · Start · Middle · End.
    - **Band:** every slider has a 44 px band at the top; grouped sliders draw an 8 px bar in the group colour across it. The slider's dark background starts below the band, so a group name can run across the following sliders without being covered.
    - **Start:** bar plus the group name, pinned 16 px from the top and 8 px from the left. The name may run on across the rest of the group; it is never wider than the group (its width = group width − 16), wraps to **two lines at most, then "…"**. Two lines (24 px) still fit inside the band, so nothing else moves.
    - **Middle:** bar only. **End:** bar stops 8 px short, the gap before the next slider or group. **Single** (a group of one, MOD's `groupStart` and `groupEnd` both set): name plus a bar that stops 8 px short. **None:** empty band, so rows line up.
    - **Colour:** MOD's 32 group colours (`--group-0-color` … `--group-31-color` in mod-ui's `css/pedals.css`, picked by the port's `groupCssIndex`). In Figma: primitives `color/mod-group/0–31` and Theme roles `group/0–31`; in `tokens.css`, `--nhe-group-<n>` reads MOD's own `--group-<n>-color` first and falls back to the same value. These replace our placeholder `group/1` (indigo) and `group/2` (azure).
    - **In Figma** the name is a nested component, **Slider / Group label** (`77:12286`), with `Name` and `Width` (44 … 584 in 60 px steps: the group's width − 16, where a slider is 120 and a minimised slider 60), exposed on the slider.
11. **Zero-crossing ranges, a real shadow, and bound thumbs.**
    - **Ranges that cross zero** (gain in dB, level, pan): the track below zero is always the darker accent (`accent/strong`); the bright accent runs from zero to the value, above or below zero. A faint zero mark sits on the track. In Figma: `Zero` = None | Middle on Slider / Level (Middle = zero at half travel), exposed on the slider.
    - **Darker lower half** (Niels): `accent/strong` now points at a new, darker `purple/800` (`#4f1559`, was `purple/700` `#671c75`); `blue/800` added to match.
    - **Thumb shadow:** black at 30 % (new Theme role `shadow/thumb`, `--nhe-shadow-thumb`) instead of dark purple, so it reads as a shadow on any colour, including the dark lower half and a grey bound fill.
    - **Bound sliders show the binding icon on the thumb at rest**, so a tablet user sees the control is locked before touching it. A refused touch (Blocked) adds the orange ring. The footer icon stays: tapping it opens the binding details.

## Implementation (code)

`nhe/components/slider/` (`slider.js`, `slider.css`, `icons.js`; ES5, tokens only), tried out in `playground/slider.html` (`npm run playground`). Checked in the browser on 2026-10-16: quick drag (+10.08 for 40 px over 397 px of travel), hold-for-fine and Shift-drag (+1.01, 10× finer), track tap ignored, typing (42 sets, 500 clamps to max, Escape cancels), bound → blocked look for 0.6 s with the value unchanged, binding overlay, stepped port (5 ticks, snaps), log position, zero-crossing fill, readout fit. Not yet wired into MOD's settings panel; not yet tried on an iPad.

## Still open

- Tempo (BPM) binding has no icon yet.
- Keyboard focus ring (desktop).
