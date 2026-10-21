// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Tempo and sync dialog: MOD's transport window (sync mode, beats per minute,
 * beats per bar, transport) in the addressing dialog's frame, centred on
 * tablet and desktop, full screen on a phone. Three columns of the plugin
 * panel's controls: the sync mode list with the transport under it (stacked,
 * as the panel stacks lists and switches), then two sliders. Needs
 * controls.js, controls.css, slider.js, slider.css and icons.js
 * (NHE.menuIcons: stop, play).
 *
 * The dialog only draws; the host sets the values and takes the changes.
 *
 *   var dlg = NHE.TempoDialog({
 *       state: { bpm: 120, bpb: 4, rolling: false, sync: 'none' | 'midi_clock_slave' | 'link' },
 *       bindings: { ':bpm': binding, ':bpb': binding, ':rolling': binding },   // as the controls take them
 *       onSync: fn(mode), onBpm: fn(bpm), onBpb: fn(bpb), onRolling: fn(on),
 *       onSettings: fn(symbol),    // a control's settings icon (':bpm', ':bpb', ':rolling')
 *       onClose: fn()
 *   })
 *   dlg.update(state, bindings)   // from the host (MIDI clock, Link, the device)
 *   dlg.close()
 *
 *   new NHE.Transport(el, { title, value: rolling, binding, onChange: fn(on), onSettings, onBlocked })
 *       the transport cell: a stop and a play button, the one that holds lit
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix

    var SYNC = ['none', 'midi_clock_slave', 'link']
    var SYNC_LABELS = ['Internal', 'MIDI clock', 'Ableton Link']      // MOD: Internal, MIDI, Ableton Link

    // ---- Transport cell ----------------------------------------------------

    var Transport = H.extend(function (root, options) {
        var self = this
        this.init(root, 'nhe-cell nhe-transport', options, { title: 'Transport', value: false, binding: null })
        var n = this.n = {}
        n.title = el('span', null, el('div', 'nhe-cell__title', root))
        var pair = el('div', 'nhe-transport__pair', root)
        var button = function (name, label, on) {
            var b = el('button', 'nhe-transport__button', pair, (NHE.menuIcons && NHE.menuIcons[name]) || '')
            b.type = 'button'
            b.setAttribute('aria-label', label)
            b.addEventListener('click', function () {
                if (self.locked()) { self.blocked(); return }
                if (self.o.value === on) return
                self.o.value = on
                self.render()
                self.emit('onChange', on)
            })
            return b
        }
        n.stop = button('stop', 'Stop', false)
        n.play = button('play', 'Play', true)
        this.footer(root)
        this.overlay()
        this.render()
    })

    Transport.prototype.render = function () {
        this.n.title.textContent = this.o.title
        this.n.stop.classList.toggle('is-on', !this.o.value)
        this.n.play.classList.toggle('is-on', !!this.o.value)
        this.n.stop.setAttribute('aria-pressed', this.o.value ? 'false' : 'true')
        this.n.play.setAttribute('aria-pressed', this.o.value ? 'true' : 'false')
        this.renderBinding()
    }

    Transport.prototype.setValue = function (v) { this.o.value = !!v; this.render() }

    // ---- the dialog ----------------------------------------------------------

    NHE.TempoDialog = function (options) {
        var o = mix({ state: {}, bindings: {} }, options || {})
        var st = mix({ bpm: 120, bpb: 4, rolling: false, sync: 'none' }, o.state)
        var bind = function (symbol) { return (o.bindings && o.bindings[symbol]) || null }
        var call = function (name, arg) { if (typeof o[name] === 'function') o[name](arg) }

        // MOD's page is laid out 980+ px wide everywhere, so a phone is told by
        // NHE.zoom (upright: > 1), not by a media query
        var full = NHE.zoom && NHE.zoom() > 1
        var overlay = el('div', 'nhe-ctl nhe-dialog-overlay' + (full ? ' is-full' : ''), document.body)
        var d = el('div', 'nhe-dialog nhe-tempo-dialog' + (full ? ' is-full' : ''), overlay)
        d.setAttribute('role', 'dialog')
        d.setAttribute('aria-modal', 'true')
        d.setAttribute('aria-label', 'Tempo and sync')
        d.setAttribute('tabindex', '-1')
        el('span', 'nhe-dialog__plugin', el('div', 'nhe-dialog__header', d)).textContent = 'Tempo and sync'

        var body = el('div', 'nhe-tempo__body', d)
        var stack = el('div', 'nhe-tempo__stack', body)
        var sync = new NHE.OptionList(el('div', null, stack), {
            title: 'Sync mode',
            options: SYNC_LABELS.map(function (label, i) { return { label: label, value: i } }),
            value: Math.max(0, SYNC.indexOf(st.sync)),
            onChange: function (i) { call('onSync', SYNC[i]) }
        })
        sync.root.classList.add('is-first', 'nhe-tempo__sync')
        var transport = new Transport(el('div', null, stack), {
            value: st.rolling, binding: bind(':rolling'),
            onChange: function (on) { call('onRolling', on) },
            onSettings: function () { call('onSettings', ':rolling') }
        })
        // the sliders are as tall as the stack beside them
        body.style.setProperty('--nhe-slider-height', stack.offsetHeight + 'px')
        var slider = function (title, symbol, value, min, max, unit, emit) {
            var s = new NHE.Slider(el('div', null, body), {
                title: title, value: value, min: min, max: max, unit: unit, integer: true,
                binding: bind(symbol),
                onInput: emit, onChange: emit,
                onSettings: function () { call('onSettings', symbol) }
            })
            return s
        }
        // MOD's ports: 20 - 280 BPM and 1 - 16 beats, both whole numbers (transport.js)
        var bpm = slider('Beats per minute', ':bpm', st.bpm, 20, 280, 'BPM', function (v) { call('onBpm', v) })
        var bpb = slider('Beats per bar', ':bpb', st.bpb, 1, 16, '/4', function (v) { call('onBpb', v) })

        var close = function () {
            if (!overlay.parentNode) return
            overlay.parentNode.removeChild(overlay)
            ;[bpm, bpb].forEach(function (s) { if (s.destroy) s.destroy() })
            call('onClose')
        }
        var foot = el('div', 'nhe-dialog__buttons', d)
        foot.appendChild(NHE.textButton('Close', 'primary', close))

        // the scrim closes it, as do Escape and Close
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close() })
        d.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); close() }
            e.stopPropagation()          // MOD listens for keys on the page
        })
        d.addEventListener('keyup', function (e) { e.stopPropagation() })
        if (NHE.dragScroll) NHE.dragScroll(d)
        setTimeout(function () { d.focus() }, 0)

        return {
            update: function (state, bindings) {
                if (state) {
                    st = mix(st, state)
                    sync.setValue(Math.max(0, SYNC.indexOf(st.sync)))
                    transport.setValue(st.rolling)
                    bpm.setValue(st.bpm)
                    bpb.setValue(st.bpb)
                }
                if (bindings) {
                    o.bindings = bindings
                    transport.update({ binding: bind(':rolling') })
                    bpm.update({ binding: bind(':bpm') })
                    bpb.update({ binding: bind(':bpb') })
                }
            },
            close: close
        }
    }

    NHE.Transport = Transport
})();
