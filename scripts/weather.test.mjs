import test from 'node:test';import assert from 'node:assert/strict';
import {weatherSurface,weatherSpeedProfile,weatherLighting,loadWeather,saveWeather,createWeatherSurfaceQuery} from '../src/rebuild/weather.js';
import {createSurfaceMap} from '../src/rebuild/raceSurface.js';
test('rain changes actual road contact grip/drag without altering dry surfaces or collision geometry',()=>{
 const dry=Object.freeze({kind:'asphalt',grip:1,drag:0});
 assert.equal(weatherSurface(dry,'clear'),dry);
 const wet=weatherSurface(dry,'rain');assert.equal(wet.grip,.86);assert.ok(wet.drag>dry.drag);assert.equal(dry.grip,1);
 const wall=Object.freeze({kind:'wall',grip:1,drag:0});assert.equal(weatherSurface(wall,'rain'),wall);
 const profile=Object.freeze({maxSpeed:225,lateralAcceleration:6.2,fullBrakingHorizon:true});
 const rain=weatherSpeedProfile(profile,'rain');assert.ok(rain.maxSpeed<profile.maxSpeed&&rain.lateralAcceleration<profile.lateralAcceleration);assert.equal(rain.fullBrakingHorizon,true);
});
test('rain preserves visible fog range and selection tolerates blocked storage',()=>{
 const light={sun:2,ambient:.4,exposure:.7,fogNear:800,fogFar:2400},sky={fog:'#ffffff',turbidity:3};
 const wet=weatherLighting(light,sky,'rain');assert.ok(wet.lighting.fogNear>=500&&wet.lighting.fogFar>wet.lighting.fogNear);assert.notEqual(wet.atmosphere.fog,sky.fog);
 const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(loadWeather(storage),'clear');assert.equal(saveWeather(storage,'rain'),true);assert.equal(loadWeather(storage),'rain');
 assert.equal(loadWeather({getItem:()=>{throw Error('blocked');}}),'clear');assert.equal(saveWeather({setItem:()=>{throw Error('full');}},'rain'),false);
});
test('wet contacts use exported collider kinds, cache results and preserve solid barriers',()=>{
 const map=createSurfaceMap();map.add(1,'Road_Asphalt');map.add(2,'Terrain');map.add(3,'RaceBarrier');
 const query=createWeatherSurfaceQuery(map,'rain');
 const road=query({handle:1});assert.equal(road.grip,.86);assert.equal(query({handle:1}),road);
 assert.equal(query({handle:2}).grip,.62*.86);
 assert.equal(query({handle:3}),map.surface({handle:3}));assert.equal(query({handle:99}),map.surface({handle:99}));
 assert.equal(createWeatherSurfaceQuery(map,'clear')({handle:1}),map.surface({handle:1}));
});
