import fs from 'node:fs';
const src='src/rebuild/',out='artifacts/content-resume-20261011/candidates/';
function edit(file,replacements){let s=fs.readFileSync(file,'utf8');for(const [a,b] of replacements){if(!s.includes(a))throw Error(`missing ${file}: ${a}`);s=s.replace(a,b);}fs.writeFileSync(out+file.split('/').at(-1),s);}
edit(src+'runtime.js',[
 ["import {progressFromRecords", "import {loadWeather,saveWeather,weatherById,weatherSpeedProfile,weatherLighting,createWeatherSurfaceQuery} from './weather.js';\nimport {createRainVfx} from './rainVfx.js';\nimport {progressFromRecords"],
 ["let quality=qualityById(loadQuality(storage())),progression", "let weather=loadWeather(storage()),raceWeather=weather,raceProfile=null,qaSpeed=null;\n  const rain=createRainVfx();scene.add(rain.root);\n  let quality=qualityById(loadQuality(storage())),progression"],
 ["const decorationQuality=createDecorationQuality(assets.world);", "const decorationQuality=createDecorationQuality(assets.world);\n  let currentWeatherLighting={lighting,atmosphere};\n  const dryRoadRoughness=new Map();for(const road of roads)for(const m of Array.isArray(road.material)?road.material:[road.material])if('roughness' in m)dryRoadRoughness.set(m,m.roughness);"],
 ["resize();\n  }\n  let difficulty", "rain.setBudget(quality.rainParticles);resize();\n  }\n  let difficulty"],
 ["speedProfile:difficulty.profile,nitro:difficulty.nitro,personalities:true", "speedProfile:raceProfile??difficulty.profile,nitro:difficulty.nitro,personalities:true"],
 ["state.quality=quality.id;state.progression=progression;", "state.quality=quality.id;state.progression=progression;state.weather=mode==='race'?raceWeather:weather;"],
 ["lighting,atmosphere,colors,decoration:", "lighting:currentWeatherLighting.lighting,atmosphere:currentWeatherLighting.atmosphere,colors,decoration:"],
 ["state.vfx={tireSmoke:", "state.vfx={rain:rain.stats(),tireSmoke:"],
 ["selected=id;mode='garage'", "rain.clear();selected=id;mode='garage'"],
 ["rain.clear();selected=id;", "rain.clear();currentWeatherLighting={lighting,atmosphere};selected=id;"],
 ["rivalPlanner=planRivals();overtakes.reset();", "raceWeather=weather;raceProfile=weatherSpeedProfile(difficulty.profile,raceWeather);qaSpeed=weatherSpeedProfile(difficultyById('hard').profile,raceWeather);\n    const raceSurface=createWeatherSurfaceQuery(surfaceMap,raceWeather);\n    const wet=weatherLighting(lighting,atmosphere,raceWeather,track.night),raceLighting=wet.lighting,raceAtmosphere=wet.atmosphere;\n    sky.material.uniforms.turbidity.value=raceAtmosphere.turbidity;\n    rain.clear();rivalPlanner=planRivals();overtakes.reset();"],
 ["sky.material.uniforms.turbidity.value=raceAtmosphere.turbidity;", "currentWeatherLighting=wet;for(const [material,dry] of dryRoadRoughness)material.roughness=raceWeather==='rain'?Math.min(dry,.48):dry;\n    sky.material.uniforms.turbidity.value=raceAtmosphere.turbidity;"],
 ["scene.background.set(atmosphere.fog);scene.fog=new THREE.Fog(atmosphere.fog,lighting.fogNear,lighting.fogFar)", "scene.background.set(raceAtmosphere.fog);scene.fog=new THREE.Fog(raceAtmosphere.fog,raceLighting.fogNear,raceLighting.fogFar)"],
 ["scene.environmentIntensity=lighting.environment;ambient.intensity=lighting.ambient;fill.visible=false;ceiling.visible=false;sun.intensity=lighting.sun;renderer.toneMappingExposure=lighting.exposure;", "scene.environmentIntensity=raceLighting.environment;ambient.intensity=raceLighting.ambient;fill.visible=false;ceiling.visible=false;sun.intensity=raceLighting.sun;renderer.toneMappingExposure=raceLighting.exposure;"],
 ["surface:surfaceMap.surface,nitro:", "surface:raceSurface,nitro:"],
 ["speedProfile:difficulty.profile,speedLimit:55", "speedProfile:raceProfile,speedLimit:55"],
 ["speedProfile:difficultyById('hard').profile", "speedProfile:qaSpeed"],
 ["music.update(dt);", "rain.update(cars[0]?.state,dt,mode==='race'&&raceWeather==='rain'&&!paused&&!result&&countdown<=0);\n    music.update(dt);"],
 ["smoke.update(p.state,feedback,STEP);", "if(raceWeather!=='rain')smoke.update(p.state,feedback,STEP);"],
 ["presentation:next=>presentationGuard.update(next)", "weather:id=>{if(mode!=='garage')return;weather=weatherById(id).id;saveWeather(storage(),weather);publish();},presentation:next=>presentationGuard.update(next)"],
]);
edit(src+'main.jsx',[
 ["import './rebuild.css';", "import {WEATHER_OPTIONS} from './weather.js';\nimport './rebuild.css';"],
 ["onClose={()=>setSettingsOpen(false)}/>", "onClose={()=>setSettingsOpen(false)}><div role=\"group\" aria-label=\"날씨 선택\" className=\"weather-options\"><span>주행 날씨</span>{WEATHER_OPTIONS.map(w=><button key={w.id} aria-pressed={(stats.weather||'clear')===w.id} onClick={()=>runtime.current.weather(w.id)}>{w.id==='rain'?'비 · 젖은 노면':'맑음'}</button>)}</div></GraphicsSettings>"],
 ["WASD 주행 · SHIFT 드리프트", "{stats.weather==='rain'&&'비 · 젖은 노면 / '}WASD 주행 · SHIFT 드리프트"],
]);
edit('scripts/race-sim.mjs',[
 ["const COLLIDERS=", "import {createWeatherSurfaceQuery,weatherSpeedProfile} from '../src/rebuild/weather.js';\n\nconst COLLIDERS="],
 ["laps=1,personalities=true}", "laps=1,personalities=true,weather='clear'}"],
 ["const planner=createRivalPlanner(route,{", "const wetSurface=createWeatherSurfaceQuery(surfaceMap,weather),raceProfile=weatherSpeedProfile(difficulty.profile,weather),drivenProfile=weatherSpeedProfile(playerProfile,weather);\n const planner=createRivalPlanner(route,{"],
 ["speedProfile:difficulty.profile,nitro:", "speedProfile:raceProfile,nitro:"],
 ["surface:surfaceMap.surface,nitro:", "surface:wetSurface,nitro:"],
 ["speedProfile:playerProfile", "speedProfile:drivenProfile"],
 ["return {track:track.id,difficulty:difficulty.id", "return {track:track.id,difficulty:difficulty.id,weather"],
 ["if(c.state.surface.grip<.9)", "if(c.state.surface.grip<(weather==='rain'?.9*.86:.9))"],
]);
const css=fs.readFileSync(src+'rebuild.css','utf8');fs.writeFileSync(out+'rebuild.css',css+'\n.weather-options{display:flex;align-items:center;gap:10px;margin-top:18px}.weather-options>span{font-size:12px;margin-right:auto}.weather-options button{margin:0;width:auto;min-width:100px;padding:10px 16px;background:#182a3e;border:1px solid #63809266}.weather-options button[aria-pressed=true]{background:#c9eaff;color:#142032}@container game (max-width:700px) or (max-height:550px){.weather-options{margin-top:10px}.weather-options button{padding:7px 10px}}\n');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));pkg.scripts['check:rebuild']=pkg.scripts['check:rebuild'].replace('scripts/rival-personalities.test.mjs','scripts/weather.test.mjs scripts/rain-vfx.test.mjs scripts/rain-race.test.mjs scripts/rival-personalities.test.mjs');fs.writeFileSync(out+'package.json',JSON.stringify(pkg,null,2)+'\n');
console.log('rain integration candidates prepared without changing the running feature');
