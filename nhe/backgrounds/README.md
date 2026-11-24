# Builder backgrounds

NHE's texture shows by default: `pegs-mid-grey.jpg`, named once in `nhe/theme/tokens.css` (`--nhe-texture`, with its tile height on the builder and where its holes sit). MOD's builder, the constructor's surface and its + dialog all use it, so changing it there changes it everywhere. The others here can take MOD's wood's place (`img/background.jpg`, 2000 x 1420, tiled at 1200 px tall), which SET also keeps on offer.

The tiles are 250 x 250 and share one grid: a peg (or a square) centred at 155.8 px across and down, and the `pegs-` ones another every half tile. In `backgrounds.json`: `file`; `name`, what SET shows; `height`, the tile's height in px on MOD's builder; `perCell`, tiles to one of NHE's builder cells (1.5 for `pegs-`: three pegs to a cell, 1 for the rest); `hole`, a peg's centre as a fraction of the tile, which NHE's builder puts under every +. Add a file and an entry and it shows in **SET → Work surface**. Or, in the browser console:

```js
NHE.background('your-image.jpg')        // try it (remembered in this browser)
NHE.background('your-image.jpg', 300)   // tiled 300 px tall
NHE.background(null)               // back to MOD's wood
```

On the Duo, run `sh tools/deploy.sh` first so the image is on the device. Seamless tiles look best: the image repeats across the canvas.
