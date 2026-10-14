// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE.mod: the ONLY place that touches MOD's internals.
 *
 * Features talk to this object, never to MOD's globals or private methods
 * directly. When a MOD release changes something, fix it here.
 *
 * What it relies on, safest first:
 *   - HTTP endpoints / the websocket       (shared with device, app, other browsers)
 *   - modgui.js GUI objects                 (standalone library, also used by the SDK)
 *   - globals: desktop, PREFERENCES, WINDOWMANAGER, element ids in index.html
 *   - wrapping $.fn.pedalboard               (most fragile; see guardPedalboard)
 *
 * Checked against mod-ui 1.14 RC4 (v1.14.0.3366) and master 2026-10-07.
 */
(function () {
    var mod = NHE.mod = {}

    // ------------------------------------------------------------------
    // lifecycle

    // runs cb once MOD's UI has built its desktop and pedalboard
    mod.ready = function (cb) {
        var check = function () {
            if (window.desktop && desktop.pedalboard && desktop.pedalboard.data('plugins')) {
                cb()
            } else {
                setTimeout(check, 100)
            }
        }
        $(check)
    }

    // ------------------------------------------------------------------
    // globals, behind names we control

    mod.desktop = function () { return window.desktop }
    mod.pedalboard = function () { return desktop.pedalboard }        // jQuery element
    mod.plugins = function () { return desktop.pedalboard.data('plugins') || {} }  // instance -> icon
    mod.gui = function (instance) {
        var icon = mod.plugins()[instance]
        return icon && icon.data ? icon.data('gui') : null
    }
    mod.preference = function (key) { return (window.PREFERENCES || {})[key] }
    mod.setPreference = function (key, value) {
        // same endpoint Settings uses; persists in /data on the device
        window.PREFERENCES = window.PREFERENCES || {}
        PREFERENCES[key] = value
        return $.ajax({ url: '/config/set', type: 'POST', data: { key: key, value: value } })
    }

    // ------------------------------------------------------------------
    // footer bar (#main-menu)

    // adds an icon after `afterSelector` (default: the Constructor icon)
    mod.addFooterIcon = function (id, title, afterSelector) {
        var existing = $('#main-menu #' + id)
        if (existing.length) return existing
        var icon = $('<div class="icon">').attr('id', id).attr('data-message', title)
        icon.insertAfter($(afterSelector || '#main-menu #mod-plugins'))
        if ($.fn.statusTooltip) icon.statusTooltip()
        return icon
    }
    mod.constructorIcon = function () { return $('#main-menu #mod-plugins') }

    // the full-height area between MOD's header and footer, for views
    mod.addView = function (id, html) {
        var existing = $('#' + id)
        if (existing.length) return existing
        return $(html).attr('id', id).insertBefore($('#main-menu'))
    }

    // ------------------------------------------------------------------
    // Pedalboard guard (the fragile part)
    //
    // While a feature has borrowed plugin icons off the canvas (performance
    // view), set  mod.pedalboard().data('performanceMode', true)  and:
    //  - canvas layout pauses (fitToWindow is deferred until it's cleared)
    //  - value/enable/parameter updates from the host go straight to the
    //    plugin's GUI, because pedalboard.js only looks for icons on the canvas
    //
    // This mirrors the small pedalboard.js changes on the performance-view
    // branch; once those are upstream this wrapper becomes unnecessary.
    var guarded = false
    mod.guardPedalboard = function () {
        if (guarded) return
        guarded = true
        var original = $.fn.pedalboard
        $.fn.pedalboard = function (method) {
            var self = this
            if (self.data && self.data('performanceMode')) {
                if (method === 'fitToWindow') {
                    self.data('performancePendingFit', true)
                    return self
                }
                if (method === 'adapt' || method === 'focusPlugin' || method === 'drawPluginJacks') {
                    return self
                }
                var a = arguments
                var icon = (self.data('plugins') || {})[a[1]]
                var gui = icon && icon.data && icon.data('gui')
                if (gui && !$.contains(self[0], icon[0]) && $.contains(document.documentElement, icon[0])) {
                    if (method === 'setPortWidgetsValue') {
                        gui.setPortWidgetsValue(a[2], a[3], null, true)
                        return
                    }
                    if (method === 'setPortEnabled') {
                        if (a[3] || a[4]) gui.enable(a[2]); else gui.disable(a[2])
                        if (a[5]) gui.addressPort(a[2], a[4], a[6])
                        return
                    }
                    if (method === 'setWritableParameterValue') {
                        gui.setWritableParameterValue(a[2], a[3], a[4], null, true)
                        return
                    }
                }
            }
            return original.apply(this, arguments)
        }
    }
})();
