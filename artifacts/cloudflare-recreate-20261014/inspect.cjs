// Read-only Worker dependencies and domain ownership via the installed Wrangler.
// Authentication stays inside Wrangler; no token/header/auth file is accessed.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=process.argv[2],configPath=path.resolve(process.argv[3]),phase=process.argv[4]||'before';
if(!['before','deleted','after'].includes(phase))throw Error('Unknown phase');
const meta=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
if(meta.name!=='wrangler'||meta.version!=='4.149.0')throw Error('Pinned Wrangler required');
const cli=path.join(root,'wrangler-dist/cli.js'),source=fs.readFileSync(cli,'utf8');
const extension=`
exports.__inspectRecreate=async function(configPath,phase){
 const config=exports.unstable_readConfig({config:configPath},{hideWarnings:true});
 if(config.name!=='mumu-circuit'||config.routes.length!==1||config.routes[0].pattern!=='racing.mumuworld.com')throw Error('Scope mismatch');
 init_user2();init_cfetch2();const accountId=await requireAuth(config),base='/accounts/'+accountId;
 const domains=await fetchResult2(config,base+'/workers/domains',{},new URLSearchParams({service:'mumu-circuit'}));
 const owned=domains.filter(d=>d.service==='mumu-circuit').map(d=>({id:d.id,hostname:d.hostname,service:d.service,enabled:d.enabled,zone_name:d.zone_name,cert_id:d.cert_id}));
 if(owned.some(d=>d.hostname!=='racing.mumuworld.com'||d.zone_name!=='mumuworld.com'))throw Error('Unexpected additional hostname: stop');
 if(phase==='deleted')return {worker:'mumu-circuit',domains:owned};
 const references=await fetchResult2(config,base+'/workers/scripts/mumu-circuit/references');
 const tails=await fetchResult2(config,base+'/workers/tails/by-consumer/mumu-circuit');
 const counts={incomingServices:references.services?.incoming?.length??0,pagesFunction:references.services?.pages_function===true,otherDurableObjects:references.durable_objects?.filter(d=>d.service!=='mumu-circuit').length??0,dispatchOutbounds:references.dispatch_outbounds?.length??0,tailConsumers:tails.length};
 const clear=counts.incomingServices===0&&!counts.pagesFunction&&counts.otherDurableObjects===0&&counts.dispatchOutbounds===0&&counts.tailConsumers===0;
 if(!clear)throw Error('Worker dependencies found: do not delete');
 return {worker:'mumu-circuit',domains:owned,dependencyCounts:counts,dependenciesClear:clear};
};`;
const sdk=new Module(cli,module);sdk.filename=cli;sdk.paths=Module._nodeModulePaths(root);sdk._compile(source+extension,cli);
sdk.exports.__inspectRecreate(configPath,phase).then(report=>{report.checkedAt=new Date().toISOString();fs.writeFileSync('artifacts/cloudflare-recreate-20261014/inspect-'+phase+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}).catch(error=>{const report={failed:true,errorName:error.name,code:error.code??null};fs.writeFileSync('artifacts/cloudflare-recreate-20261014/inspect-'+phase+'-error.json',JSON.stringify(report,null,2));console.error(JSON.stringify(report));process.exitCode=1;});
