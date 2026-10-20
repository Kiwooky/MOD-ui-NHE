# Builder backgrounds

NHE's texture shows by default: `calm-dark.jpg`, named once in `nhe/theme/tokens.css` (`--nhe-texture`, with its tile height on the builder and where its holes sit). MOD's builder, the constructor's surface and its + dialog all use it, so changing it there changes it everywhere. Images to try in place of MOD's wood (`img/background.jpg`, 2000 x 1420, tiled at 1200 px tall). Drop a JPEG, PNG or WebP here and add it to `backgrounds.json` (`file`, and `height`: the tile's height in px). It then shows in **SET → Work surface**. Or, in the browser console:

```js
NHE.background('your-image.jpg')        // try it (remembered in this browser)
NHE.background('your-image.jpg', 300)   // tiled 300 px tall
NHE.background(null)               // back to MOD's wood
```

On the Duo, run `sh tools/deploy.sh` first so the image is on the device. Seamless tiles look best: the image repeats across the canvas.
