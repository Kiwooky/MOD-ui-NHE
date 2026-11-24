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
 * ({ file, height, name, perCell, hole }); SET's Work surface dropdown
 * shows them (NHE.backgroundList). height: the tile's height in px on MOD's
 * builder; perCell: tiles to one of NHE's builder cells; hole: a peg's (or
 * square's) centre, as a fraction of the tile, which NHE's builder lines up
 * under every + (pegs every half tile, or one per tile).
 *
 * Until something is chosen, NHE's texture shows (tokens.css: --nhe-texture,
 * tiled --nhe-texture-height tall), the same image as the constructor's.
 * The choice is remembered in this browser. It shows on MOD's builder, in
 * the performance view and on NHE's builder (the constructor's surface:
 * --nhe-surface-texture / --nhe-surface-tile / --nhe-surface-per-cell /
 * --nhe-surface-hole on the page, and an 'nhe-background' event on window
 * so it redraws). A remembered file no longer in the list falls back to
 * NHE's texture.
 */
NHE.register('background', function (mod) {
    var KEY = 'nhe-background'
    // the default: NHE's texture, read from tokens.css (the one place it's named)
    var token = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).replace(/^\s+|\s+$/g, '') }
    var DEFAULT = null, DEFAULT_HEIGHT = null
    var readDefault = function () {
        var m = /url\(\s*["']?([^"')]+)["']?\s*\)/.exec(token('--nhe-texture'))
        if (!m) return false
        DEFAULT = m[1].split('/').pop()              // a file in nhe/backgrounds/
        DEFAULT_HEIGHT = parseFloat(token('--nhe-texture-height')) || null
        return true
    }
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
        setSurface()
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

    // NHE's builder: another image than its own grid (whose holes line up
    // with the cells, so the surface places that one itself)
    var entry = function (name) {
        var found = null
        ;(list || []).forEach(function (b) { if (b.file === name) found = b })
        return found
    }
    var setSurface = function () {
        var root = document.documentElement.style, name = saved(), url = null, height = null, b = null
        if (name === MOD) { var w = mod.builderWood(); url = w.url; height = w.height }
        else if (name && name !== DEFAULT) { url = resolve(name); height = savedHeight() || 300; b = entry(name) }
        root.removeProperty('--nhe-surface-per-cell')
        root.removeProperty('--nhe-surface-hole')
        if (url) {
            root.setProperty('--nhe-surface-texture', 'url("' + String(url).replace(/["\\\n]/g, '') + '")')
            root.setProperty('--nhe-surface-tile', height + 'px')
            // one of nhe/backgrounds/ with a grid: lined up with the cells
            if (b && b.perCell > 0) root.setProperty('--nhe-surface-per-cell', String(b.perCell))
            if (b && b.hole >= 0) root.setProperty('--nhe-surface-hole', String(b.hole))
        } else {
            root.removeProperty('--nhe-surface-texture')
            root.removeProperty('--nhe-surface-tile')
        }
        try { window.dispatchEvent(new Event('nhe-background')) } catch (e) {}
    }

    // tokens.css loads alongside (stylesheets don't block): wait for it
    var tries = 0
    var go = function () {
        if (!readDefault() && ++tries < 100) { setTimeout(go, 50); return }
        mod.setBackground(resolve(saved()), savedHeight())
        setSurface()
        // the list knows each image's grid; a file it no longer has (an
        // older set of images) goes back to NHE's texture
        NHE.backgroundList(function () {
            var name = saved()
            if (name && name !== MOD && name !== DEFAULT && !/^(https?:|data:|\/)/.test(name) && !entry(name)) {
                try { localStorage.removeItem(KEY); localStorage.removeItem(HEIGHT_KEY) } catch (e) {}
                mod.setBackground(resolve(saved()), savedHeight())
            }
            setSurface()
        })
    }
    go()
})
