// Reset only the owned racing hostname using Wrangler's authenticated API and
// its own custom-domain publisher. Do not expose or access credential material.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const root=process.argv[2],configPath=path.resolve(process.argv[3]),dir='artifacts/domain-repair-20261014';
if(JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version!=='4.149.0')throw Error('Pinned Wrangler required');
const cli=path.join(root,'wrangler-dist/cli.js'),source=fs.readFileSync(cli,'utf8');
for(const name of ['init_user2','init_cfetch2','init_context','init_publish_routes','publishCustomDomains','initDeployHelpersContext'])if(!source.includes(name))throw Error('Wrangler interface changed');
const extension=`
exports.__resetRacingDomain=async function(configPath,probe){
 const config=exports.unstable_readConfig({config:configPath},{hideWarnings:true}),hostname='racing.mumuworld.com';
 if(config.name!=='mumu-circuit'||config.routes.length!==1||config.routes[0].pattern!==hostname)throw Error('Scope mismatch');
 init_user2();init_cfetch2();init_context();init_publish_routes();
 initDeployHelpersContext({logger:logger2,fetchResult:fetchResult2});
 const accountId=await requireAuth(config);
 const rows=await fetchResult2(config,'/accounts/'+accountId+'/workers/domains',{},new URLSearchParams({service:'mumu-circuit'}));
 const own=rows.filter(d=>d.service==='mumu-circuit');
 if(probe)return {readOnly:true,domains:own};
 if(own.length!==1||own[0].hostname!==hostname||own[0].zone_name!=='mumuworld.com')throw Error('Unexpected domain ownership/set: abort before mutation');
 const before=own[0],fs=require('node:fs');
 fs.writeFileSync('${dir}/binding-before-reset.json',JSON.stringify({time:new Date().toISOString(),domain:before},null,2));
 await fetchResult2(config,'/accounts/'+accountId+'/workers/domains/'+before.id,{method:'DELETE'});
 fs.writeFileSync('${dir}/detached.json',JSON.stringify({time:new Date().toISOString(),hostname,domainId:before.id},null,2));
 try{
  const result=await publishCustomDomains(config,'/accounts/'+accountId+'/workers/scripts/mumu-circuit',accountId,'mumu-circuit',[{pattern:hostname,custom_domain:true,zone_id:before.zone_id,enabled:true,previews_enabled:false}]);
  if(result.error)throw result.error;
  const afterRows=await fetchResult2(config,'/accounts/'+accountId+'/workers/domains',{},new URLSearchParams({hostname,service:'mumu-circuit'}));
  const after=afterRows.find(d=>d.hostname===hostname);
  if(!after||after.service!=='mumu-circuit'||after.enabled!==true||after.zone_id!==before.zone_id)throw Error('Domain restoration mismatch');
  return {before,after,targets:result.targets,changed:result.changed};
 }catch(error){
  // Restore the same hostname/service if the custom-domain publisher fails.
  let restored=false;try{await fetchResult2(config,'/accounts/'+accountId+'/workers/domains',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({hostname,service:'mumu-circuit',environment:'production',zone_id:before.zone_id,enabled:true,previews_enabled:false})});restored=true;}catch{}
  fs.writeFileSync('${dir}/reset-rollback.json',JSON.stringify({time:new Date().toISOString(),restored,errorName:error.name,code:error.code??null},null,2));throw error;
 }
};`;
const sdk=new Module(cli,module);sdk.filename=cli;sdk.paths=Module._nodeModulePaths(root);sdk._compile(source+extension,cli);
sdk.exports.__resetRacingDomain(configPath,process.argv[4]==='probe').then(report=>{report.time=new Date().toISOString();fs.writeFileSync(`${dir}/${process.argv[4]==='probe'?'api-probe':'reset-result'}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}).catch(error=>{const safe=s=>typeof s==='string'&&!/token|password|secret|bearer|authorization/i.test(s)?s:undefined;const result={errorName:error.name,code:error.code??null,message:safe(error.message),notes:error.notes?.map(n=>safe(n.text)).filter(Boolean),failed:true};fs.writeFileSync(`${dir}/api-probe-error.json`,JSON.stringify(result,null,2));console.error(JSON.stringify(result));process.exitCode=1;});
