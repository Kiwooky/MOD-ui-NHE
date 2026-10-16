# System bar: tempo, CPU / RAM, signal chain

Status: draft, 2026-10-16. Design source: Figma "MOD-ui-NHE", component set `20:1778` (named "Slider", variants `Side=Default` = meters and `Side=Side2` = chain). The bar is a 120 px column at the left of the performance view and the settings panel, same height as a slider column (646), with EXIT at the top and two tabs at the bottom: **Meters** (speedometer icon) and **Chain** (tree icon).

## What MOD provides (mod-ui 1.14, over the websocket)

| Need | MOD message | Contents | Notes |
|---|---|---|---|
| CPU | `stats` | total CPU load (%), xrun count | Total only: **no per-plugin CPU** anywhere in MOD's UI or messages. |
| RAM, device info | `sys_stats` | RAM use (%), CPU frequency, CPU temperature | Frequency / temperature are 0 where unknown (MOD Desktop). |
| Tempo | `transport` | playing, beats per bar, **BPM**, sync mode | The UI sets it with `transport-bpm`. With MIDI clock or Ableton Link sync, MOD locks the tempo (`setControlEnabled(':bpm', false)`). `:bpm` can also be bound (e.g. tap tempo on a footswitch). |
| Audio IN / OUT levels | — | — | **Not available.** MOD's web UI receives no audio levels; only plugins' own output ports (`output_set`). Starless (Andrea Del Signore) may have added backend code for this: ask him. |
| Signal chain | `connect` / `disconnect`, held by the pedalboard's `connectionManager` | every connection, port to port | Enough to list a plugin's direct neighbours. |

## Meters tab

Top to bottom, in the 120 column:

1. **EXIT** (as now).
2. **Tempo**, in the slider's header place: title **TEMPO**, readout **120.00 BPM** (the slider's Readout, Small; fit rule applies). Tap the readout to type a tempo, as on a slider. States: Rest, Editing, **Locked** when synced to MIDI clock / Link (grey readout border, and the sync source as the overlay detail, e.g. "MIDI clock · Locked"), Bound (tempo bound to an actuator: icon next to the readout).
3. **CPU** and **RAM**: two meter tracks side by side, filling the column like one slider (two tracks of ~44 in the 88 track width, 8 apart), each titled (CPU, RAM) with its percentage under the title. Fill from the bottom: CPU in `meter/cpu`, RAM in `meter/level-top` → `meter/level-bottom`.
   - **Xrun:** when the xrun count goes up, the CPU track gets a **red outline** (`status/error`, new) for ~2 s, and the count ("2 xruns") shows centred in the gap between the bottom of the bars and the tab icons, absolutely positioned so the bars keep their height.
   - Optional small text under the meters: CPU frequency / temperature when the device reports them.
4. **Tabs:** Meters (active) · Chain.

## Chain tab

Shows the **direct neighbours of the current plugin** (the one whose settings, or whose page in the performance view, is showing):

1. **EXIT**, then the current plugin's name as the title (as now).
2. **IN**: what feeds the current plugin's inputs: plugin cards, or **IN** (the device's own inputs). Grouped per input when the plugin has several (IN L, IN R, MIDI in…).
3. **OUT**: what each of its outputs feeds, grouped per output (OUT (L), OUT (R), MIDI out…): plugin cards, or **OUT** (the device's outputs).
4. **Plugin cards:** brand (small) and name, as in the mock-up. **Tap a card to hop to that plugin**: its settings open (in the performance view, the carousel moves to it). So you can step backwards and forwards through the chain.
5. **Edge cases:** an input or output with nothing connected says "Not connected"; many connections on one output → the list scrolls; only direct neighbours are shown, so feedback loops are harmless.
6. **Tabs:** Meters · Chain (active).

## Needed from the adapter (`nhe/adapter/mod.js`)

- `NHE.mod.onStats(cb)` → `{cpu, xruns}`, `NHE.mod.onSysStats(cb)` → `{ram, freq, temp}`: hook MOD's websocket messages (`stats`, `sys_stats`).
- `NHE.mod.tempo()` / `NHE.mod.onTempo(cb)` / `NHE.mod.setTempo(bpm)`: `desktop.transportControls`, `transport-bpm`.
- `NHE.mod.neighbours(instance)` → `{inputs: [{port, from: [instance | 'hw']}], outputs: [{port, to: [...]}]}` from the pedalboard's `connectionManager`.
- `NHE.mod.openSettings(instance)`: the pedal's settings window (`icon.data('settings')`), as the performance view already finds it.

## Open

- Whether Starless's audio meters can be reused (ask Andrea).
- Tempo **Locked** wording for each sync mode (MIDI clock, Ableton Link).

## The component (Figma, built 2026-10-16)

Section **Control / System bar**, set **Control / System bar** (`81:17084`), 120 × 646. Your original (`20:1778`) stays as the reference.

| Variant | Shows |
|---|---|
| `Tab=Meters, State=Rest` | EXIT, TEMPO with a Small readout (`120.00 BPM`), CPU and RAM tracks with their %, tabs (Meters active). |
| `Tab=Meters, State=Xrun` | CPU track with a 2 px `status/error` outline; "2 xruns" floats centred between the bars and the tabs (bars stay the same height as Rest). |
| `Tab=Meters, State=Tempo locked` | Readout border grey, "MIDI clock · Locked" in `status/warn` under it. |
| `Tab=Chain, State=Rest` | Current plugin as the title; IN → cards; OUT (L) → cards; OUT (R) → cards; tabs (Chain active). |
| `Tab=Chain, State=Not connected` | An output with nothing on it says "Not connected". |

- Plugin cards: brand (10, upper case) over the name (12, two lines, **original case**: upper case breaks long single-word names like "JtBassSynth"). Background: black (`surface/sunken`), corners `radius/md` (8).
- New tokens: `color/red/500` (`#e53935`) and `status/error` (`--nhe-status-error`).

## Implementation (code)

`nhe/components/controls/systembar.js` (`NHE.SystemBar` with `setStats`, `setSysStats`, `setTempo`) and `controls.css`. In the playground the stats are simulated. Checked in the browser on 2026-10-16: an xrun lights the red outline and floats the count; tempo locks under MIDI clock; typing a tempo; the chain tab lists neighbours and a card "hops" (event). 

## Wired into MOD (settings feature)

The settings window shows the system bar to the left of the panel, at the panel's height. Adapter: `NHE.mod.stats` / `onStats` (MOD's own status bar elements `#cpu-bar-text`, `#ram-bar-text`, `#mod-xruns`), `tempo` / `setTempo` / `onTempo` (`desktop.transportControls`, the websocket's `transport-bpm`; locked under MIDI clock), `neighbours` (the pedalboard's `connectionManager`; ports wired to the same plugins share a heading, "In L/R", "Audio Input 1/2"), `openSettings`. EXIT closes the window; a chain card closes this plugin's settings and opens the other's. **The tab is remembered** (Niels): every plugin's window opens on the tab used last (Meters or Chain), kept per browser (`localStorage` `nhe-system-bar-tab`), so the chain view can stay up until CPU info is needed.

Checked in MOD Desktop: CPU follows MOD's figure; RAM shows "–" (MOD Desktop reports none: "RAM NaN%"); typing 96 BPM set MOD's transport; Bollie Delay's chain (NAM → Bollie → Dragonfly) and hopping to Dragonfly.
