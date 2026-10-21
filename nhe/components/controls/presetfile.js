// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Presets file dialog: a plugin's user presets to a file, and a file's
 * presets added to them. In the addressing dialog's frame (plugin name with
 * a pill). It only draws; the host does the work and reports back. Needs
 * controls.js and controls.css.
 *
 *   NHE.PresetFileDialog({
 *       plugin: 'Bollie Delay', accent: null | '#rrggbb',
 *       count: fn() -> number,                 // its user presets now
 *       onExport: fn(progress(text), done(message, ok)),
 *       onImport: fn(text, progress(text), done(message, ok))   // the picked file's text
 *   })
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon

    NHE.PresetFileDialog = function (options) {
        var o = mix({ plugin: '', accent: null, count: function () { return 0 } }, options || {})
        var overlay = el('div', 'nhe-ctl nhe-dialog-overlay', document.body)
        var d = el('div', 'nhe-dialog nhe-presetfile-dialog', overlay)
        d.setAttribute('role', 'dialog')
        d.setAttribute('aria-modal', 'true')
        d.setAttribute('aria-label', 'Presets file')
        d.setAttribute('tabindex', '-1')
        if (o.accent && NHE.accent) NHE.accent.apply(overlay, o.accent)

        var head = el('div', 'nhe-dialog__header', d)
        el('span', 'nhe-dialog__plugin', head).textContent = o.plugin
        el('span', 'nhe-dialog__pill', head).textContent = 'Presets'

        var section = function (iconName, title, note, label, run) {
            var f = el('div', 'nhe-dialog__field nhe-presetfile-dialog__section', d)
            el('div', 'nhe-dialog__title', f, icon(iconName) + '<span></span>').lastChild.textContent = title
            var n = el('div', 'nhe-dialog__note', f)
            n.textContent = note
            var b = NHE.textButton(label, 'secondary', run)
            b.classList.add('nhe-presetfile-dialog__button')
            f.appendChild(b)
            return { note: n, button: b }
        }
        var count = o.count()
        var exp = section('bookmarks', 'Export user presets',
            count + ' user preset' + (count === 1 ? '' : 's') + ' to a file on this device. Each is loaded once to read it (you may hear it switch), then the plugin goes back to how it was.',
            'Export', function () { start('onExport') })
        var imp = section('file', 'Import presets',
            "Adds a file's presets to this plugin's user presets. Only a file exported for this plugin is taken.",
            'Import from file', function () { picker.value = ''; picker.click() })
        if (!count) exp.button.disabled = true
        el('div', 'nhe-dialog__note nhe-presetfile-dialog__limit', d).textContent = 'Knob, switch and list settings only: files a preset holds (models, IRs) are not in the file.'
        var status = el('div', 'nhe-dialog__note nhe-presetfile-dialog__status', d)
        status.setAttribute('role', 'status')

        var picker = el('input', null, d)
        picker.type = 'file'
        picker.accept = '.json,application/json'
        picker.style.display = 'none'           // MOD's styles show [hidden] inputs
        picker.addEventListener('change', function () {
            var file = picker.files && picker.files[0]
            if (!file) return
            var reader = new FileReader()
            reader.onload = function () { start('onImport', String(reader.result || '')) }
            reader.readAsText(file)
        })

        var busy = false
        var set = function (on) {
            busy = on
            exp.button.disabled = on || !o.count()
            imp.button.disabled = on
            close.disabled = on
            d.classList.toggle('is-busy', on)
        }
        var start = function (name, text) {
            if (busy || typeof o[name] !== 'function') return
            set(true)
            status.classList.remove('is-error')
            var progress = function (t) { status.textContent = t }
            var done = function (message, ok) {
                set(false)
                status.textContent = message || ''
                status.classList.toggle('is-error', ok === false)
            }
            if (name === 'onImport') o.onImport(text, progress, done)
            else o.onExport(progress, done)
        }

        var shut = function () { if (!busy && overlay.parentNode) overlay.parentNode.removeChild(overlay) }
        var foot = el('div', 'nhe-dialog__buttons', d)
        var close = NHE.textButton('Close', 'primary', shut)
        foot.appendChild(close)
        d.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); shut() }
            e.stopPropagation()               // MOD listens for keys on the page
        })
        d.addEventListener('keyup', function (e) { e.stopPropagation() })
        setTimeout(function () { d.focus() }, 0)
    }
})();
