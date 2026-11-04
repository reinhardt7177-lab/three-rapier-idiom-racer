export const WEATHER_OPTIONS=Object.freeze([{id:'clear',label:'맑음'},{id:'rain',label:'비'}].map(Object.freeze));
export const WEATHER_KEY='mumu.circuit.weather.v1';
export const weatherById=id=>WEATHER_OPTIONS.find(w=>w.id===id)||WEATHER_OPTIONS[0];
export function loadWeather(storage){try{return weatherById(storage?.getItem(WEATHER_KEY)).id;}catch{return 'clear';}}
export function saveWeather(storage,id){try{storage?.setItem(WEATHER_KEY,weatherById(id).id);return true;}catch{return false;}}
// Arcade wet-road calibration, not a claim about real-world tyre coefficients.
// Contact friction and drag change in Rapier. AI braking targets also drop.
export function weatherSurface(surface,weather,kind=surface.kind){
 if(weather!=='rain'||kind==='wall'||kind==='solid')return surface;
 return {...surface,grip:surface.grip*.86,drag:surface.drag+.035,wet:true};
}
export function createWeatherSurfaceQuery(surfaceMap,weather){
 const cache=new Map();
 return collider=>{const base=surfaceMap.surface(collider);if(!cache.has(base))cache.set(base,weatherSurface(base,weather,surfaceMap.kind(collider.handle)));return cache.get(base);};
}
export function weatherSpeedProfile(profile,weather){
 return weather==='rain'&&profile?Object.freeze({...profile,maxSpeed:profile.maxSpeed*.94,lateralAcceleration:profile.lateralAcceleration*.82}):profile;
}
export function weatherLighting(lighting,atmosphere,weather,night=false){
 if(weather!=='rain')return {lighting,atmosphere};
 return {lighting:{...lighting,sun:lighting.sun*.6,ambient:lighting.ambient*1.18,exposure:lighting.exposure*.96,fogNear:lighting.fogNear*.7,fogFar:lighting.fogFar*.72},atmosphere:{...atmosphere,fog:night?'#0a1936':'#8daab8',turbidity:Math.max(5,atmosphere.turbidity)}};
}
