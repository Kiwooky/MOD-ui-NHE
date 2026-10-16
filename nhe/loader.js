// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * NHE loader: the only file MOD's index.html points at.
 *
 *   <script type="text/javascript" src="nhe/loader.js?v=1"></script>
 *
 * Keep this file small and stable. MOD's server tells browsers to cache
 * static files for a year, so the loader asks for version.json fresh on
 * every page load and uses that version to fetch everything else: a deploy
 * that bumps version.json reaches every browser on the next reload, without
 * touching index.html again.
 *
 * Features are listed below. Each can be switched off with a MOD preference
 * "nhe-<id>" = "false" (the same store as Settings' "Show MOD Labs plugins").
 *
 * Plain ES5 on purpose.
 */
(function () {
    if (window.NHE) {
        return  // loaded twice (e.g. dev proxy + installed tag)
    }

    var script = document.currentScript
    var BASE = script ? script.src.replace(/loader\.js.*$/, '') : '/nhe/'

    var FEATURES = [
        {
            id: 'performance',
            files: [
                'features/performance/performance.css',
                'features/performance/performance.js',
                'features/performance/index.js'
            ]
        },
        {
            id: 'settings',
            files: [
                'components/icons.js',
                'components/slider/slider.css',
                'components/slider/slider.js',
                'components/controls/controls.css',
                'components/controls/controls.js',
                'components/controls/systembar.js',
                'components/controls/panel.js',
                'features/settings/settings.css',
                'features/settings/index.js'
            ]
        }
    ]

    var NHE = window.NHE = {
        base: BASE,
        version: null,
        features: {},
        log: function () {
            var args = Array.prototype.slice.call(arguments)
            args.unshift('[nhe]')
            if (window.console) console.log.apply(console, args)
        },
        enabled: function (id) {
            var prefs = window.PREFERENCES || {}
            return prefs['nhe-' + id] !== 'false'
        },
        // features call NHE.register('id', function (mod) { ... }) from their
        // index.js; the function runs once MOD's UI is ready
        register: function (id, start) {
            NHE.features[id] = { start: start, started: false }
        }
    }

    var loadFile = function (path, version, done) {
        var url = BASE + path + '?v=' + encodeURIComponent(version)
        var el
        if (/\.css$/.test(path)) {
            el = document.createElement('link')
            el.rel = 'stylesheet'
            el.type = 'text/css'
            el.href = url
            document.head.appendChild(el)
            done()  // stylesheets don't need to block
            return
        }
        el = document.createElement('script')
        el.type = 'text/javascript'
        el.src = url
        el.onload = function () { done() }
        el.onerror = function () { NHE.log('failed to load', path); done() }
        document.body.appendChild(el)
    }

    var loadAll = function (version) {
        NHE.version = version
        var queue = []
        FEATURES.forEach(function (f) {
            if (!NHE.enabled(f.id)) {
                NHE.log(f.id, 'is switched off (preference nhe-' + f.id + ')')
                return
            }
            f.files.forEach(function (file) { queue.push(file) })
        })
        // design tokens and the adapter first, then features in order
        queue.unshift('theme/tokens.css', 'adapter/mod.js')
        var next = function () {
            if (!queue.length) {
                NHE.mod.ready(function () {
                    Object.keys(NHE.features).forEach(function (id) {
                        var f = NHE.features[id]
                        if (f.started) return
                        f.started = true
                        try {
                            f.start(NHE.mod)
                            NHE.log(id, 'started')
                        } catch (e) {
                            NHE.log(id, 'failed to start:', e)
                        }
                    })
                })
                return
            }
            loadFile(queue.shift(), version, next)
        }
        next()
    }

    // version.json is fetched fresh every time (it is tiny)
    var xhr = new XMLHttpRequest()
    xhr.open('GET', BASE + 'version.json?t=' + Date.now())
    xhr.onload = function () {
        var v = 'unknown'
        try { v = JSON.parse(xhr.responseText).version || v } catch (e) {}
        loadAll(v)
    }
    xhr.onerror = function () { loadAll(String(Date.now())) }
    xhr.send()
})();
