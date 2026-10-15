# mod-ui-nhe

Extensions for the [MOD](https://mod.audio) web UI (MOD Duo, Duo X, Dwarf, MOD Desktop), kept **outside MOD's code**.

The first feature is the **performance view**: your pedalboard's pedals one at a time as big as the screen allows, in a swipeable carousel, with the centred pedal's settings in a strip underneath.

## How it fits into MOD

On the device, NHE touches MOD's files in exactly two places:

1. a link `/usr/share/mod/html/nhe` → `/data/nhe` (where this repo's `nhe/` folder lives)
2. one `<script>` tag for `nhe/loader.js` in MOD's `index.html`

Everything else is in `/data`, so it survives reboots. A MOD OS update removes the two hooks; run the install script again to put them back.

```
nhe/
  loader.js              the one file index.html loads; reads version.json, loads features
  version.json           bumped on deploy so browsers fetch new files
  adapter/mod.js         the ONLY code that touches MOD's internals
  theme/tokens.css       design tokens (--nhe-*), exported from the Figma file's Variables
  components/slider/     the slider that will replace MOD's knob (not wired into MOD yet)
  features/performance/  performance.js + .css (shared with the mod-ui branch) and index.js (wiring)
  device/install.sh      run on the device: hooks NHE into MOD's UI (safe to repeat)
  device/uninstall.sh    run on the device: restores MOD's original index.html
tools/
  devproxy.js            local preview: MOD's real UI + this repo's files, live
  deploy.sh              copy to the device and install
playground/              component playgrounds, no MOD needed (npm run playground)
docs/                    specs (docs/slider-spec.md)
test/                    browser tests (see test/README.md)
```

## Work on it locally (MOD Desktop)

1. Start **MOD Desktop**. It serves MOD's UI at http://127.0.0.1:18181.
2. In this folder: `npm run dev`. No `npm install` is needed; it uses Node built-ins only.
3. Open **http://localhost:18080**: MOD's real UI, with `./nhe` served live from this folder. Edit, reload, see it. Nothing in MOD Desktop is changed.

To preview against the Duo instead (over USB): `npm run dev:duo`.

MOD Desktop hides the device-only parts of the UI (File Manager, Banks, Plugin Store, Settings, hardware addressing). Work on those against the Duo.

## Try components on their own

`npm run playground`, then open http://localhost:18090/playground/slider.html: the slider with a properties panel, an event log, a sample settings panel and a theme-colour picker. It needs no MOD. (The same page is at /playground/slider.html on the `npm run dev` proxy.) Open only the playground page on :18090, not its root: the root is MOD's UI, and MOD wants one tab at a time.

## Put it on the Duo

```sh
npm run deploy            # or: tools/deploy.sh 192.168.51.1
```

This copies `nhe/` to `/data/nhe`, then runs `device/install.sh` on the Duo. Root's password is `mod`. Run `ssh-copy-id root@192.168.51.1` once and you won't be asked again. Reload the MOD UI; no reboot needed.

To remove it: `ssh root@192.168.51.1 'sh /data/nhe/device/uninstall.sh'`.

## Switching features off

Each feature can be turned off with a MOD preference `nhe-<feature>` = `"false"`, stored on the device like MOD's own settings:

```js
NHE.mod.setPreference('nhe-performance', 'false')   // in the browser console; reload
```

## Requirements

- MOD OS 1.14 (tested against 1.14 RC4, `v1.14.0.3366`) or MOD Desktop on the same version.
- A browser at least as new as MOD 1.14 needs: iOS/iPadOS 13.4+; for the performance view, Safari 14.1+ or any current Chrome, Firefox or Edge.

## License

AGPL-3.0-or-later, like mod-ui.
