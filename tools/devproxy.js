#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Niels
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Dev proxy: MOD's real UI with this repo's files layered on top.
 *
 *   node tools/devproxy.js                         # MOD Desktop (127.0.0.1:18181)
 *   node tools/devproxy.js --target 192.168.51.1   # the Duo over USB
 *   node tools/devproxy.js --port 18080
 *
 * Then open http://localhost:18080
 *
 * - Everything is passed through to the target, including the websocket.
 * - /nhe/... is served from ./nhe in this repo (never cached), so an edit is
 *   live on the next reload. Nothing on the target is changed.
 * - /playground/... is served from ./playground: component playgrounds that
 *   need no MOD at all (http://localhost:18080/playground/slider.html).
 *   `npm run playground` runs a second copy on :18090 for just that.
 * - HTML pages get the loader's <script> tag added before </body>, unless
 *   the target already has it installed.
 *
 * Node built-ins only: no npm install needed.
 */
'use strict'

const http = require('http')
const net = require('net')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const opt = (name, dflt) => {
    const i = args.indexOf('--' + name)
    return i >= 0 && args[i + 1] ? args[i + 1] : dflt
}

let target = opt('target', '127.0.0.1:18181').replace(/^https?:\/\//, '').replace(/\/$/, '')
if (!/:\d+$/.test(target)) target += ':80'
const [THOST, TPORT] = [target.split(':')[0], parseInt(target.split(':')[1], 10)]
const PORT = parseInt(opt('port', '18080'), 10)
const ROOT = path.resolve(__dirname, '..')
const NHE_DIR = path.join(ROOT, 'nhe')
const PLAYGROUND_DIR = path.join(ROOT, 'playground')
const TAG = '<script type="text/javascript" src="/nhe/loader.js?v=dev"></script>'

const TYPES = {
    '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.sh': 'text/plain',
}

// newest mtime under ./nhe, so version.json changes whenever a file does
const newestMtime = (dir) => {
    let newest = 0
    for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name)
        const st = fs.statSync(p)
        newest = Math.max(newest, st.isDirectory() ? newestMtime(p) : st.mtimeMs)
    }
    return newest
}

const serveLocal = (req, res, prefix = 'nhe', dir = NHE_DIR) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(new RegExp('^/' + prefix + '/?'), '')
    if (prefix === 'nhe' && rel === 'version.json') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
        res.end(JSON.stringify({ version: 'dev-' + Math.floor(newestMtime(NHE_DIR)) }))
        return
    }
    const file = path.join(dir, rel)
    if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('not in ./' + prefix + ': ' + rel)
        return
    }
    res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
    })
    fs.createReadStream(file).pipe(res)
}

const proxy = (req, res) => {
    const headers = Object.assign({}, req.headers, { host: target })
    delete headers['accept-encoding']  // keep HTML plain so the tag can be added
    const up = http.request({ host: THOST, port: TPORT, method: req.method, path: req.url, headers }, (ures) => {
        const type = ures.headers['content-type'] || ''
        const h = Object.assign({}, ures.headers)
        if (h.location) h.location = h.location.replace(/^https?:\/\/[^/]+/, '')
        if (!/text\/html/.test(type)) {
            res.writeHead(ures.statusCode, h)
            ures.pipe(res)
            return
        }
        const chunks = []
        ures.on('data', (c) => chunks.push(c))
        ures.on('end', () => {
            let body = Buffer.concat(chunks).toString('utf8')
            if (!/nhe\/loader\.js/.test(body) && /<\/body>/i.test(body)) {
                body = body.replace(/<\/body>/i, TAG + '</body>')
            }
            delete h['content-length']
            h['cache-control'] = 'no-store'
            res.writeHead(ures.statusCode, h)
            res.end(body)
        })
    })
    up.on('error', (e) => {
        res.writeHead(502, { 'Content-Type': 'text/plain' })
        res.end(`Can't reach MOD at ${target} (${e.code}). Is MOD Desktop running, or the Duo connected?`)
    })
    req.pipe(up)
}

const server = http.createServer((req, res) => {
    if (req.url === '/nhe' || req.url.startsWith('/nhe/')) return serveLocal(req, res)
    if (req.url.startsWith('/playground/')) return serveLocal(req, res, 'playground', PLAYGROUND_DIR)
    proxy(req, res)
})

// websocket (and any other upgrade): raw TCP pass-through
server.on('upgrade', (req, socket, head) => {
    const up = net.connect(TPORT, THOST, () => {
        let raw = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
            const k = req.rawHeaders[i]
            // mod-ui (Tornado) refuses websockets whose Origin isn't its own host
            const v = /^host$/i.test(k) ? target
                    : /^origin$/i.test(k) ? `http://${target}`
                    : req.rawHeaders[i + 1]
            raw += `${k}: ${v}\r\n`
        }
        up.write(raw + '\r\n')
        if (head && head.length) up.write(head)
        socket.pipe(up).pipe(socket)
    })
    const close = () => { socket.destroy(); up.destroy() }
    up.on('error', close)
    socket.on('error', close)
})

server.listen(PORT, () => {
    console.log(`NHE dev proxy: http://localhost:${PORT}  ->  MOD at ${target}`)
    console.log(`serving ./nhe live from ${NHE_DIR}`)
    console.log(`playgrounds: http://localhost:${PORT}/playground/slider.html`)
})
