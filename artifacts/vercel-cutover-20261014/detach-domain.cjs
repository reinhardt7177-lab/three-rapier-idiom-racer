// Scoped custom-domain handoff through the installed Wrangler. Authentication
// stays in Wrangler; no credential files, headers, or tokens are exported.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=process.argv[2],configPath=path.resolve(process.argv[3]);
const meta=JSON.parse(fs.readFileSync(path.join(root,'package.json')));
if(meta.name!=='wrangler'||meta.version!=='4.149.0')throw Error('Pinned Wrangler required');
const cli=path.join(root,'wrangler-dist/cli.js'),source=fs.readFileSync(cli,'utf8');
const extension=`
exports.__detachRacing=async function(configPath){
 const config=exports.unstable_readConfig({config:configPath},{hideWarnings:true});
 if(config.name!=='mumu-circuit')throw Error('Scope mismatch');
 init_user2();init_cfetch2();const accountId=await requireAuth(config),base='/accounts/'+accountId;
 const rows=await fetchResult2(config,base+'/workers/domains',{},new URLSearchParams({service:'mumu-circuit'}));
 const own=rows.filter(d=>d.service==='mumu-circuit');
 if(own.length!==1||own[0].hostname!=='racing.mumuworld.com'||own[0].zone_name!=='mumuworld.com')throw Error('Unexpected hostname set: abort');
 const references=await fetchResult2(config,base+'/workers/scripts/mumu-circuit/references');
 const tails=await fetchResult2(config,base+'/workers/tails/by-consumer/mumu-circuit');
 const counts={incomingServices:references.services?.incoming?.length??0,pagesFunction:references.services?.pages_function===true,otherDurableObjects:references.durable_objects?.filter(d=>d.service!=='mumu-circuit').length??0,dispatchOutbounds:references.dispatch_outbounds?.length??0,tailConsumers:tails.length};
 if(counts.incomingServices||counts.pagesFunction||counts.otherDurableObjects||counts.dispatchOutbounds||counts.tailConsumers)throw Error('Dependencies found: abort');
 require('node:fs').writeFileSync('artifacts/vercel-cutover-20261014/domain-before-detach.json',JSON.stringify({domain:own[0],dependencyCounts:counts},null,2));
 await fetchResult2(config,base+'/workers/domains/'+own[0].id,{method:'DELETE'});
 const after=await fetchResult2(config,base+'/workers/domains',{},new URLSearchParams({service:'mumu-circuit'}));
 return {hostname:'racing.mumuworld.com',detached:after.filter(d=>d.service==='mumu-circuit').length===0,dependencyCounts:counts,checkedAt:new Date().toISOString()};
};`;
const sdk=new Module(cli,module);sdk.filename=cli;sdk.paths=Module._nodeModulePaths(root);sdk._compile(source+extension,cli);
sdk.exports.__detachRacing(configPath).then(report=>{fs.writeFileSync('artifacts/vercel-cutover-20261014/domain-detached.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.detached)process.exitCode=1;}).catch(error=>{const report={failed:true,errorName:error.name,code:error.code??null,causeCode:error.cause?.code??null};fs.writeFileSync('artifacts/vercel-cutover-20261014/domain-detach-error.json',JSON.stringify(report,null,2));console.error(JSON.stringify(report));process.exitCode=1;});
