# Builder backgrounds

`perforated.jpg` shows by default, tiled 300 px tall (a quarter of MOD's 1200). Images to try in place of MOD's wood (`img/background.jpg`, 2000 x 1420, tiled at 1200 px tall). Drop a JPEG, PNG or WebP here, reload MOD, then in the browser console:

```js
NHE.background('your-image.jpg')        // try it (remembered in this browser)
NHE.background('your-image.jpg', 300)   // tiled 300 px tall
NHE.background(null)               // back to MOD's wood
```

On the Duo, run `sh tools/deploy.sh` first so the image is on the device. Seamless tiles look best: the image repeats across the canvas.
