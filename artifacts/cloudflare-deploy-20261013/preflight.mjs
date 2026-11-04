import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const evidence = 'artifacts/cloudflare-deploy-20261013';
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const inputs = JSON.parse(fs.readFileSync('artifacts/release-repair-20261012/graphics-check-inputs.json'));
const changed = inputs.filter(input => hash(fs.readFileSync(input.path)) !== input.sha256);
assert.equal(changed.length, 0, 'Game inputs must match the prior full 391-test verification');
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
const branch = execFileSync('git', ['branch', '--show-current'], {encoding:'utf8'}).trim();
assert.equal(branch, 'codex/korea-circuits-progression-20261011');
const release = {sourceCommit, graphicsCommit:'d5e0691', builtAt:new Date().toISOString(), host:'racing.mumuworld.com'};
fs.writeFileSync('dist/release.json', JSON.stringify(release, null, 2));
const scan = dir => fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
  const file = path.join(dir, entry.name);
  if (entry.isDirectory()) return scan(file);
  assert.ok(entry.isFile(), 'No symlinks in the deployment');
  const relative = path.relative('dist', file).replaceAll('\\', '/');
  assert.ok(!/(^|\/)(\.|artifacts|node_modules)|\.(key|blend|map)$|\.env/i.test(relative), 'Only public game files may be deployed: '+relative);
  const data = fs.readFileSync(file);
  assert.ok(data.length <= 25 * 1024 * 1024, 'Cloudflare individual asset limit: '+relative);
  return [{path:relative, bytes:data.length, sha256:hash(data)}];
});
const files = scan('dist');
const report = {release, branch, verifiedSourceInputs:inputs.length, changedInputs:changed, files,
  totalBytes:files.reduce((sum, file) => sum + file.bytes, 0), largest:files.reduce((a,b) => a.bytes>b.bytes?a:b),
  validation:'Prior full regression is reused only after exact input hash comparison; this deployment runs a fresh build, dry run, and public URL checks.'};
fs.writeFileSync(`${evidence}/preflight.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({files:files.length,totalBytes:report.totalBytes,largest:report.largest,verifiedSourceInputs:inputs.length,sourceCommit}, null, 2));
