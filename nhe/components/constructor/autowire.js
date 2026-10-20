// SPDX-FileCopyrightText: 2026 New Horizon Electronics
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Automatic wiring for the touch friendly constructor (docs/constructor-spec.md).
 * Given a new pedal, the pedals and MOD ports picked to feed it and the ones
 * it should feed, works out which ports to connect, and which existing wires
 * to remove when the new pedal goes between two pedals that were connected.
 * Pure: no MOD, no DOM, so the playground and the device share it.
 *
 * A node (a pedal, or one of MOD's own ports):
 *   { id, ports: { audio: { in: [portId], out: [portId] },
 *                  midi:  { in: [...], out: [...] },
 *                  cv:    { in: [...], out: [...] } },
 *     channel: 'L' | 'R' }      // MOD's mono Audio In / Out (L) and (R) only
 *
 *   NHE.autowire.canFeed(source, pedal)    // source has an output pedal can take
 *   NHE.autowire.canTake(target, pedal)    // target has an input pedal can feed
 *   NHE.autowire.plan(pedal, inputs, outputs, connections)
 *       -> { connect: [[from, to]], disconnect: [[from, to]] }
 *   NHE.autowire.heal(pedal, connections) -> [[from, to]]
 *       // the pedal is about to go: what feeds it is joined straight to
 *       // what it feeds, as if it were bypassed (each output takes the
 *       // input of its own index, or the last one: in L -> out L, in R ->
 *       // out R, mono in -> both outs), per type; none already there
 *
 * The rules (to be tried, then refined):
 *   - audio: L to L and R to R; a mono output into a stereo pedal feeds
 *     both its inputs; stereo into mono takes L. MOD's Audio In (L) / (R)
 *     go to the pedal's left / right input, and its left / right output
 *     goes to Audio Out (L) / (R) (a mono pedal feeds both).
 *   - MIDI only to MIDI, CV only to CV (first port to first port).
 *   - Inserting: when a picked input already feeds a picked output, those
 *     wires go: the new pedal now sits between them.
 */
(function () {
    var NHE = window.NHE = window.NHE || {}
    var TYPES = ['audio', 'midi', 'cv']

    var ports = function (node, type, dir) {
        return (node && node.ports && node.ports[type] && node.ports[type][dir]) || []
    }

    // one source's outputs into one target's inputs
    var link = function (type, outs, ins, srcChannel, dstChannel) {
        if (!outs.length || !ins.length) return []
        if (type !== 'audio') return [[outs[0], ins[0]]]
        if (srcChannel) return [[outs[0], ins.length > 1 && srcChannel === 'R' ? ins[1] : ins[0]]]
        if (dstChannel) return [[outs.length > 1 && dstChannel === 'R' ? outs[1] : outs[0], ins[0]]]
        if (outs.length === 1) return ins.map(function (i) { return [outs[0], i] })   // mono into stereo: both
        if (ins.length === 1) return [[outs[0], ins[0]]]                              // stereo into mono: L
        var out = []
        for (var k = 0; k < Math.min(outs.length, ins.length); k++) out.push([outs[k], ins[k]])
        return out
    }

    var wire = function (from, to) {
        var out = []
        TYPES.forEach(function (t) {
            out = out.concat(link(t, ports(from, t, 'out'), ports(to, t, 'in'), from.channel, to.channel))
        })
        return out
    }

    var owns = function (node, portId) {
        return TYPES.some(function (t) {
            return ports(node, t, 'in').indexOf(portId) >= 0 || ports(node, t, 'out').indexOf(portId) >= 0
        })
    }

    NHE.autowire = {
        canFeed: function (source, pedal) {
            return TYPES.some(function (t) { return ports(source, t, 'out').length && ports(pedal, t, 'in').length })
        },
        canTake: function (target, pedal) {
            return TYPES.some(function (t) { return ports(pedal, t, 'out').length && ports(target, t, 'in').length })
        },
        plan: function (pedal, inputs, outputs, connections) {
            var connect = [], disconnect = []
            ;(inputs || []).forEach(function (src) { connect = connect.concat(wire(src, pedal)) })
            ;(outputs || []).forEach(function (dst) { connect = connect.concat(wire(pedal, dst)) })
            ;(connections || []).forEach(function (c) {
                var between = (inputs || []).some(function (x) { return owns(x, c[0]) }) &&
                              (outputs || []).some(function (y) { return owns(y, c[1]) })
                if (between) disconnect.push(c)
            })
            return { connect: connect, disconnect: disconnect }
        },
        heal: function (pedal, connections) {
            var out = [], have = {}
            connections = connections || []
            connections.forEach(function (c) { have[c[0] + '>' + c[1]] = true })
            TYPES.forEach(function (t) {
                var ins = ports(pedal, t, 'in'), outs = ports(pedal, t, 'out')
                if (!ins.length || !outs.length) return
                outs.forEach(function (o, j) {
                    var i = ins[Math.min(j, ins.length - 1)]
                    var from = connections.filter(function (c) { return c[1] === i && !owns(pedal, c[0]) }).map(function (c) { return c[0] })
                    var to = connections.filter(function (c) { return c[0] === o && !owns(pedal, c[1]) }).map(function (c) { return c[1] })
                    from.forEach(function (a) {
                        to.forEach(function (b) {
                            if (have[a + '>' + b]) return
                            have[a + '>' + b] = true
                            out.push([a, b])
                        })
                    })
                })
            })
            return out
        }
    }
})();
