// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Per-plugin colour: a plugin can take one of MOD's colours in place of the
 * system accent (purple). Needs controls.js and controls.css.
 *
 *   NHE.accent.palette()          // [{ index, hex }]: the colours offered
 *   NHE.accent.apply(el, hex)     // recolour el and everything in it; null = system
 *   NHE.ColourDialog({ plugin, value: hex | null, onPick: fn(hex | null) })   // onPick on Save
 *
 * The palette is MOD's 32 port-group colours (--group-N-color, copied into
 * tokens.css as --nhe-color-mod-group-N), minus the extremes: near-black ones
 * would vanish into the dark panel and slider tracks, and pale ones can't
 * carry the white text on headers, selected rows and buttons. A colour stays
 * when its relative luminance is between MIN_L and MAX_L.
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon

    var MOD = ['#de7558', '#16aca6', '#74a16b', '#ec2469', '#860fda', '#d4ba3d', '#819393', '#9951bf',
               '#dfb6a5', '#b9a843', '#81dea8', '#ab386b', '#4d80dd', '#ebe65a', '#0b575b', '#5755f7',
               '#3dc745', '#f51034', '#84d08b', '#cab8b0', '#425265', '#341b05', '#055538', '#1ae35c',
               '#9d0b8e', '#6f8c9a', '#f91114', '#069758', '#2340b9', '#3f7cbb', '#8185d4', '#080f1f']
    var MIN_L = 0.03, MAX_L = 0.35
    var STRONG = 0.58          // accent-strong = accent darkened to 58 % (system: purple-500 -> purple-800)

    var rgb = function (hex) {
        var h = String(hex).replace('#', '')
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
    }
    var luminance = function (hex) {
        var lin = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
        var c = rgb(hex)
        return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
    }
    var darken = function (hex, f) {
        return '#' + rgb(hex).map(function (v) { var s = Math.round(v * f).toString(16); return s.length < 2 ? '0' + s : s }).join('')
    }

    // the vars that carry the accent; selection and border-focus are set too,
    // since on :root they resolve to the system accent before inheriting
    var VARS = ['--nhe-accent-default', '--nhe-accent-strong', '--nhe-selection', '--nhe-border-focus']

    NHE.accent = {
        palette: function () {
            var out = []
            MOD.forEach(function (hex, i) {
                var l = luminance(hex)
                if (l >= MIN_L && l <= MAX_L) out.push({ index: i, hex: hex })
            })
            return out
        },
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
        var swatch = function (hex, label) {
            var b = el('button', 'nhe-swatch' + (String(hex || '') === String(self.o.value || '') ? ' is-selected' : ''), grid)
            b.type = 'button'
            b.setAttribute('role', 'option')
            b.setAttribute('aria-label', label)
            b.style.setProperty('--swatch', hex || 'var(--nhe-color-purple-500)')
            if (!hex) el('span', null, b).textContent = 'System'
            b.addEventListener('click', function () { self.select(hex, b) })
        }
        swatch(null, 'System colour')
        NHE.accent.palette().forEach(function (c) { swatch(c.hex, 'MOD colour ' + c.index) })

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
        var all = button.parentNode.children
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('is-selected', all[i] === button)
        NHE.accent.apply(this.overlay, hex)
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
