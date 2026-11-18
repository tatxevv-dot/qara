import json,urllib.request,urllib.parse,concurrent.futures as cf
exec(open('match.py').read().split("byname=")[0])  # norm funcs
P=json.load(open('players.json')); M=json.load(open('map.json'))
F=json.load(open('fm_players.json'))
import collections
# rebuild tmap
byname=collections.defaultdict(list)
for f in F: byname[norm(f['name'])].append(f)
ov=collections.Counter()
for p in P:
    for f in byname.get(norm(p['n']),[]): ov[(p['t'],f['team'])]+=1
tmap={}
for (a,b),c in ov.most_common():
    if a not in tmap and b not in tmap.values(): tmap[a]=b
un=[p for p in P if p['id'] not in M]
def s(p):
    u="https://www.fotmob.com/api/data/search/suggest?lang=en&term="+urllib.parse.quote(p['n'])
    try: d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'}),timeout=20))
    except Exception: return p['id'],None
    sug=[x for g in d for x in g.get('suggestions',[]) if x.get('type')=='player' and not x.get('isCoach')]
    seen={};
    for x in sug: seen[x['id']]=x
    sug=list(seen.values())
    t=tmap.get(p['t'])
    for x in sug:
        if t and x.get('teamId')==t: return p['id'],int(x['id'])
    ex=[x for x in sug if norm(x['name'])==norm(p['n'])]
    if len(ex)==1: return p['id'],int(ex[0]['id'])
    if len(sug)==1 and set(norm(sug[0]['name']).split())&set(norm(p['n']).split()) and norm(sug[0]['name']).split()[-1]==norm(p['n']).split()[-1]: return p['id'],int(sug[0]['id'])
    return p['id'],None
with cf.ThreadPoolExecutor(6) as ex: R=list(ex.map(s,un))
add={k:v for k,v in R if v}; M.update(add); json.dump(M,open('map.json','w'))
print('search added',len(add),'total',len(M),'of',len(P))
print([p['n']+' / '+(p['tn'] or '') for p in P if p['id'] not in M][:30])
