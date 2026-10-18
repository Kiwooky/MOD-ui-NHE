// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Builder background: replace MOD's wood (img/background.jpg) with another
 * image, to try some out. Put images in nhe/backgrounds/ (they go to the
 * device with the rest of nhe/), then in the browser console:
 *
 *   NHE.background('slate.jpg')        // a file in nhe/backgrounds/
 *   NHE.background('slate.jpg', 300)   // ... tiled 300 px tall (MOD's wood: 1200)
 *   NHE.background('https://...')      // or any image URL / path
 *   NHE.background(null)               // MOD's own wood
 *   NHE.background()                   // which one is on
 *
 * The images on offer are listed in nhe/backgrounds/backgrounds.json
 * ({ file, height }: the tile's height in px); SET's Work surface dropdown
 * shows them (NHE.backgroundList).
 *
 * Until something is chosen, DEFAULT shows. The choice is remembered in this
 * browser. The image tiles like MOD's (1200 px tall), on the builder and in
 * the performance view.
 */
NHE.register('background', function (mod) {
    var KEY = 'nhe-background'
    var DEFAULT = 'perforated.jpg'     // perforated metal, 2000 x 1420 like MOD's wood
    var DEFAULT_HEIGHT = 300           // a quarter of MOD's tiling: holes about 37 px apart
    var HEIGHT_KEY = 'nhe-background-height'
    var MOD = 'mod'                    // saved when MOD's own wood is chosen

    var resolve = function (name) {
        if (!name || name === MOD) return null
        // a bare file name means nhe/backgrounds/
        return /^(https?:|data:|\/)/.test(name) ? name : NHE.base + 'backgrounds/' + name
    }
    var saved = function () { try { return localStorage.getItem(KEY) || DEFAULT } catch (e) { return DEFAULT } }
    var savedHeight = function () {
        var h
        try { h = parseFloat(localStorage.getItem(HEIGHT_KEY)) } catch (e) {}
        return h > 0 ? h : (saved() === DEFAULT ? DEFAULT_HEIGHT : null)
    }

    NHE.background = function (name, height) {
        if (arguments.length === 0) return saved() === MOD ? "MOD's own (img/background.jpg)" : saved()
        try {
            localStorage.setItem(KEY, name || MOD)
            if (height > 0) localStorage.setItem(HEIGHT_KEY, height)
            else localStorage.removeItem(HEIGHT_KEY)
        } catch (e) {}
        mod.setBackground(resolve(name), savedHeight())
        return name ? resolve(name) : "MOD's own"
    }

    // the list in nhe/backgrounds/backgrounds.json, fetched once
    var list = null, waiting = []
    NHE.backgroundList = function (cb) {
        if (list) { cb(list); return }
        waiting.push(cb)
        if (waiting.length > 1) return
        var xhr = new XMLHttpRequest()
        xhr.open('GET', NHE.base + 'backgrounds/backgrounds.json?v=' + encodeURIComponent(NHE.version || ''))
        var done = function () {
            try { list = JSON.parse(xhr.responseText) } catch (e) { list = [] }
            if (!list || !list.length) list = [{ file: DEFAULT, height: DEFAULT_HEIGHT }]
            waiting.splice(0).forEach(function (fn) { fn(list) })
        }
        xhr.onload = done
        xhr.onerror = done
        xhr.send()
    }
    // the file on now, or MOD (the wood)
    NHE.backgroundCurrent = function () { return saved() }
    NHE.backgroundMod = MOD

    mod.setBackground(resolve(saved()), savedHeight())
})
