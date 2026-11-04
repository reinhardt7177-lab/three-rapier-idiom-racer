import hashlib, json, pathlib, re, sys
sys.stdout.reconfigure(encoding='utf-8')

base=pathlib.Path(__file__).resolve().parent
root=base.parents[1]
def read(path):
    data=path.read_bytes()
    return data.decode('utf-16' if data.startswith((b'\xff\xfe',b'\xfe\xff')) else 'utf-8-sig',errors='replace')
def exit_code(name):
    p=base/name
    return read(p).strip() if p.exists() else 'running'
def rows(name):
    p=base/name
    if not p.exists(): return []
    try: return json.loads(read(p)).get('results',[])
    except (ValueError,AttributeError): return []
audit=[]
for row in rows('final-current.json'):
    audit.append(dict(track=row['track'],difficulty=row['difficulty'],laps=row.get('laps',1),weather=row['weather'],cars=sum(c['finish'] is not None for c in row['cars']),seconds=row['seconds'],offroad=sum(c['offroadSeconds'] for c in row['cars']),stall=row['maxStall']))
log=read(base/'check-final.log') if (base/'check-final.log').exists() else ''
print(json.dumps(dict(full=exit_code('check-final-exit.txt'),build=exit_code('build-final-exit.txt'),auditExit=exit_code('final-current-exit.txt'),control=exit_code('matched-control-exit.txt'),testsPassedSoFar=len(re.findall(r'^✔',log,re.M)),failures=[line for line in log.splitlines() if line.startswith('✖')],audit=audit),ensure_ascii=False,indent=2))
paths=['src/rebuild/course.js','src/rebuild/rivalPlanner.js','src/rebuild/rivalRacecraft.js','src/rebuild/rivalPersonalities.js','src/rebuild/raceDifficulty.js','src/rebuild/runtime.js','scripts/race-sim.mjs','scripts/rival-racecraft.test.mjs','scripts/ai-race-audit.mjs','src/driving/physics.js','src/driving/steering.js']
hashes={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
p=base/'actual-final-inputs.json'
if not p.exists(): p.write_text(json.dumps(hashes,indent=2),encoding='utf-8')
else:
    previous=json.loads(p.read_text(encoding='utf-8'))
    print('changed validation inputs:',[p for p,h in hashes.items() if h!=previous.get(p)])
control=rows('matched-baseline6.json')
current=rows('final-current.json')
if control and len(current)==7:
    keys=['id','finish','lowest','metres','scrapeSeconds','offroadSeconds']
    identical=all(all(a[k]==b[k] for k in keys) for a,b in zip(control[0]['cars'],current[-1]['cars']))
    comparison={'sameSharedPhysics':True,'identicalEasyThreeLapResults':identical,'legacyFinishTimes':[c['finish'] for c in control[0]['cars']],'currentFinishTimes':[c['finish'] for c in current[-1]['cars']]}
    (base/'matched-control-comparison.json').write_text(json.dumps(comparison,indent=2),encoding='utf-8')
    print('matched control:',json.dumps(comparison))
