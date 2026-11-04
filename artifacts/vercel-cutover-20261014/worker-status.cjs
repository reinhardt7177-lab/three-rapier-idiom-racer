// Read-only: existing Wrangler performs authentication; no credential is exported.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=process.argv[2],configPath=path.resolve(process.argv[3]);
const metadata=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
if(metadata.name!=='wrangler'||metadata.version!=='4.149.0')throw Error('Pinned Wrangler required');
const cli=path.join(root,'wrangler-dist/cli.js'),source=fs.readFileSync(cli,'utf8');
const extension=`
exports.__cutoverWorkerStatus=async function(configPath){
 const config=exports.unstable_readConfig({config:configPath},{hideWarnings:true});
 if(config.name!=='mumu-circuit')throw Error('Scope mismatch');
 init_user2();init_cfetch2();const accountId=await requireAuth(config);
 const subdomain=await fetchResult2(config,'/accounts/'+accountId+'/workers/scripts/mumu-circuit/subdomain');
 const rows=await fetchResult2(config,'/accounts/'+accountId+'/workers/domains',{},new URLSearchParams({service:'mumu-circuit'}));
 return {worker:config.name,defaultEnabled:subdomain.enabled,previewsEnabled:subdomain.previews_enabled,domains:rows.filter(d=>d.service==='mumu-circuit').map(d=>({hostname:d.hostname,enabled:d.enabled,zone_name:d.zone_name}))};
};`;
const sdk=new Module(cli,module);sdk.filename=cli;sdk.paths=Module._nodeModulePaths(root);sdk._compile(source+extension,cli);
sdk.exports.__cutoverWorkerStatus(configPath).then(async report=>{
 report.checkedAt=new Date().toISOString();try{const r=await fetch('https://mumu-circuit.reinhardt7177.workers.dev/',{signal:AbortSignal.timeout(10000)});report.defaultHttpStatus=r.status;}catch(error){report.defaultHttpError=error.cause?.code??String(error);}
 fs.writeFileSync('artifacts/vercel-cutover-20261014/worker-default-disabled.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.defaultEnabled!==false)process.exitCode=1;
}).catch(error=>{console.error(JSON.stringify({failed:true,errorName:error.name,code:error.code??null}));process.exitCode=1;});
