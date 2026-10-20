// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Confirm dialog: a yes / no question, in the addressing dialog's frame
 * (plugin name with a pill, a titled message, No / Yes). Used to delete a
 * plugin from its settings screen. Needs controls.js and controls.css.
 *
 *   NHE.ConfirmDialog({
 *       plugin: 'Bollie Delay', pill: 'Delete',
 *       title: 'Delete this plugin?', icon: 'remove',
 *       text: 'What feeds it is connected to what it feeds.',
 *       yes: 'Yes', no: 'No',
 *       accent: null | '#rrggbb',      // the plugin's colour (colour.js)
 *       onYes: fn(), onNo: fn()
 *   })
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var H = NHE.controlHelpers, el = H.el, mix = H.mix, icon = H.icon

    NHE.ConfirmDialog = function (options) {
        var o = mix({ plugin: '', pill: '', title: 'Are you sure?', icon: 'info', text: '', yes: 'Yes', no: 'No', accent: null }, options || {})
        var overlay = el('div', 'nhe-ctl nhe-dialog-overlay', document.body)
        var d = el('div', 'nhe-dialog nhe-confirm-dialog', overlay)
        d.setAttribute('role', 'alertdialog')
        d.setAttribute('aria-modal', 'true')
        d.setAttribute('aria-label', o.title)
        d.setAttribute('tabindex', '-1')
        if (o.accent && NHE.accent) NHE.accent.apply(overlay, o.accent)

        var head = el('div', 'nhe-dialog__header', d)
        el('span', 'nhe-dialog__plugin', head).textContent = o.plugin
        if (o.pill) el('span', 'nhe-dialog__pill', head).textContent = o.pill

        var f = el('div', 'nhe-dialog__field', d)
        el('div', 'nhe-dialog__title', f, icon(o.icon) + '<span></span>').lastChild.textContent = o.title
        if (o.text) el('div', 'nhe-dialog__note', f).textContent = o.text

        var close = function (fn) {
            if (!overlay.parentNode) return
            overlay.parentNode.removeChild(overlay)
            if (typeof fn === 'function') fn()
        }
        var foot = el('div', 'nhe-dialog__buttons', d)
        foot.appendChild(NHE.textButton(o.no, 'secondary', function () { close(o.onNo) }))
        var yes = NHE.textButton(o.yes, 'primary', function () { close(o.onYes) })
        foot.appendChild(yes)

        d.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(o.onNo) }
        })
        // MOD listens for keys on the page: keep ours in here
        d.addEventListener('keyup', function (e) { e.stopPropagation() })
        setTimeout(function () { yes.focus() }, 0)
    }
})();
