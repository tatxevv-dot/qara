import json,urllib.request,concurrent.futures as cf,hashlib
M=json.load(open('map.json'))
def chk(kv):
    k,v=kv
    try:
        b=urllib.request.urlopen(urllib.request.Request(f"https://images.fotmob.com/image_resources/playerimages/{v}.png",headers={'User-Agent':'Mozilla/5.0'}),timeout=20).read()
        return k,len(b),hashlib.md5(b).hexdigest()
    except Exception as e: return k,0,str(getattr(e,'code',e))
with cf.ThreadPoolExecutor(24) as ex: R=list(ex.map(chk,M.items()))
import collections
hc=collections.Counter(h for _,n,h in R if n); print('top hashes',hc.most_common(3))
json.dump(R,open('img.json','w')); print('ok',sum(1 for _,n,_ in R if n),'fail',sum(1 for _,n,_ in R if not n))
