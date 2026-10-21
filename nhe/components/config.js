// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE's settings, kept on the MOD. Features keep their settings in the
 * browser's localStorage (keys "nhe-…", and the performance view's
 * "mod-performance-…"). This mirrors them into one of MOD's own preferences
 * on the device ("nhe-config", a JSON string: NHE.mod.preference / setPreference), so every
 * browser that opens this MOD gets the same, and two MODs keep their own.
 *
 * At load (before any feature starts): the MOD's copy goes into
 * localStorage, replacing the browser's; a MOD without one yet takes this
 * browser's. Afterwards every change to one of those keys is sent to the
 * MOD (localStorage's setItem / removeItem are wrapped, so the features
 * need no changes; a burst of changes goes as one).
 *
 *   NHE.config.all()              // { key: value } of NHE's settings
 *   NHE.config.replace(values, cb) // all of them at once (an imported file), saved now: cb(ok)
 *   NHE.config.exportFile(cb)     // { name, text }: a .json file of them, labelled with this MOD
 *   NHE.config.parseFile(text)    // { values, from } or null
 *
 * Plain ES5. Needs the adapter (NHE.mod).
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var mod = NHE.mod
    var PREF = 'nhe-config'
    var SAVE_MS = 600
    var store = null
    try { store = window.localStorage } catch (e) {}
    if (!store || !mod || !mod.preference) return

    var ours = function (key) { return /^nhe-|^mod-performance-/.test(String(key)) && key !== PREF }
    var all = function () {
        var out = {}
        for (var i = 0; i < store.length; i++) {
            var k = store.key(i)
            if (ours(k)) out[k] = store.getItem(k)
        }
        return out
    }

    // the wrapped calls write through these, so applying the MOD's copy isn't sent back
    var proto = Object.getPrototypeOf(store)
    var setItem = proto.setItem, removeItem = proto.removeItem
    var put = function (values) {
        Object.keys(all()).forEach(function (k) { if (!(k in values)) removeItem.call(store, k) })
        Object.keys(values).forEach(function (k) { if (ours(k) && values[k] != null) setItem.call(store, k, String(values[k])) })
    }

    var send = function (cb) {
        mod.setPreference(PREF, JSON.stringify(all()))
            .done(function () { if (cb) cb(true) })
            .fail(function () { NHE.log("couldn't save NHE's settings on the MOD"); if (cb) cb(false) })
    }
    var timer = null
    var save = function () {
        clearTimeout(timer)
        timer = setTimeout(function () { send() }, SAVE_MS)
    }

    // ---- load: the MOD's copy wins; a MOD without one gets this browser's
    var onDevice = null
    try { onDevice = JSON.parse(mod.preference(PREF) || 'null') } catch (e) {}
    if (onDevice && typeof onDevice === 'object') put(onDevice)
    else if (Object.keys(all()).length) save()

    // ---- afterwards: changes go to the MOD
    proto.setItem = function (key, value) {
        var r = setItem.apply(this, arguments)
        if (this === store && ours(key)) save()
        return r
    }
    proto.removeItem = function (key) {
        var r = removeItem.apply(this, arguments)
        if (this === store && ours(key)) save()
        return r
    }

    NHE.config = {
        all: all,
        replace: function (values, cb) {
            put(values || {})
            clearTimeout(timer)
            send(cb)
        },
        exportFile: function (cb) {
            mod.systemInfo(function (info) {
                var from = info.hwname || info.model || 'MOD'
                var now = new Date(), two = function (n) { return (n < 10 ? '0' : '') + n }
                var day = now.getFullYear() + '-' + two(now.getMonth() + 1) + '-' + two(now.getDate())   // the local date
                var data = { nhe: 'settings', version: 1, from: from, release: info.release || '', saved: new Date().toISOString(), values: all() }
                cb({ name: 'nhe-settings-' + from.replace(/[^\w-]+/g, '-') + '-' + day + '.json', text: JSON.stringify(data, null, 2) })
            })
        },
        parseFile: function (text) {
            var d = null
            try { d = JSON.parse(text) } catch (e) { return null }
            if (!d || d.nhe !== 'settings' || !d.values || typeof d.values !== 'object') return null
            var values = {}
            Object.keys(d.values).forEach(function (k) { if (ours(k)) values[k] = String(d.values[k]) })
            return { values: values, from: d.from || '', saved: d.saved || '' }
        }
    }
})();
