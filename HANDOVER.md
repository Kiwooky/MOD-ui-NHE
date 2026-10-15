# Handover: next up, the plugin settings panel

Written 2026-10-16 at the end of a Claude (Cowork) session, for Claude Code working in this repo. Read `CLAUDE.md` and `README.md` first; this file covers where things stand and what to do next.

## Where things stand

- This repo works. `npm run dev` with MOD Desktop running gives MOD's real UI at http://localhost:18080 with `./nhe` layered on live. Verified 2026-10-14 in Chrome: `[nhe] performance started`, websocket connected, the bolt icon opens the performance view, no console errors.
- **One MOD tab at a time.** mod-ui expects a single browser client. A second tab (proxy or direct at 127.0.0.1:18181) can sit on "Loading pedalboard…" forever. Not our bug.
- The performance view is done (23 acceptance criteria, 34 + 20 browser checks passing against stock 1.14 RC4). It lives in `nhe/features/performance/`.
- Not yet deployed to the Duo through `npm run deploy`. Ask Niels first (rule 6 in CLAUDE.md).

## Next goal: the plugin settings panel

Niels wants to work on MOD's **plugin settings panel** next (the "Plugin Settings" window that opens from the gear on a pedal). It "solves half of the performance view": the performance view's bottom strip *is* this panel. It borrows the real `.mod-pedal-settings` DOM, so anything we improve in the panel shows up in both places.

**Start by asking Niels** what bothers him about the panel today and what he wants from it, before building. Possible directions (ideas only, nothing agreed):

- Lay controls out by **port group** (sections with headings), instead of one long wrap.
- Show each control's **binding** on the control: footswitch/knob, `CC 7 ch 1`, CV, tempo.
- Tidier sizing and spacing; the stock boxes are 160 px (the performance strip shows them at 75%).

## How the panel works (mod-ui 1.14)

Line numbers are from mod-ui at `7a35aac6` plus our performance-view branch. They are approximate, so search by name.

- **Opening it.** `html/js/pedalboard.js` ~1652: the gear (`.mod-settings` in the pedal's action bar) calls `settings.window('open')`, a WindowManager window named "Plugin Settings" appended to `<body>`. ~1485: `icon.data('settings', settings)`. This is how the performance view finds the panel for a pedal.
- **Rendering it.** `html/js/modgui.js` ~916–939: `self.settings = $('<div class="mod-settings" mod-instance=…>')`, filled with `Mustache.render(effect.gui.settingsTemplate || DEFAULT_SETTINGS_TEMPLATE, templateData)`, then `assignControlFunctionality(self.settings, false)` wires up the widgets.
  - A plugin can ship its own `settingsTemplate` (fetched from `/effect/file/settingsTemplate`, ~198). Most use the default.
- **The default template** is `html/resources/settings.html`, inlined into `index.html` as `DEFAULT_SETTINGS_TEMPLATE`. Structure:
  - `.mod-pedal-settings` > `.mod-controls` > `.mod-control-group`.
  - Inside are the bypass switch, the presets list (`.mod-presets`), file lists (`.mod-file-list`), strings (`.mod-string`), and per control `.mod-knob` / `.mod-switch` / `.mod-enumerated`.
  - Each control has a `.mod-address` button (`mod-port-symbol=…`) that opens the addressing dialog. It gets the class `.addressed` when the control is bound.
- **Groups.** `html/js/host.js` ~374 resolves each control port's `group` (from the plugin's `portGroups`) and sets `group`, `groupIndex`, `groupCssIndex` (0–31), `groupStart` and `groupEnd`. The template turns these into the classes `mod-group`, `mod-group-start`, `mod-group-end` and `mod-group-<n>`. So groups are already in the DOM. Many plugins define none.
- **Values.** Each port in the plugin data has:
  - `value`, `ranges` (min/max/default), `properties` (toggled, integer, logarithmic, enumeration, trigger, notOnGUI…), `scalePoints`, `units`, `name`/`shortName`/`symbol`, `comment`;
  - LV2 parameters (files, strings) are in `parameters`.
- **Bindings.** `html/js/hardware.js`, the `HardwareManager` at `desktop.hardwareManager`:
  - `addressingsByPortSymbol["/instance/symbol"]` gives the actuator URI. `addressingsData[...]` gives `{uri, label, minimum, maximum, steps, tempo, dividers, page, subpage, group, feedback, coloured, momentary}`, plus `operationalMode` for CV.
  - URI kinds:
    - hardware actuators (from `HARDWARE_PROFILE`);
    - MIDI: `/midi-learn` (waiting), or `/midi-custom_Ch.1_CC#7`;
    - CV: `/cv/...` (`isCvUri`);
    - tempo: `/bpm`.
  - Bound controls are disabled through `options.setEnabled(instance, symbol, false, …)`.
  - MOD Desktop has no hardware, so only MIDI/CV/BPM bindings can be tested there. Hardware bindings need the Duo.

For MOD's source, clone `moddevices/mod-ui` (or Niels's fork `Kiwooky/mod-ui`) into a **sibling** folder as a read-only reference. Never edit it from here.

## Suggested approach

1. Make it a new feature, `nhe/features/settings/` (id `settings`, preference `nhe-settings`), registered in `FEATURES` in `nhe/loader.js`.
2. Go **CSS first.** Restyle `.mod-pedal-settings` using the group and `.addressed` classes already there. Scope the styles so the performance strip still looks right, or deliberately share them.
3. If you need data, add it to the adapter. For example, `NHE.mod.port(instance, symbol)` returning `{value, ranges, group, binding}` and `NHE.mod.onSettingsOpen(cb)`. Comment each one with the mod-ui internals it relies on.
4. Don't replace the Mustache template. Enhance the rendered DOM after `assignControlFunctionality`, so plugins with custom `settingsTemplate`s keep working.
5. Check in the browser (one tab), with several plugins, including one with port groups and one with a MIDI-bound control. Then run the performance view tests in `test/`, since the strip shares this DOM.

## Still open (later)

- First `npm run deploy` to the Duo (with Niels's OK).
- Copy the newer board-switch `settling` fix from `nhe/features/performance/performance.js` to the `performance-view` branch of Kiwooky/mod-ui before any upstream PR. Don't open PRs to MOD until Niels says so.
- A Settings UI toggle for the `nhe-<id>` flags.
- Talk to Andrea Del Signore (sejerpz, "Starless"/aLabs firmware). It has a tile performance view, snapshots, A/B compare and a bindings overview, which overlap with this work. Notes are in Niels's claude.ai project "MOD plugs" (`research/andrea-alabs-starless-overview.md`). Also there: `specs/performance-view-ac.md` and `specs/ui-extension-architecture.md`.
