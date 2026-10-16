# Performance view: flip a pedal

The performance view shows one pedal at a time in a carousel. Until now the
centred pedal's settings sat in a strip underneath (MOD's own settings panel,
borrowed). The strip goes: each pedal has two sides.

- **Front:** the pedal's own GUI (the modgui that shipped with the plugin),
  as now.
- **Back:** the NHE settings screen (system bar + panel), the same one the
  plugin settings window shows.

## Behaviour

- **Flip and Hide** are two pills (icon, then the label) on the centred pedal's top-left
  corner, half outside it (clear of a pedal that fills the screen), in line
  with the settings screen's top-left button. There is no row under the
  stage: all the height is for the pedal.
- **Hidden pedals** gather in the tile at the end of the carousel: full
  height, a column of pedals (thumbnail and name), more columns to the
  right as needed. Tapping one shows it again; Show all brings them all
  back.
- Flipping turns the pedal over and its back **opens out to the whole
  performance area**: the system bar at the left, the panel beside it,
  scrolling sideways as in the settings window.
- While flipped, swiping between pedals pauses (the panel's own sideways
  drag and scroll take over). On the back, the system bar's top-left button
  is **Flip** (flip icon) in place of EXIT, and turns the pedal back; the
  carousel returns where it was. Leaving the performance view is the
  Constructor icon in the footer, as before.
- The chain view's hop (tapping a neighbouring plugin) flips to that
  pedal's back: the carousel moves to it, still flipped.
  A pedal hidden from the view is shown again first.
  From a back, the hop doesn't flip: the new back replaces the old one at
  once (a slide across the whole view was too much movement).
- The flip is per visit: pedals start on their front when the view opens.

## Where the code goes

`features/performance/performance.js` is shared with the upstream
performance-view branch of Kiwooky/mod-ui, which has no NHE panel. So:

- `performance.js` gets the flip, the corner buttons, the hidden tile's grid, the opened-out back
  and an option `renderBack(instance, container)` that fills the back.
  Without it (upstream), the back shows MOD's own settings panel, moved in
  as the strip did, with a Flip back bar. The strip is removed (also from
  the view's markup: upstream's index.html loses `.performance-strip`).
- NHE's performance feature passes `renderBack`, which mounts the NHE
  settings screen for that instance. The settings feature's panel building
  moves into something both can call (the settings window and the back).
