// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Per-plugin colour: a plugin can take a colour of its own in place of the
 * system accent (purple). Needs controls.js and controls.css.
 *
 *   NHE.accent.palette()          // [{ name, hex }]: the swatches offered
 *   NHE.accent.custom(h, s, t)    // hue 0-360, saturation 0-100, brightness 0-1 -> hex
 *   NHE.accent.apply(el, hex)     // recolour el and everything in it; null = system
 *   NHE.ColourDialog({ plugin, value: hex | null, onPick: fn(hex | null) })   // onPick on Save
 *
 * Every colour keeps its relative luminance between MIN_L and MAX_L: darker
 * ones would vanish into the dark panel and slider tracks, lighter ones
 * can't carry the white text on headers, selected rows and buttons. So the
 * swatches and the custom colour are made by brightness (luminance), not by
 * HSL lightness: a yellow and a blue of the same "brightness" really are.
 *
 * Swatches: nine hues (yellow, orange, brown, red, pink, purple, blue, cyan,
 * green), each bright, muted and deep.
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon

    var MIN_L = 0.04, MAX_L = 0.28
    var STRONG = 0.58          // accent-strong = accent darkened to 58 % (system: purple-500 -> purple-800)

    // [name, hue, [[saturation, brightness 0-1 within MIN_L..MAX_L], ...]]
    var VARIANTS = [[90, 0.95], [65, 0.48], [85, 0.13]]          // bright, muted, deep
    var HUES = [
        ['Yellow', 48], ['Orange', 26], ['Brown', 22, [[55, 0.5], [45, 0.21], [50, 0.02]]],
        ['Red', 356], ['Pink', 328], ['Purple', 278], ['Blue', 218], ['Cyan', 188], ['Green', 135]
    ]

    var rgb = function (hex) {
        var h = String(hex).replace('#', '')
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
    }
    var toHex = function (c) { return '#' + c.map(function (v) { var x = Math.round(Math.max(0, Math.min(255, v))).toString(16); return x.length < 2 ? '0' + x : x }).join('') }
    var luminance = function (hex) {
        var lin = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
        var c = rgb(hex)
        return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
    }
    var darken = function (hex, f) { return toHex(rgb(hex).map(function (v) { return v * f })) }
    var hsl = function (h, s, l) {
        s /= 100; l /= 100
        var a = s * Math.min(l, 1 - l)
        var f = function (n) { var k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)) }
        return toHex([f(0) * 255, f(8) * 255, f(4) * 255])
    }
    // hex -> [hue, saturation] (HSL)
    var hueSat = function (hex) {
        var c = rgb(hex).map(function (v) { return v / 255 })
        var max = Math.max(c[0], c[1], c[2]), min = Math.min(c[0], c[1], c[2]), d = max - min, l = (max + min) / 2
        if (!d) return [0, 0]
        var h = max === c[0] ? ((c[1] - c[2]) / d) % 6 : max === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4
        return [(h * 60 + 360) % 360, d / (1 - Math.abs(2 * l - 1)) * 100]
    }
    // the colour of this hue and saturation at brightness t (0-1 between MIN_L and MAX_L)
    var custom = function (h, s, t) {
        var target = MIN_L + (MAX_L - MIN_L) * Math.max(0, Math.min(1, t))
        var lo = 0, hi = 100
        for (var i = 0; i < 24; i++) { var m = (lo + hi) / 2; if (luminance(hsl(h, s, m)) < target) lo = m; else hi = m }
        return hsl(h, s, lo)
    }
    var brightness = function (hex) { return (luminance(hex) - MIN_L) / (MAX_L - MIN_L) }

    // the vars that carry the accent; selection and border-focus are set too,
    // since on :root they resolve to the system accent before inheriting
    var VARS = ['--nhe-accent-default', '--nhe-accent-strong', '--nhe-selection', '--nhe-border-focus']

    NHE.accent = {
        palette: function () {
            var out = []
            HUES.forEach(function (h) {
                ;(h[2] || VARIANTS).forEach(function (v, i) {
                    out.push({ name: h[0] + ' ' + ['bright', 'muted', 'deep'][i], hex: custom(h[1], v[0], v[1]) })
                })
            })
            return out
        },
        custom: custom,
        apply: function (node, hex) {
            if (!node) return
            if (!hex) { VARS.forEach(function (v) { node.style.removeProperty(v) }); return }
            node.style.setProperty('--nhe-accent-default', hex)
            node.style.setProperty('--nhe-accent-strong', darken(hex, STRONG))
            node.style.setProperty('--nhe-selection', hex)
            node.style.setProperty('--nhe-border-focus', hex)
        }
    }

    // ---- the picker: a grid of swatches, in the addressing dialog's frame --

    var Dialog = function (options) {
        var self = this
        this.o = mix({ plugin: '', value: null }, options || {})
        this.value = this.o.value
        var overlay = this.overlay = el('div', 'nhe-ctl nhe-dialog-overlay', document.body)
        var d = el('div', 'nhe-dialog nhe-colour-dialog', overlay)
        d.setAttribute('role', 'dialog')
        d.setAttribute('aria-modal', 'true')
        d.setAttribute('aria-label', this.o.plugin + ' colour')
        d.setAttribute('tabindex', '-1')
        NHE.accent.apply(overlay, this.o.value)

        var head = el('div', 'nhe-dialog__header', d)
        el('span', 'nhe-dialog__plugin', head).textContent = this.o.plugin
        el('span', 'nhe-dialog__pill', head).textContent = 'Colour'

        el('div', 'nhe-dialog__title', d, icon('palette') + '<span>Plugin colour</span>')
        var grid = el('div', 'nhe-swatches', d)
        grid.setAttribute('role', 'listbox')
        var palette = NHE.accent.palette(), inPalette = false
        var swatch = function (parent, hex, label, cls) {
            var b = el('button', 'nhe-swatch' + (cls ? ' ' + cls : ''), parent)
            b.type = 'button'
            b.setAttribute('aria-label', label)
            b.title = label
            b.style.setProperty('--swatch', hex || 'var(--nhe-color-purple-500)')
            if (String(hex || '') === String(self.o.value || '')) { b.classList.add('is-selected'); inPalette = true }
            b.addEventListener('click', function () { self.select(hex, b) })
            return b
        }
        // two hues to a row, bright / muted / deep; System fills the last row
        palette.forEach(function (c) { swatch(grid, c.hex, c.name) })
        el('span', null, swatch(grid, null, 'System colour', 'nhe-swatch--system')).textContent = 'System'

        // custom: hue, saturation and brightness; brightness stays within
        // what works on the dark panel with white text
        el('div', 'nhe-dialog__title', d, '<span>Custom</span>')
        var cust = el('div', 'nhe-custom', d)
        var start = this.o.value && !inPalette ? this.o.value : null
        var hs = start ? hueSat(start) : [278, 65]
        this.h = hs[0]; this.s = hs[1]; this.t = start ? Math.max(0, Math.min(1, brightness(start))) : 0.5
        this.preview = swatch(cust, start || custom(this.h, this.s, this.t), 'Custom colour', 'nhe-custom__preview')
        if (start) this.preview.classList.add('is-selected')
        this.preview.addEventListener('click', function () { self.pickCustom() })
        var bars = el('div', 'nhe-custom__bars', cust)
        this.bars = {
            h: this.bar(bars, 'Hue', 'h', 360),
            s: this.bar(bars, 'Saturation', 's', 100),
            t: this.bar(bars, 'Brightness', 't', 1)
        }
        this.paintBars()
        if (start) this.preview.style.setProperty('--swatch', start)   // exactly as saved, not re-derived

        el('div', 'nhe-dialog__note', d).textContent = 'Every copy of this plugin takes the colour, on every pedalboard, in this browser.'

        var foot = el('div', 'nhe-dialog__buttons', d)
        foot.appendChild(NHE.textButton('Cancel', 'secondary', function () { self.close() }))
        foot.appendChild(NHE.textButton('Save', 'primary', function () { self.save() }))

        d.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); self.close() }
        })
        d.addEventListener('keyup', function (e) { e.stopPropagation() })
        NHE.dragScroll(d)
        setTimeout(function () { d.focus() }, 0)
    }

    // a tap previews the colour in the dialog; Save applies it, Cancel doesn't
    Dialog.prototype.select = function (hex, button) {
        this.value = hex
        var all = this.overlay.querySelectorAll('.nhe-swatch')
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('is-selected', all[i] === button)
        NHE.accent.apply(this.overlay, hex)
    }

    Dialog.prototype.pickCustom = function () {
        var hex = custom(this.h, this.s, this.t)
        this.preview.style.setProperty('--swatch', hex)
        this.select(hex, this.preview)
    }

    // a horizontal bar with a knob, dragged with the pointer (MOD blocks the
    // touch scrolling a native range input would need on a tablet)
    Dialog.prototype.bar = function (parent, label, key, max) {
        var self = this
        var row = el('div', 'nhe-custom__row', parent)
        el('span', 'nhe-custom__label', row).textContent = label
        var track = el('div', 'nhe-range', row)
        var knob = el('span', 'nhe-range__knob', track)
        track.setAttribute('role', 'slider')
        track.setAttribute('aria-label', label)
        var set = function (e) {
            var r = track.getBoundingClientRect()
            var f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width))
            self[key] = f * max
            self.paintBars()
            self.pickCustom()
        }
        var move = function (e) { e.preventDefault(); set(e) }
        var up = function () {
            document.removeEventListener('pointermove', move)
            document.removeEventListener('pointerup', up)
            document.removeEventListener('pointercancel', up)
        }
        track.addEventListener('pointerdown', function (e) {
            e.preventDefault()
            set(e)
            document.addEventListener('pointermove', move)
            document.addEventListener('pointerup', up)
            document.addEventListener('pointercancel', up)
        })
        return { track: track, knob: knob, max: max }
    }

    // each bar shows what moving along it gives, from the other two
    Dialog.prototype.paintBars = function () {
        var h = this.h, s = this.s, t = this.t, b = this.bars, stops = []
        for (var i = 0; i <= 12; i++) stops.push(custom(i * 30, s, t))
        b.h.track.style.background = 'linear-gradient(to right, ' + stops.join(', ') + ')'
        b.s.track.style.background = 'linear-gradient(to right, ' + custom(h, 0, t) + ', ' + custom(h, 50, t) + ', ' + custom(h, 100, t) + ')'
        b.t.track.style.background = 'linear-gradient(to right, ' + custom(h, s, 0) + ', ' + custom(h, s, 0.5) + ', ' + custom(h, s, 1) + ')'
        b.h.knob.style.left = (h / 360 * 100) + '%'
        b.s.knob.style.left = s + '%'
        b.t.knob.style.left = (t * 100) + '%'
        this.preview.style.setProperty('--swatch', custom(h, s, t))
    }

    Dialog.prototype.save = function () {
        if (typeof this.o.onPick === 'function' && this.value !== this.o.value) this.o.onPick(this.value)
        this.close()
    }

    Dialog.prototype.close = function () {
        if (!this.overlay) return
        this.overlay.parentNode.removeChild(this.overlay)
        this.overlay = null
    }

    NHE.ColourDialog = function (options) { return new Dialog(options) }
})();
