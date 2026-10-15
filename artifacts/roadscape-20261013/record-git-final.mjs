import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const git=args=>execFileSync('git',args).toString().trim();
const branch='codex/korea-circuits-progression-20261011',source='71e8cd188e17c2737c9d3efd54e330235388baea';
const remote=git(['ls-remote','origin',`refs/heads/${branch}`]).split(/\s+/)[0];
if(remote!==source||git(['rev-parse','HEAD'])!==source)throw Error('source push did not match');
const main=git(['rev-parse','main']);if(main!=='bc012ae836e5b536d80bc35463295ee2d1b690c4')throw Error('main changed');
fs.writeFileSync('artifacts/roadscape-20261013/git-final.json',JSON.stringify({time:new Date().toISOString(),branch,gameSourceCommit:source,verifiedSourceAtFirstPush:remote,main,productionDeploy:false,pullRequestCreated:false,concurrentNamakTrackedChangesPreserved:['artifacts/namak-20261010/stationary-grid-rivals.json','docs/NEXT_STEPS.md','package.json','src/rebuild/assets.js','src/rebuild/namakVisuals.js'],note:'A following documentation-only commit records this audit. Game code and models stay at the verified source commit.'},null,2));
console.log('Verified pushed game source, unchanged main, and scoped handoff.');
