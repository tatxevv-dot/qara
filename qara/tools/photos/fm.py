import json,urllib.request,concurrent.futures as cf,unicodedata,re
H={'User-Agent':'Mozilla/5.0'}
teams={}
for l in [47,87,55,54,53,42]:
    d=json.load(open(f'lg_{l}.json'))
    def walk(x):
        if isinstance(x,dict):
            if 'all' in x and isinstance(x['all'],list):
                for r in x['all']: teams[r['id']]=r['name']
            for v in x.values(): walk(v)
        elif isinstance(x,list):
            for v in x: walk(v)
    walk(d.get('table',[]))
print(len(teams))
def get(t):
    for i in range(3):
        try:
            d=json.load(urllib.request.urlopen(urllib.request.Request(f'https://www.fotmob.com/api/data/teams?id={t}',headers=H),timeout=30))
            out=[]
            for g in d['squad']['squad']:
                if g['title']=='coach': continue
                for m in (g.get('members') or []): out.append({'id':m['id'],'name':m['name'],'dob':m.get('dateOfBirth'),'no':m.get('shirtNumber'),'team':t,'tname':teams[t]})
            return out
        except Exception as e: err=e
    print('fail',t,err); return []
with cf.ThreadPoolExecutor(8) as ex: allp=[p for r in ex.map(get,teams) for p in r]
json.dump(allp,open('fm_players.json','w')); print(len(allp))
