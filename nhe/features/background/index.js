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
 * Until something is chosen, NHE's texture shows (tokens.css: --nhe-texture,
 * tiled --nhe-texture-height tall), the same image as the constructor's.
 * The choice is remembered in this browser. It shows on MOD's builder, in
 * the performance view and on NHE's builder (the constructor's surface:
 * --nhe-surface-texture / --nhe-surface-tile on the page, and an
 * 'nhe-background' event on window so it redraws). NHE's own texture there
 * keeps its holes lined up with the grid ("NHE constructor grid").
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
    var setSurface = function () {
        var root = document.documentElement.style, name = saved(), url = null, height = null
        if (name === MOD) { var w = mod.builderWood(); url = w.url; height = w.height }
        else if (name && name !== DEFAULT) { url = resolve(name); height = savedHeight() || 300 }
        if (url) {
            root.setProperty('--nhe-surface-texture', 'url("' + String(url).replace(/["\\\n]/g, '') + '")')
            root.setProperty('--nhe-surface-tile', height + 'px')
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
    }
    go()
})
