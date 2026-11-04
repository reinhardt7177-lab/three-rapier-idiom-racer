// Read only: delegate authentication and requests to the installed Wrangler.
// No credential file/header/token is accessed or exported by this helper.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const packageRoot=process.argv[2],configPath=path.resolve(process.argv[3]);
if(!packageRoot||!configPath)throw Error('Wrangler package path and scoped config required');
const metadata=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json')));
if(metadata.name!=='wrangler'||metadata.version!=='4.149.0')throw Error('Pinned installed Wrangler required');
const cli=path.join(packageRoot,'wrangler-dist/cli.js'),source=fs.readFileSync(cli,'utf8');
for(const name of ['init_user2','init_cfetch2','fetchResult2','requireAuth'])if(!source.includes(name))throw Error('Wrangler interface changed');
const extension=`
exports.__inspectRacingDomain=async function(configPath){
 const config=exports.unstable_readConfig({config:configPath},{hideWarnings:true});
 if(config.name!=='mumu-circuit'||config.routes.length!==1||config.routes[0].pattern!=='racing.mumuworld.com')throw Error('Scope mismatch');
 init_user2();init_cfetch2();
 const accountId=await requireAuth(config),target='racing.mumuworld.com';
 const domains=await fetchResult2(config,'/accounts/'+accountId+'/workers/domains',{},new URLSearchParams({hostname:target,service:'mumu-circuit'}));
 const own=domains.filter(d=>d.hostname===target);
 const zones=await fetchResult2(config,'/zones',{},new URLSearchParams({name:'mumuworld.com',account_id:accountId}));
 const zone=zones.find(z=>z.name==='mumuworld.com');
 if(!zone)throw Error('Owned parent zone not found');
 const records=[];
 for(const type of (process.argv[4]==='binding-only'?[]:['A','AAAA','CNAME'])){try{
  const rows=await fetchResult2(config,'/zones/'+zone.id+'/dns_records',{},new URLSearchParams({name:target,type}));
  records.push(...rows.filter(d=>d.name===target&&d.type===type).map(d=>({id:d.id,name:d.name,type:d.type,content:d.content,proxied:d.proxied,proxiable:d.proxiable,ttl:d.ttl,created_on:d.created_on,modified_on:d.modified_on,managedByWorkers:d.meta?.managed_by_workers??null})));
 }catch(error){records.push({type,readable:false,errorName:error.name,code:error.code??null});}}
 return {wranglerVersion:'4.149.0',domain:own.map(d=>({id:d.id,hostname:d.hostname,service:d.service,enabled:d.enabled,previews_enabled:d.previews_enabled,zone_id:d.zone_id,zone_name:d.zone_name,cert_id:d.cert_id})),zone:{id:zone.id,name:zone.name,status:zone.status,name_servers:zone.name_servers},records};
};`;
// Keep the installed vendor file unchanged; initialize the same bundled SDK.
const sdk=new Module(cli,module);sdk.filename=cli;sdk.paths=Module._nodeModulePaths(packageRoot);sdk._compile(source+extension,cli);
sdk.exports.__inspectRacingDomain(configPath).then(report=>{
 report.time=new Date().toISOString();const output=path.resolve('artifacts/domain-repair-20261014/'+(process.argv[4]==='binding-only'?'current-domain-binding.json':'cloudflare-domain-state.json'));fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}).catch(error=>{const report={time:new Date().toISOString(),errorName:error.name,code:error.code??null,failed:true};fs.writeFileSync('artifacts/domain-repair-20261014/cloudflare-inspect-error.json',JSON.stringify(report,null,2));console.error(JSON.stringify(report));process.exitCode=1;});
