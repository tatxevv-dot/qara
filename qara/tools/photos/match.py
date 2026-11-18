import json,unicodedata,re,collections
P=json.load(open('players.json')); F=json.load(open('fm_players.json'))
def norm(s):
    s=(s or '').replace('ß','ss').replace('ı','i').replace('ø','o').replace('Ø','O').replace('æ','ae').replace('đ','d').replace('ł','l').replace('Ł','L')
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
    s=re.sub(r"[^a-z ]"," ",s.replace("-"," ")); return " ".join(s.split())
def tnorm(s):
    s=norm(s)
    for w in ['fc','cf','afc','ac','as','ss','sc','sv','vfb','vfl','tsg','rc','ogc','losc','club','de','calcio','football','hotspur','united','city','1899','05','1846','04','fk','sk','cp','sl']: s=re.sub(rf'\b{w}\b','',s)
    return " ".join(s.split())
byname=collections.defaultdict(list)
for f in F: byname[norm(f['name'])].append(f)
# team map: our team -> fotmob team by player overlap
ov=collections.Counter()
for p in P:
    for f in byname.get(norm(p['n']),[]): ov[(p['t'],f['team'])]+=1
tmap={}
for (a,b),c in ov.most_common():
    if a not in tmap and b not in tmap.values(): tmap[a]=b
res={}; how=collections.Counter()
used=set()
for p in P:
    c=byname.get(norm(p['n']),[])
    if len(c)==1: res[p['id']]=c[0]['id']; how['exact']+=1; continue
    if len(c)>1:
        c2=[f for f in c if f['team']==tmap.get(p['t'])]
        if c2: res[p['id']]=c2[0]['id']; how['exact_team']+=1; continue
    # within team fuzzy
    tm=tmap.get(p['t']); n=norm(p['n']).split()
    if not tm or not n: how['none']+=1; continue
    pool=[f for f in F if f['team']==tm]
    def score(f):
        m=norm(f['name']).split(); s=0
        if n[-1] in m: s+=2
        if m and m[-1] in n: s+=2
        s+=len(set(n)&set(m))
        if n[0][:1]==(m[0][:1] if m else ''): s+=0.5
        return s
    best=sorted(pool,key=score,reverse=True)[:2]
    if best and score(best[0])>=2.5 and (len(best)<2 or score(best[0])>score(best[1])): res[p['id']]=best[0]['id']; how['fuzzy']+=1
    else: how['none']+=1
print(how, len(res), len(P), 'teams mapped',len(tmap))
json.dump(res,open('map.json','w'))
un=[p for p in P if p['id'] not in res]; print([ (p['n'],p['tn']) for p in un[:40]])
