// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later
// Same file as html/js/performance.js on the performance-view branch of
// Kiwooky/mod-ui. Keep them in sync: this layer is where it is developed,
// the branch is where it goes upstream.

/*
 * Performance view
 *
 * Shows the pedals of the current pedalboard one at a time, as large as the
 * screen allows (capped at 2x native size), in a swipeable carousel. Flip
 * and Hide sit in two pills on the active (centred) pedal's top-left
 * corner. Pedals hidden from the view gather in a tile at the end.
 *
 * Each pedal has two sides. The front is its own GUI; Flip turns it over and
 * its back opens out over the whole view with the pedal's settings. By
 * default the back is MOD's own settings panel; options.renderBack can put
 * something else there (NHE puts its settings screen).
 *
 * The pedal faces and settings shown here are the *same* DOM elements the
 * editor uses: they are moved in on enter and moved back on exit. So every
 * control stays bound to the same modgui instance, and parameter, bypass,
 * preset and addressing changes stay in sync with the editor, the device and
 * other browsers without any extra plumbing.
 *
 * While the view is open the pedalboard is flagged 'performanceMode', which
 * pauses its layout code (fitToWindow, adapt, focusPlugin, drawPluginJacks),
 * because the moved icons no longer sit on the canvas.
 */

function PerformanceView(options) {
    var self = this

    options = $.extend({
        pedalboard: null,   // #pedalboard-dashboard
        view: null,         // #performance-view
        trigger: null,      // footer bolt icon
        exitTrigger: null,  // footer puzzle (Constructor) icon
        // fills the back of a flipped pedal: fn(instance, container, api) ->
        // true if it did; api = { flipBack(), flipTo(instance) }. When it
        // returns false (or isn't given), the back shows MOD's settings panel.
        renderBack: null,
        // an optional way out on the centred pedal, at its top-right corner
        // (mirroring Flip and Hide): { label, icon (svg markup) }; it closes
        // the view as the exitTrigger does
        exitButton: null,
    }, options)

    var MAX_SCALE   = 2.0
    var GAP         = 48  // px between pedals
    var PAD_Y       = 28  // px above and below the pedal
    var POLL_MS     = 400
    var SETTLE_MS   = 140
    var STORAGE_KEY = 'mod-performance-view'
    var HIDDEN_KEY  = 'mod-performance-hidden'
    var TILE        = ':hidden'  // pseudo instance of the "N hidden" tile

    var pb       = options.pedalboard
    var view     = options.view
    var stage    = view.find('.performance-stage')
    var track    = view.find('.performance-track')
    var empty    = view.find('.performance-empty')
    var trigger  = options.trigger

    var isOpen       = false
    var slides       = []     // [{instance, slide, scaler, icon, settings, w, h}]
    var active       = -1
    var shownSettings = null  // MOD's settings element currently on the back
    var flipped      = null   // the slide whose back is showing
    var signature    = ''
    var builtFor     = null   // pedalboard bundle the carousel was last built for
    // A pedalboard's plugins arrive one by one over the websocket, in no
    // particular order. Until the new board settles (or the user moves), keep
    // re-picking its starting pedal instead of sticking to whichever plugin
    // happened to arrive first.
    var settling     = 0      // timestamp until which the start pedal is re-picked
    var pollTimer    = null
    var settleTimer  = null
    var scrollRaf    = null
    var spacerL      = $('<div class="performance-spacer">')
    var spacerR      = $('<div class="performance-spacer">')

    // Flip and Hide: pills on the centred pedal's top-left corner, half
    // outside it (so they stay clear of a pedal that fills the screen)
    var FLIP = '<svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M27.75 6V19C27.75 19.4641 27.5656 19.9092 27.2374 20.2374C26.9092 20.5656 26.4641 20.75 26 20.75H11.8112L13.53 22.47C13.6037 22.5387 13.6628 22.6215 13.7038 22.7135C13.7448 22.8055 13.7668 22.9048 13.7686 23.0055C13.7704 23.1062 13.7518 23.2062 13.7141 23.2996C13.6764 23.393 13.6203 23.4778 13.549 23.549C13.4778 23.6203 13.393 23.6764 13.2996 23.7141C13.2062 23.7518 13.1062 23.7704 13.0055 23.7686C12.9048 23.7668 12.8055 23.7448 12.7135 23.7038C12.6215 23.6628 12.5387 23.6037 12.47 23.53L9.47 20.53C9.32955 20.3894 9.25066 20.1988 9.25066 20C9.25066 19.8012 9.32955 19.6106 9.47 19.47L12.47 16.47C12.6122 16.3375 12.8002 16.2654 12.9945 16.2688C13.1888 16.2723 13.3742 16.351 13.5116 16.4884C13.649 16.6258 13.7277 16.8112 13.7312 17.0055C13.7346 17.1998 13.6625 17.3878 13.53 17.53L11.8112 19.25H26C26.0663 19.25 26.1299 19.2237 26.1768 19.1768C26.2237 19.1299 26.25 19.0663 26.25 19V6C26.25 5.9337 26.2237 5.87011 26.1768 5.82322C26.1299 5.77634 26.0663 5.75 26 5.75H12C11.9337 5.75 11.8701 5.77634 11.8232 5.82322C11.7763 5.87011 11.75 5.9337 11.75 6V7C11.75 7.19891 11.671 7.38968 11.5303 7.53033C11.3897 7.67098 11.1989 7.75 11 7.75C10.8011 7.75 10.6103 7.67098 10.4697 7.53033C10.329 7.38968 10.25 7.19891 10.25 7V6C10.25 5.53587 10.4344 5.09075 10.7626 4.76256C11.0908 4.43437 11.5359 4.25 12 4.25H26C26.4641 4.25 26.9092 4.43437 27.2374 4.76256C27.5656 5.09075 27.75 5.53587 27.75 6ZM21 24.25C20.8011 24.25 20.6103 24.329 20.4697 24.4697C20.329 24.6103 20.25 24.8011 20.25 25V26C20.25 26.0663 20.2237 26.1299 20.1768 26.1768C20.1299 26.2237 20.0663 26.25 20 26.25H6C5.9337 26.25 5.87011 26.2237 5.82322 26.1768C5.77634 26.1299 5.75 26.0663 5.75 26V13C5.75 12.9337 5.77634 12.8701 5.82322 12.8232C5.87011 12.7763 5.9337 12.75 6 12.75H20.1887L18.47 14.47C18.3963 14.5387 18.3372 14.6215 18.2962 14.7135C18.2552 14.8055 18.2332 14.9048 18.2314 15.0055C18.2296 15.1062 18.2482 15.2062 18.2859 15.2996C18.3236 15.393 18.3797 15.4778 18.451 15.549C18.5222 15.6203 18.607 15.6764 18.7004 15.7141C18.7938 15.7518 18.8938 15.7704 18.9945 15.7686C19.0952 15.7668 19.1945 15.7448 19.2865 15.7038C19.3785 15.6628 19.4613 15.6037 19.53 15.53L22.53 12.53C22.6705 12.3894 22.7493 12.1988 22.7493 12C22.7493 11.8012 22.6705 11.6106 22.53 11.47L19.53 8.47C19.3878 8.33752 19.1998 8.2654 19.0055 8.26882C18.8112 8.27225 18.6258 8.35097 18.4884 8.48838C18.351 8.62579 18.2723 8.81118 18.2688 9.00548C18.2654 9.19978 18.3375 9.38782 18.47 9.53L20.1887 11.25H6C5.53587 11.25 5.09075 11.4344 4.76256 11.7626C4.43437 12.0908 4.25 12.5359 4.25 13V26C4.25 26.4641 4.43437 26.9092 4.76256 27.2374C5.09075 27.5656 5.53587 27.75 6 27.75H20C20.4641 27.75 20.9092 27.5656 21.2374 27.2374C21.5656 26.9092 21.75 26.4641 21.75 26V25C21.75 24.8011 21.671 24.6103 21.5303 24.4697C21.3897 24.329 21.1989 24.25 21 24.25Z"/></svg>'  // Phosphor Swap
    var EYE_OFF = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c5.5 0 9 5.5 9.5 7-.3.8-1.3 2.6-3 4.2M6.6 6.6C4.4 8 3 10.2 2.5 12c.6 1.7 4 7 9.5 7 1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
    var tools = $('<div class="performance-tools">')
    var flipButton = $('<button type="button" class="performance-flip" title="Flip the pedal: its settings are on the back" aria-label="Flip">' + FLIP + '<span>Flip</span></button>').appendTo(tools)
    var hideButton = $('<button type="button" class="performance-hide" title="Hide this pedal from the performance view" aria-label="Hide">' + EYE_OFF + '<span>Hide</span></button>').appendTo(tools)
    var exitTools = null
    if (options.exitButton) {
        exitTools = $('<div class="performance-tools performance-tools-exit">')
        $('<button type="button" class="performance-exit">').attr({ title: options.exitButton.label, 'aria-label': options.exitButton.label })
            .html((options.exitButton.icon || '') + '<span></span>').appendTo(exitTools)
            .click(function () { options.exitTrigger.click(); return false })
            .find('span').text(options.exitButton.label)
    }
    var tile = null  // the "N hidden" slide at the end, created on demand
    var TILE_ITEM_W = 120, TILE_ITEM_H = 104, TILE_HEAD = 56, TILE_PAD = 16
    // the back of a flipped pedal, opened out over the whole view
    var back = $('<div class="performance-back">').appendTo(view).hide()

    // set window.PERFORMANCE_VIEW_DEBUG = true in the console to trace
    var debug = function () {
        if (!window.PERFORMANCE_VIEW_DEBUG || !window.console) return
        var a = Array.prototype.slice.call(arguments)
        a.unshift('[performance]')
        console.log.apply(console, a)
    }

    this.isOpen = function () {
        return isOpen
    }

    // ------------------------------------------------------------------
    // state (AC: re-enter on last pedal, reset when the pedalboard changes)

    var boardKey = function () {
        return (desktop && desktop.pedalboardBundle) || ''
    }
    var saveState = function () {
        if (active < 0 || !slides[active] || Date.now() < settling) {
            return  // nothing chosen yet, or a new board is still arriving
        }
        var state = { bundle: boardKey(), instance: slides[active].instance }
        self._state = state
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch (e) {}
    }
    var loadState = function () {
        if (self._state) {
            return self._state
        }
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch (e) { return null }
    }

    // Hidden pedals, per pedalboard, in this browser only:
    // { "<bundle path>": ["/graph/instance", ...] }
    var hiddenMap = null
    var loadHidden = function () {
        try { hiddenMap = JSON.parse(localStorage.getItem(HIDDEN_KEY)) || {} } catch (e) { hiddenMap = hiddenMap || {} }
    }
    var hiddenList = function () {
        if (!hiddenMap) loadHidden()
        return (hiddenMap[boardKey()] || []).slice()
    }
    var saveHidden = function (list) {
        if (!hiddenMap) loadHidden()
        if (list.length) hiddenMap[boardKey()] = list
        else delete hiddenMap[boardKey()]
        try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenMap)) } catch (e) {}
    }
    // other tabs of this browser
    window.addEventListener('storage', function (e) {
        if (e.key !== HIDDEN_KEY) return
        loadHidden()
        if (isOpen) rebuild()
    })

    // ------------------------------------------------------------------
    // plugin order: follow the signal, left to right

    var instanceOf = function (port) {
        return port.substring(0, port.lastIndexOf('/'))
    }

    var canvasPos = function (icon) {
        // inline left/top are the canvas coordinates; computed values are
        // overridden by our CSS while the icon is on stage
        var el = icon[0]
        return { x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 }
    }

    this.signalOrder = function () {
        var plugins = pb.data('plugins') || {}
        var connMgr = pb.data('connectionManager')
        var ids = Object.keys(plugins).filter(function (k) {
            return plugins[k] && plugins[k].data && plugins[k].data('gui')
        })
        var known = {}, edges = {}, indeg = {}, depth = {}
        ids.forEach(function (i) { known[i] = true; edges[i] = {}; indeg[i] = 0 })

        var from, to, a, b
        for (from in (connMgr ? connMgr.origIndex : {})) {
            a = instanceOf(from)
            if (!known[a]) continue
            for (to in connMgr.origIndex[from]) {
                b = instanceOf(to)
                if (!known[b] || a === b || edges[a][b]) continue
                edges[a][b] = true
                indeg[b]++
            }
        }

        // longest path from a source = signal-flow depth (Kahn's algorithm)
        var queue = ids.filter(function (i) { return indeg[i] === 0 })
        queue.forEach(function (i) { depth[i] = 0 })
        while (queue.length) {
            a = queue.shift()
            for (b in edges[a]) {
                depth[b] = Math.max(depth[b] || 0, depth[a] + 1)
                if (--indeg[b] === 0) queue.push(b)
            }
        }
        // anything left is part of a feedback loop: put it after the rest
        var maxDepth = 0
        ids.forEach(function (i) { if (depth[i] != null) maxDepth = Math.max(maxDepth, depth[i]) })
        ids.forEach(function (i) { if (depth[i] == null) depth[i] = maxDepth + 1 })

        var pos = {}
        ids.forEach(function (i) { pos[i] = canvasPos(plugins[i]) })
        ids.sort(function (p, q) {
            return (depth[p] - depth[q]) || (pos[p].x - pos[q].x) || (pos[p].y - pos[q].y)
        })
        return ids
    }

    var currentSignature = function () {
        var plugins = pb.data('plugins') || {}
        var connMgr = pb.data('connectionManager')
        var keys = Object.keys(plugins).sort().join('|')
        var conns = connMgr ? Object.keys(connMgr.origIndex).map(function (f) {
            return f + '>' + Object.keys(connMgr.origIndex[f]).sort().join(',')
        }).sort().join('|') : ''
        return boardKey() + '#' + keys + '#' + conns
    }

    // ------------------------------------------------------------------
    // moving the editor's elements in and out

    var takeIcon = function (icon) {
        icon.addClass('performance-icon')
        if (icon.data('ui-draggable') || icon.data('draggable')) icon.draggable('disable')
        if (icon.data('ui-droppable') || icon.data('droppable')) icon.droppable('disable')
    }

    var returnIcon = function (icon) {
        icon.removeClass('performance-icon')
        if (icon.data('ui-draggable') || icon.data('draggable')) icon.draggable('enable')
        if (icon.data('ui-droppable') || icon.data('droppable')) icon.droppable('enable')
        icon.appendTo(pb)
    }

    // the default back: MOD's own settings panel, moved in
    var showSettings = function (settings) {
        if (shownSettings && shownSettings[0] === (settings && settings[0])) {
            return
        }
        hideSettings()
        if (!settings || !settings.length) {
            return
        }
        shownSettings = settings
        settings.addClass('performance-settings').appendTo(back)
        // centre the controls when they fit, scroll from the start when they don't
        settings.find('.mod-controls').scrollLeft(0)
    }

    // Flip and Hide go on the centred pedal (not on the hidden tile)
    var showStrip = function (s) {
        if (s && !s.tile) tools.appendTo(s.slide)
        else tools.detach()
        if (exitTools) {
            if (s && !s.tile) exitTools.appendTo(s.slide)
            else exitTools.detach()
        }
    }

    var thumbnailUrl = function (icon) {
        var gui = icon.data('gui')
        var v = gui && gui.effect && gui.effect.renderedVersion
        return '/effect/image/thumbnail.png?uri=' + escape(icon.data('uri')) + (v ? '&v=' + v : '')
    }

    var renderShelf = function () {
        var plugins = pb.data('plugins') || {}
        var hidden = {}
        hiddenList().forEach(function (i) { hidden[i] = true })
        var ids = self.signalOrder().filter(function (i) { return hidden[i] })

        var shelf = tile.box.empty()
        var head = $('<div class="performance-shelf-head">').appendTo(shelf)
        $('<span>').html(EYE_OFF).appendTo(head)
        $('<b>').text(ids.length + ' hidden').appendTo(head)
        if (ids.length > 1) {
            $('<button type="button" class="performance-show-all">Show all</button>').appendTo(head).click(function () {
                saveHidden([])
                rebuild({ focus: ids[0] })
            })
        }
        // a column of pedals, more columns to the right as needed
        var row = $('<div class="performance-shelf-row">').appendTo(shelf)
        ids.forEach(function (instance) {
            var icon = plugins[instance]
            var item = $('<button type="button" class="performance-shelf-item">').attr('title', 'Show in the performance view')
            $('<span class="performance-shelf-thumb">').append($('<img alt="">').attr('src', thumbnailUrl(icon))).appendTo(item)
            $('<span class="performance-shelf-label">').text(icon.data('label') || instance.split('/').pop()).appendTo(item)
            item.click(function () {
                saveHidden(hiddenList().filter(function (i) { return i !== instance }))
                rebuild({ focus: instance })
            })
            row.append(item)
        })
    }

    var hideSettings = function () {
        if (!shownSettings) {
            return
        }
        shownSettings.removeClass('performance-settings').hide().appendTo($('body'))
        shownSettings = null
    }

    // ------------------------------------------------------------------
    // flipping: the back opens out over the whole view

    var FLIP_MS = 180

    var fillBack = function (s) {
        back.children('.performance-back-bar').remove()
        var api = { flipBack: function () { self.flipBack() }, flipTo: function (instance) { self.flipTo(instance) } }
        if (typeof options.renderBack === 'function' && options.renderBack(s.instance, back, api)) {
            hideSettings()
            return
        }
        // MOD's panel, with a Flip back button above it
        back.children().not(shownSettings || $()).detach()
        var bar = $('<div class="performance-back-bar">').prependTo(back)
        $('<button type="button" class="performance-flip">' + FLIP + '<span>Flip back</span></button>').appendTo(bar).click(function () { self.flipBack() })
        $('<span class="performance-back-title">').text(s.icon.data('label') || s.instance.split('/').pop()).appendTo(bar)
        showSettings(s.settings)
    }

    this.isFlipped = function () { return !!flipped }

    // The pedal itself never moves: turning it would narrow it mid-flip and
    // make the carousel wobble. Only the back turns, in over the pedal and
    // away again.
    this.flip = function () {
        var s = slides[active]
        if (!s || s.tile || flipped || !isOpen) return
        flipped = s
        view.addClass('performance-flipped')
        back.show().removeClass('performance-back-out').addClass('performance-back-in')
        fillBack(s)
    }

    // now: no animation (closing the view, the pedal went away)
    this.flipBack = function (now) {
        var s = flipped
        if (!s) return
        flipped = null
        var done = function () {
            back.hide().removeClass('performance-back-in performance-back-out')
            hideSettings()
            view.removeClass('performance-flipped')
        }
        if (now) { done(); return }
        back.removeClass('performance-back-in').addClass('performance-back-out')
        setTimeout(function () { if (!flipped) done() }, FLIP_MS)
    }

    // straight to another pedal's back (the chain's hop). From a back that
    // is showing, the new back replaces it at once (no flip, no slide: too
    // much movement for the whole view); from the front, it flips as usual.
    this.flipTo = function (instance) {
        var wasFlipped = !!flipped
        var idx = slides.findIndex(function (x) { return x.instance === instance })
        if (idx < 0 && hiddenList().indexOf(instance) >= 0) {
            // hidden from the view: show it again, it's what was asked for
            saveHidden(hiddenList().filter(function (i) { return i !== instance }))
            rebuild({ focus: instance })
            idx = slides.findIndex(function (x) { return x.instance === instance })
        }
        if (idx < 0) return
        settling = 0
        setActive(idx, true)
        scrollToIndex(idx, false)
        if (wasFlipped && flipped) {
            back.removeClass('performance-back-in performance-back-out')
            flipped = slides[idx]
            fillBack(flipped)
            return
        }
        self.flipBack(true)
        flipped = slides[idx]
        view.addClass('performance-flipped')
        back.show().removeClass('performance-back-out').addClass('performance-back-in')
        fillBack(flipped)
    }

    flipButton.click(function () { self.flip() })

    hideButton.click(function () {
        var s = slides[active]
        if (!s || s.tile) return
        var pedals = slides.filter(function (x) { return !x.tile })
        var i = pedals.indexOf(s)
        // the next pedal slides into the middle; at the end, the previous one
        var next = pedals[i + 1] || pedals[i - 1]
        saveHidden(hiddenList().concat([s.instance]))
        rebuild({ focus: next ? next.instance : TILE })
    })

    // ------------------------------------------------------------------
    // building and laying out the carousel

    var rebuild = function (opts) {
        opts = opts || {}
        // Flip and Hide (and the way out) ride on a slide: lift them off first,
        // or removing that slide (jQuery's remove) would take their click handlers with it
        tools.detach()
        if (exitTools) exitTools.detach()
        var all = self.signalOrder()
        var hidden = {}
        hiddenList().forEach(function (i) { hidden[i] = true })
        var order = all.filter(function (i) { return !hidden[i] })
        var hiddenCount = all.length - order.length
        var key = boardKey()
        var plugins = pb.data('plugins') || {}
        // A pedalboard load swaps every plugin, and the bundle name may update
        // before or after the new plugins arrive. Treat "none of the pedals we
        // were showing survived" as a board change too.
        var survivors = slides.filter(function (s) {
            return !s.tile && s.icon && plugins[s.instance] && plugins[s.instance][0] === s.icon[0]
        }).length
        var boardChanged = key !== builtFor || (slides.some(function (s) { return !s.tile }) && survivors === 0)
        builtFor = key
        if (boardChanged) settling = Date.now() + 3000
        var repick = Date.now() < settling
        debug('rebuild', { key: key, boardChanged: boardChanged, survivors: survivors, order: order, active: active })
        // a different pedalboard starts again at its first pedal, even if it
        // happens to use the same instance names
        var prevInstance = !boardChanged && !repick && active >= 0 && slides[active] ? slides[active].instance : null
        var prevIndex = boardChanged || repick ? -1 : active
        var byInstance = {}
        slides.forEach(function (s) { if (!s.tile) byInstance[s.instance] = s })

        var next = []
        order.forEach(function (instance) {
            var icon = plugins[instance]
            var s = byInstance[instance]
            if (!s) {
                s = { instance: instance }
                s.slide  = $('<div class="performance-slide">').attr('data-instance', instance)
                s.scaler = $('<div class="performance-scaler">').appendTo(s.slide)
            }
            delete byInstance[instance]
            if (s.icon && s.icon[0] !== icon[0] && s.icon.data('gui')) {
                // instance was replaced by another plugin (a removed icon has
                // already lost its data and stays gone)
                returnIcon(s.icon)
            }
            if (!icon.parent().is(s.scaler)) {
                takeIcon(icon)
                icon.appendTo(s.scaler)
            }
            if (!s.icon || s.icon[0] !== icon[0]) {
                s.icon = icon
                measure(s)
            }
            s.settings = icon.data('settings')
            next.push(s)
        })

        // slides whose plugin is gone (removed, or the pedalboard changed)
        for (var gone in byInstance) {
            var g = byInstance[gone]
            if (g.icon && g.icon.parent().is(g.scaler) && g.icon.data('gui')) {
                returnIcon(g.icon)
            }
            if (flipped === g) self.flipBack(true)
            g.slide.remove()
        }

        if (hiddenCount) {
            if (!tile) {
                tile = { instance: TILE, tile: true, nw: 180, nh: 250, maxScale: 1 }
                tile.slide  = $('<div class="performance-slide performance-tile">').attr('data-instance', TILE)
                tile.scaler = $('<div class="performance-scaler">').appendTo(tile.slide)
                tile.box    = $('<div class="performance-tile-box">').appendTo(tile.scaler)
            }
            tile.count = hiddenCount
            renderShelf()
            next.push(tile)
        }

        slides = next
        active = -1  // indexes may have shifted; setActive() below re-applies classes
        track.children().detach()
        track.append(spacerL)
        slides.forEach(function (s) { track.append(s.slide) })
        track.append(spacerR)

        empty.toggle(slides.length === 0)
        if (slides.length === 0) {
            active = -1
            showStrip(null)
            return
        }

        layout(true)

        // which pedal should be active?
        var idx = -1
        if (opts.focus) {
            idx = slides.findIndex(function (s) { return s.instance === opts.focus })
        }
        if (idx < 0 && prevInstance) {
            idx = slides.findIndex(function (s) { return s.instance === prevInstance })
            if (idx < 0 && prevIndex >= 0) {
                // same board, pedal removed: stay close to where we were
                idx = Math.min(prevIndex, slides.length - 1)
            }
        }
        if (idx < 0) {
            var state = loadState()
            if (state && state.bundle === boardKey()) {
                idx = slides.findIndex(function (s) { return s.instance === state.instance })
            }
        }
        if (idx < 0) idx = 0
        if (slides[idx].tile && slides.length > 1 && !opts.focus && prevInstance !== TILE) idx = 0  // don't open on the tile
        setActive(idx, true)
        scrollToIndex(idx, false)
    }

    // Native pedal size. offsetWidth/Height ignore transforms, so this works
    // while the pedal is scaled; it only changes if the face itself changes.
    var measure = function (s) {
        if (s.tile) return true
        s.nw = s.icon.outerWidth()
        s.nh = s.icon.outerHeight()
        return s.nw > 0 && s.nh > 0
    }

    var lastStage = ''
    var layout = function (force) {
        if (!slides.length) {
            return false
        }
        var stageW = stage[0].clientWidth
        var stageH = stage[0].clientHeight
        var key = stageW + 'x' + stageH
        var remeasured = false
        slides.forEach(function (s) {
            if (!s.nw || !s.nh) remeasured = measure(s) || remeasured
        })
        if (!force && !remeasured && key === lastStage) {
            return false  // nothing to do: never touch styles needlessly, it repaints every pedal
        }
        lastStage = key

        var availH = Math.max(40, stageH - PAD_Y * 2)
        var availW = Math.max(40, stageW * 0.86)
        // the hidden tile: full height, a column of pedals, then more columns
        if (tile && slides.indexOf(tile) >= 0) {
            var rows = Math.max(1, Math.floor((availH - TILE_HEAD - TILE_PAD) / TILE_ITEM_H))
            var cols = Math.max(1, Math.ceil((tile.count || 1) / rows))
            tile.nh = availH
            tile.nw = Math.max(180, cols * TILE_ITEM_W + (cols - 1) * 8 + TILE_PAD * 2)
            tile.box.css('--rows', rows)
        }
        slides.forEach(function (s, i) {
            var w = s.nw || 200, h = s.nh || 300
            var scale = Math.min(s.maxScale || MAX_SCALE, availH / h, availW / w)
            var gap = i === slides.length - 1 ? 0 : GAP
            if (scale === s.scale && w === s.lw && h === s.lh && gap === s.gap) return
            s.scale = scale
            s.lw = w
            s.lh = h
            s.gap = gap
            s.w = w * scale
            s.h = h * scale
            s.scaler.css({ width: w, height: h, transform: 'scale(' + scale + ')' })
            s.slide.css({ width: s.w, height: s.h, marginRight: gap })
        })
        spacerL.css('width', Math.max(0, (stageW - slides[0].w) / 2))
        spacerR.css('width', Math.max(0, (stageW - slides[slides.length - 1].w) / 2))
        return true
    }

    // Programmatic moves are animated by hand with snapping switched off:
    // browsers cancel or re-snap native smooth scrolls inside a snap container.
    var animating = null
    var scrollToIndex = function (idx, smooth) {
        var s = slides[idx]
        if (!s) return
        var el = stage[0]
        var target = Math.round(s.slide[0].offsetLeft + s.w / 2 - el.clientWidth / 2)
        target = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, target))
        if (animating) {
            cancelAnimationFrame(animating.raf)
            animating = null
        }
        if (!smooth) {
            el.scrollLeft = target
            return
        }
        var from = el.scrollLeft
        var start = null
        var duration = Math.min(450, 180 + Math.abs(target - from) * 0.25)
        stage.addClass('performance-animating')
        var step = function (ts) {
            if (start === null) start = ts
            var t = Math.min(1, (ts - start) / duration)
            var e = 1 - Math.pow(1 - t, 3)  // ease-out cubic
            el.scrollLeft = from + (target - from) * e
            if (t < 1) {
                animating.raf = requestAnimationFrame(step)
            } else {
                animating = null
                stage.removeClass('performance-animating')
                setActive(idx, false)
            }
        }
        animating = { raf: requestAnimationFrame(step), idx: idx }
    }

    var nearestIndex = function () {
        var el = stage[0]
        var centre = el.scrollLeft + el.clientWidth / 2
        var best = -1, bestDist = Infinity
        slides.forEach(function (s, i) {
            var c = s.slide[0].offsetLeft + s.w / 2
            var d = Math.abs(c - centre)
            if (d < bestDist) { bestDist = d; best = i }
        })
        return best
    }

    var setActive = function (idx, immediateSettings) {
        if (idx < 0 || idx >= slides.length) return
        if (idx !== active) {
            debug('setActive', idx, slides[idx] && slides[idx].instance, new Error().stack.split('\n')[2])
            slides.forEach(function (s, i) { s.slide.toggleClass('active', i === idx) })
            active = idx
            saveState()
        }
        clearTimeout(settleTimer)
        if (immediateSettings) {
            showStrip(slides[idx])
        } else {
            settleTimer = setTimeout(function () {
                if (slides[active]) showStrip(slides[active])
            }, SETTLE_MS)
        }
    }

    this.goTo = function (idx) {
        settling = 0  // the user has taken over
        idx = Math.max(0, Math.min(slides.length - 1, idx))
        setActive(idx, false)
        scrollToIndex(idx, true)
    }

    // ------------------------------------------------------------------
    // input

    stage.on('scroll', function () {
        if (scrollRaf) return
        scrollRaf = requestAnimationFrame(function () {
            scrollRaf = null
            if (animating) return  // the animation knows where it is going
            var idx = nearestIndex()
            if (idx >= 0) setActive(idx, false)
        })
    })

    // only horizontal scrolling moves the carousel (the browser's own, with
    // scroll-snap centring); a vertical wheel is left to the pedals, whose
    // GUIs turn knobs with it. Arrow keys and the neighbours still step.
    // any hands-on scrolling ends the "new board" re-picking
    stage[0].addEventListener('touchstart', function () { settling = 0 }, { passive: true })
    stage[0].addEventListener('wheel', function (e) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) settling = 0
    }, { passive: true })

    // a pointer that lands on a neighbouring pedal selects it instead of
    // touching its controls
    var slideIndexOf = function (target) {
        var slide = $(target).closest('.performance-slide')
        if (!slide.length) return -1
        return slides.findIndex(function (s) { return s.slide[0] === slide[0] })
    }
    var touchStart = null
    stage[0].addEventListener('touchstart', function (e) {
        var idx = slideIndexOf(e.target)
        if (idx < 0 || idx === active) { touchStart = null; return }
        e.stopPropagation()  // keep it away from the pedal's widgets, but allow swiping
        var t = e.touches[0]
        touchStart = { idx: idx, x: t.clientX, y: t.clientY }
    }, true)
    stage[0].addEventListener('touchmove', function (e) {
        if (!touchStart) return
        e.stopPropagation()
        var t = e.touches[0]
        if (Math.abs(t.clientX - touchStart.x) > 10 || Math.abs(t.clientY - touchStart.y) > 10) touchStart.moved = true
    }, true)
    stage[0].addEventListener('touchend', function (e) {
        if (!touchStart) return
        e.stopPropagation()
        if (!touchStart.moved) {
            e.preventDefault()  // no synthetic mouse events
            self.goTo(touchStart.idx)
        }
        touchStart = null
    }, true)
    var blockNeighbour = function (e) {
        var idx = slideIndexOf(e.target)
        if (idx < 0 || idx === active) return
        e.stopPropagation()
        e.preventDefault()
        if (e.type === 'click') self.goTo(idx)
    }
    ;['mousedown', 'mouseup', 'click', 'dblclick'].forEach(function (type) {
        stage[0].addEventListener(type, blockNeighbour, true)
    })

    // desktop.js cancels every touchmove that reaches <body> (no page
    // scrolling or rubber-banding). Our carousel and the hidden tile need native
    // scrolling, so stop those events here. Knobs still cancel their own
    // touches, so dragging a knob turns it instead of scrolling.
    view[0].addEventListener('touchmove', function (e) {
        e.stopPropagation()
    }, { passive: true })

    $(document).on('keydown', function (e) {
        if (!isOpen || !view.is(':visible') || flipped) return
        if ($(e.target).is('input, textarea, select, [contenteditable]')) return
        if (e.keyCode === 37) { self.goTo(active - 1); e.preventDefault() }
        if (e.keyCode === 39) { self.goTo(active + 1); e.preventDefault() }
    })

    // Only real window resizes / rotations. (jquery.ba-resize, used elsewhere
    // in the UI, triggers 'resize' on elements and those bubble up to window;
    // reacting to them re-laid-out and re-centred the carousel mid-swipe.)
    var resizeTimer = null
    $(window).on('resize orientationchange', function (e) {
        if (!isOpen || e.target !== window) return
        clearTimeout(resizeTimer)
        resizeTimer = setTimeout(function () {
            var keep = active
            if (layout(false) && keep >= 0) {
                scrollToIndex(keep, false)
                setActive(keep, true)
            }
        }, 120)
    })

    // ------------------------------------------------------------------
    // footer icon state while other windows open on top of us

    // Other main windows (pedalboards, banks, files, store) open on top of
    // the view and leave it running underneath; show the bolt as selected
    // only while nothing covers it.
    var coveringWindow = function () {
        var wins = (typeof WINDOWMANAGER !== 'undefined' && WINDOWMANAGER) ? WINDOWMANAGER.windows : []
        return wins.some(function (w) {
            return w[0] !== view[0] && w.data('isMainWindow') && w.is(':visible')
        })
    }
    var syncFooter = function () {
        if (!isOpen) return
        var covered = coveringWindow()
        trigger.toggleClass('selected', !covered)
        if (!covered) options.exitTrigger.removeClass('selected')
    }
    $(document).on('windowopen windowclose', function () {
        // window.js updates the footer icons after triggering these
        setTimeout(syncFooter, 0)
    })

    // ------------------------------------------------------------------
    // enter / exit

    // instance (optional): open on that pedal
    this.open = function (instance) {
        if (isOpen) {
            if (instance) rebuild({ focus: instance })
            return
        }
        isOpen = true
        pb.data('performanceMode', true)
        $('body').addClass('performance-mode')
        trigger.addClass('selected')
        options.exitTrigger.removeClass('selected')
        view.show()

        slides = []
        active = -1
        builtFor = null
        signature = currentSignature()
        rebuild(instance ? { focus: instance } : undefined)

        pollTimer = setInterval(function () {
            syncFooter()
            // plugins and connections can change under us (another browser,
            // the device, a pedalboard load); follow along
            // pedal faces can change size after we measured them (their
            // stylesheet or images arrive late on a first load): re-measure
            // (reads only) and, if anything moved, re-lay out and re-centre
            // the active pedal so the browser's snapping can't pick another
            var resized = false
            slides.forEach(function (sl) {
                if (sl.tile) return
                var w = sl.nw, h = sl.nh
                measure(sl)
                if (sl.nw !== w || sl.nh !== h) resized = true
            })
            if (resized && layout(true) && active >= 0 && !animating) {
                debug('pedal size changed, re-centring', active)
                scrollToIndex(active, false)
            }
            var sig = currentSignature()
            if (sig !== signature) {
                signature = sig
                rebuild()
            }
        }, POLL_MS)
    }

    this.close = function () {
        if (!isOpen) return
        isOpen = false
        clearInterval(pollTimer)
        clearTimeout(settleTimer)
        saveState()

        self.flipBack(true)
        showStrip(null)
        slides.forEach(function (s) {
            if (s.icon && s.icon.parent().is(s.scaler) && s.icon.data('gui')) returnIcon(s.icon)
        })
        slides = []
        active = -1
        track.children().detach()
        view.hide()
        trigger.removeClass('selected')
        options.exitTrigger.addClass('selected')
        $('body').removeClass('performance-mode')

        pb.data('performanceMode', false)
        if (pb.data('performancePendingFit')) {
            pb.data('performancePendingFit', false)
            pb.pedalboard('fitToWindow')
        }
        // redraw cables in case anything moved or connected while we were away
        var plugins = pb.data('plugins') || {}
        for (var instance in plugins) {
            if (plugins[instance] && plugins[instance].data) pb.pedalboard('drawPluginJacks', plugins[instance])
        }
    }

    trigger.click(function () {
        self.open()
        return false
    })
    options.exitTrigger.click(function () {
        self.close()
    })
}
