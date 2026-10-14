import json, urllib.request, urllib.parse
B='http://localhost:8888'
def get(p): return json.load(urllib.request.urlopen(B+p))
chain=[('comp','http://guitarix.sourceforge.net/plugins/gx_compressor#_compressor'),
       ('phaser','http://guitarix.sourceforge.net/plugins/gx_phaser#_phaser'),
       ('echo','http://guitarix.sourceforge.net/plugins/gx_digital_delay_#_digital_delay_'),
       ('trem','http://guitarix.sourceforge.net/plugins/gx_tremolo#_tremolo'),
       ('verb','http://guitarix.sourceforge.net/plugins/gx_zita_rev1_stereo#_zita_rev1_stereo'),
       ('eq','http://guitarix.sourceforge.net/plugins/gx_graphiceq_#_graphiceq_')]
get('/reset')
prev=['/graph/capture_1']
# add in a scrambled x order so signal order != x order
xs=[900,100,500,1300,300,1700]
for (inst,uri),x in zip(chain,xs):
    r=get('/effect/add/graph/%s?x=%d&y=200&uri=%s'%(inst,x,urllib.parse.quote(uri)))
    info=get('/effect/get?uri='+urllib.parse.quote(uri))
    ins=[p['symbol'] for p in info['ports']['audio']['input']]
    outs=[p['symbol'] for p in info['ports']['audio']['output']]
    print(inst, 'ins',ins,'outs',outs, 'controls', len(info['ports']['control']['input']))
    for i,src in enumerate(prev):
        if i < len(ins): get('/effect/connect/%s,/graph/%s/%s'%(src,inst,ins[i]))
    prev=['/graph/%s/%s'%(inst,o) for o in outs]
for i,src in enumerate(prev[:2]):
    get('/effect/connect/%s,/graph/playback_%d'%(src,i+1))
print(urllib.request.urlopen(urllib.request.Request(B+'/pedalboard/save', data=urllib.parse.urlencode({'title':'Perf Test','asNew':'1'}).encode())).read()[:300])
