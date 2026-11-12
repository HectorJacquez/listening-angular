#!/usr/bin/env python3
"""Build snapshot.json for the Angular listening demo from the live music server.
Runs on the hub box. Reads Navidrome (read-only, via the hub's docker trick) and the
hub's stats cache. Output is public: titles, artists, albums, play counts and
timestamps only; no paths and no server ids."""
import hashlib, json, subprocess, sys, time, os, re

# This snapshot is public, so some names are left out of it: a list of artists
# and a pattern for explicit titles. Both live in snapshot-filters.json beside
# this script, which is not committed. No file, no snapshot.
FILTERS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshot-filters.json")
if not os.path.exists(FILTERS): sys.exit("missing " + FILTERS)
_f = json.load(open(FILTERS))
EXCLUDE_ARTISTS = {a.lower() for a in _f["exclude_artists"]}
EXPLICIT = re.compile(_f["explicit"], re.I)

def banned(*fields):
    # an excluded artist also goes when they are only a feature in a title
    return any(f and (EXPLICIT.search(f) or any(a in f.lower() for a in EXCLUDE_ARTISTS)) for f in fields)

def banned_artist(name):
    return any(p.strip().lower() in EXCLUDE_ARTISTS for p in name.split(";")) or banned(name)
def public_id(navidrome_id):
    # A stable row key for the page that is not the server's own track id.
    return hashlib.sha256(navidrome_id.encode()).hexdigest()[:12]
HUB = os.path.expanduser("~/Documents/hedgy-hub")

def docker(mount, script):
    out = subprocess.run(["docker","run","--rm","-v",mount,"python:3-alpine","python","-c",script],
                         capture_output=True, text=True, timeout=300)
    if out.returncode: sys.exit(out.stderr[-500:])
    return json.loads(out.stdout)

events = docker("/var/lib/navidrome/plugins/mood-playlists:/kv:ro", r"""
import sqlite3,json
con=sqlite3.connect('file:/kv/kvstore.db?mode=ro&immutable=1',uri=True)
ev=[]
for (v,) in con.execute("select value from kvstore where key like 'plays:wk%' order by key desc limit 6"):
    ev+=json.loads(v.decode() if isinstance(v,bytes) else v)
ev.sort(key=lambda e:-e.get('t',0)); print(json.dumps(ev[:400]))""")
ids = sorted({e["i"] for e in events})
lib = docker("/var/lib/navidrome:/nd:ro", r"""
import sqlite3,json
con=sqlite3.connect('file:/nd/navidrome.db?mode=ro&immutable=1',uri=True)
ids=json.loads(%r)
q=",".join("?"*len(ids))
tracks={r[0]:dict(title=r[1],artist=r[2],album=r[3],duration=r[4],year=r[5],genre=r[6]) for r in
  con.execute(f"select id,title,artist,album,duration,year,genre from media_file where id in ({q})",ids)}
# Per-artist totals from Navidrome play counts (already merges imported history).
# One track can credit several artists, and the tags spell that four ways:
#   "Battles; Tune-Yards"            Navidrome's own feature list: credit the first only
#   "Big Sean • Jay-Z • Kanye West"  a joint credit: every name gets the play
#   "ZelooperZ feat. Danny Brown"    same
#   "The Seatbelts/Yoko Kanno"       ambiguous ("AC/DC", "DOMi & JD BECK" are one act),
#                                    so split only when a part is an artist in its own right
# Rows are then merged on a loose key, so "Beatles" and "The Beatles" are one artist,
# shown under whichever spelling has more plays.
import re
def primary(t): return (t or '').split(';')[0].strip()
def nm(s): return re.sub(r'[^a-z0-9]+',' ',s.lower().replace('&',' and ')).strip()
def key(s): return re.sub(r'^the ','',nm(s)) or s.strip().lower()
JOINT=re.compile(r'\s+•\s+|\s+(?:feat\.?|ft\.?|featuring)\s+', re.I)
MAYBE=re.compile(r'\s*/\s*|\s+&\s+|,\s+')
rows=con.execute('''select m.artist, m.album, a.play_count from media_file m
  join annotation a on a.item_id=m.id and a.item_type='media_file' where m.missing=0''').fetchall()
alltags={primary(r[0]) for r in rows}|{primary(t['artist']) for t in tracks.values()}
solo={key(p) for tag in alltags for p in JOINT.split(tag) if p.strip() and not MAYBE.search(p)}
def credits(tag):
    out=[]
    for part in JOINT.split(primary(tag)):
        bits=[b.strip() for b in MAYBE.split(part) if b.strip()] if '(' not in part else []
        out+=bits if len(bits)>1 and any(key(b) in solo for b in bits) else [part.strip()]
    seen=set()
    return [n for n in out if n and not (key(n) in seen or seen.add(key(n)))]
agg={}; spell={}
for art, album, plays in rows:
    for n in credits(art):
        e=agg.setdefault(key(n), [0,0,set()])
        e[0]+=plays or 0; e[1]+=1; e[2].add(album)
        s=spell.setdefault(key(n), {}); s[n]=s.get(n,0)+(plays or 0)
def shown(n):
    s=spell.get(key(n))
    return max(s, key=lambda v:(s[v], v)) if s else n
split={t: [shown(n) for n in credits(t)] for t in alltags if credits(t)!=[t]}
ranked=sorted(agg, key=lambda k:-agg[k][0])
keep=set(ranked[:60])|{key(n) for t in tracks.values() for n in credits(t['artist'])}
arts=[(max(spell[k], key=lambda v:(spell[k][v], v)),
       agg[k][0],agg[k][1],len(agg[k][2])) for k in ranked if k in keep]
tops=[]
for r in con.execute('''select m.artist,m.title,m.album,a.play_count,m.duration,m.year,m.genre from media_file m
  join annotation a on a.item_id=m.id and a.item_type='media_file' where a.play_count>0 and m.missing=0
  order by a.play_count desc'''):
    for n in credits(r[0]):
        if key(n) in keep: tops.append((shown(n),)+tuple(r[1:]))
# The play log keeps each credited name, under the same spelling as the artist list.
for t in tracks.values():
    names=credits(t['artist'])+[p.strip() for p in (t['artist'] or '').split(';')[1:] if p.strip()]
    seen=set()
    t['artist']='; '.join(shown(n) for n in names if not (key(n) in seen or seen.add(key(n))))
tot=con.execute("select count(*),count(distinct artist),count(distinct album),sum(duration) from media_file where missing=0").fetchone()
print(json.dumps(dict(tracks=tracks,artists=arts,tops=tops,totals=tot,split=split)))""" % json.dumps(ids))

cache = json.load(open(f"{HUB}/state/stats-cache.json"))
uni = cache.get("unified", {})
recent = []
dropped = []
for e in events:
    t = lib["tracks"].get(e["i"])
    if not t: continue
    if banned_artist(t["artist"]) or banned(t["title"], t["album"]):
        dropped.append(f'{t["artist"]} / {t["album"]} / {t["title"]}'); continue
    recent.append(dict(id=public_id(e["i"]), playedAt=e["t"], **t))
by_art = {}
for a, title, album, plays, dur, year, genre in lib["tops"]:
    if banned(title, album):
        dropped.append(f'{a} / {album} / {title}'); continue
    by_art.setdefault(a, []).append(dict(title=title, album=album, plays=plays, duration=dur, year=year, genre=genre))
artists = []
for name, plays, tracks, albums in lib["artists"]:
    if banned_artist(name):
        dropped.append(f'{name} (artist)'); continue
    tt = by_art.get(name, [])[:12]
    genres = [g for g in (x["genre"] for x in by_art.get(name, [])) if g]
    top_genre = max(set(genres), key=genres.count) if genres else None
    artists.append(dict(name=name, plays=plays, tracks=tracks, albums=albums, genre=top_genre, topTracks=tt))
# Artist pictures from Deezer's public search (no key). Looked up once here so the
# page never spends a request per card; Deezer's CDN URLs are stable for months.
import urllib.request, urllib.parse
def deezer_picture(name):
    try:
        u = "https://api.deezer.com/search/artist?limit=5&q=" + urllib.parse.quote(name)
        with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "listening-angular snapshot"}), timeout=10) as r:
            data = json.load(r).get("data", [])
    except Exception:
        return None
    def nm(x): return re.sub(r"[^a-z0-9]+", " ", x.lower().replace("&", "and")).strip()
    def loose(x): return re.sub(r"^the ", "", nm(x))
    want = nm(name)
    hit = (next((a for a in data if nm(a.get("name", "")) == want), None)
           or next((a for a in data if loose(a.get("name", "")) == loose(name)), None))
    return (hit or {}).get("picture_medium") or None
for a in artists:
    a["image"] = deezer_picture(a["name"]); time.sleep(0.12)
print("pictures", sum(1 for a in artists if a["image"]), "of", len(artists))
n, na, nal, secs = lib["totals"]
snap = dict(
    generatedAt=int(time.time()),
    totals=dict(plays=uni.get("total_plays"), hours=(uni.get("time") or {}).get("total_hours"),
                tracks=n, artists=na, albums=nal, libraryHours=round((secs or 0)/3600)),
    recent=recent[:300], artists=artists)
json.dump(snap, open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/snapshot.json", "w"), ensure_ascii=False)
print("joint credits split:"); [print("  ", k, "->", v) for k, v in sorted(lib["split"].items())]
print("dropped", len(dropped)); [print("  -", d) for d in sorted(set(dropped))]
print("recent", len(recent), "artists", len(artists), "totals", snap["totals"])
print("sample recent:", recent[:2]); print("sample artist:", {k:v for k,v in artists[0].items() if k!="topTracks"}, artists[0]["topTracks"][:2])
