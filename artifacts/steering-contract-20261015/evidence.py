from pathlib import Path
import hashlib
import json
import shutil
import re
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')
root = Path(__file__).resolve().parents[2]
out = Path(__file__).resolve().parent
outputs = [
    'artifacts/championship-20261011/physical-series.json',
    'artifacts/race-duel-20261012/duel-races.json',
    'artifacts/engine-feel-20261010/physical-fleet.json',
    'artifacts/namak-20261010/physical-laps.json',
    'artifacts/namak-20261010/stationary-grid-rivals.json',
    'artifacts/race-duel-20261012/online-headless.json',
    'artifacts/content-resume-20261011/progression-race.json',
    'artifacts/content-resume-20261011/rain-races.json',
    'artifacts/content-resume-20261011/rival-personality-races.json',
    'artifacts/rival-ai-20261010/full-course.json',
    'artifacts/steering-turn-20261010/namak-player-lap.json',
    'artifacts/release-repair-20261012/traffic-races.json',
    'artifacts/wall-recovery-20261011/namak-lap.json',
]

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def inputs():
    files = []
    for directory in ['src', 'public', 'assets-sources/vehicles-v6', 'scripts/fixtures']:
        files += [p for p in (root / directory).rglob('*') if p.is_file()]
    files += [root / name for name in ['package.json', 'package-lock.json', 'index.html', 'vite.config.js'] if (root / name).is_file()]
    return {p.relative_to(root).as_posix(): sha(p) for p in sorted(files)}

def read_log(name):
    data = (out / name).read_bytes()
    return data.decode('utf-16' if data.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')

def test_summary(name):
    values = dict(re.findall(r'^[ℹ#]\s+(tests|pass|fail|cancelled|skipped|todo|duration_ms)\s+([\d.]+)', read_log(name), re.M))
    result = {key: float(value) if '.' in value else int(value) for key, value in values.items()}
    assert result['tests'] > 0 and result['pass'] == result['tests'], result
    assert all(result[key] == 0 for key in ['fail', 'cancelled', 'skipped', 'todo']), result
    return result

mode = sys.argv[1]
if mode == 'before':
    target = out / 'inputs-before.json'
    if target.exists():
        raise SystemExit('Before snapshot already exists; refusing to replace it')
    before = inputs()
    target.write_text(json.dumps(before, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    preserved = {}
    for name in outputs:
        path = root / name
        if path.is_file():
            dest = out / 'preserved-outputs' / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, dest)
            preserved[name] = sha(path)
    (out / 'preserved-outputs.json').write_text(json.dumps(preserved, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'inputFiles': len(before), 'preservedOutputs': len(preserved), 'utc': datetime.now(timezone.utc).isoformat()}))
elif mode == 'status':
    log = read_log('full.log')
    started = json.loads((out / 'full-manifest.json').read_text(encoding='utf-8-sig'))['startedUtc']
    print(json.dumps({
        'elapsedSeconds': round((datetime.now(timezone.utc) - datetime.fromisoformat(started.replace('Z', '+00:00'))).total_seconds(), 1),
        'reportedPasses': len(re.findall(r'^✔ ', log, re.M)),
        'reportedFailures': len(re.findall(r'^✖ ', log, re.M)),
        'exit': (out / 'full-exit.txt').read_text().strip() if (out / 'full-exit.txt').is_file() else None,
    }))
elif mode == 'compare':
    before = json.loads((out / 'inputs-before.json').read_text(encoding='utf-8'))
    after = inputs()
    changed = {p: {'before': before.get(p), 'after': after.get(p)} for p in before.keys() | after.keys() if before.get(p) != after.get(p)}
    (out / 'inputs-after.json').write_text(json.dumps(after, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (out / 'input-comparison.json').write_text(json.dumps({'files': len(before), 'changed': changed}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({'files': len(before), 'changed': changed}, ensure_ascii=False))
    if changed:
        raise SystemExit(1)
elif mode == 'finish':
    assert not (out / 'completion.json').exists(), 'Already finalized; preserve the original archive'
    for name in ['focused', 'full', 'build']:
        assert (out / f'{name}-exit.txt').read_text().strip() == '0', name
    before = json.loads((out / 'inputs-before.json').read_text(encoding='utf-8'))
    assert before == inputs(), 'Product inputs changed during verification'
    manifest = json.loads((out / 'full-manifest.json').read_text(encoding='utf-8-sig'))
    package = json.loads((root / 'package.json').read_text(encoding='utf-8'))
    registered = re.findall(r'scripts/[^ ]+\.test\.mjs', package['scripts']['check:rebuild'])
    assert manifest['files'] == registered and len(set(registered)) == len(registered)
    focused, full = test_summary('focused.log'), test_summary('full.log')
    preserved = json.loads((out / 'preserved-outputs.json').read_text())
    generated = {}
    for name, original_sha in preserved.items():
        original = out / 'preserved-outputs' / name
        assert sha(original) == original_sha, name
        path = root / name
        dest = out / 'regression-results' / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
        generated[name] = sha(dest)
    for name in preserved:
        assert sha(root / name) == generated[name], f'Output changed during archiving: {name}'
        shutil.copy2(out / 'preserved-outputs' / name, root / name)
        assert sha(root / name) == preserved[name], name
    build_files = {p.relative_to(root / 'dist').as_posix(): sha(p) for p in sorted((root / 'dist').rglob('*')) if p.is_file()}
    (out / 'build-files.json').write_text(json.dumps(build_files, indent=2) + '\n', encoding='utf-8')
    (out / 'generated-output-hashes.json').write_text(json.dumps(generated, indent=2) + '\n', encoding='utf-8')
    summary = {
        'execution': 'Local Windows CPU / Rapier WASM',
        'registeredFiles': len(registered),
        'focused': focused,
        'full': full,
        'productInputFiles': len(before),
        'productInputsChanged': 0,
        'buildExit': 0,
        'buildFiles': len(build_files),
        'existingGeneratedOutputsPreservedAndRestored': len(preserved),
        'freshOutputs': 'regression-results/',
        'legacyOutputDeviceLabels': 'Two existing test writers retain historical Colab labels. This invocation ran locally as recorded in full-manifest.json.',
        'utc': datetime.now(timezone.utc).isoformat(),
    }
    (out / 'completion.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(summary))
