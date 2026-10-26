const KEY='mumu-driving-motion-v1';
export const MOTION_SETTINGS=Object.freeze([{id:'auto',label:'자동'},{id:'standard',label:'표준'},{id:'reduced',label:'줄임'}]);
export const normalizeMotionSetting=id=>MOTION_SETTINGS.some(s=>s.id===id)?id:'auto';
export const reducedDrivingMotion=(setting,systemReduced)=>setting==='reduced'||normalizeMotionSetting(setting)==='auto'&&!!systemReduced;
export function loadMotionSetting(storage){try{return normalizeMotionSetting((storage===undefined?globalThis.localStorage:storage)?.getItem(KEY));}catch{return 'auto';}}
export function saveMotionSetting(storage,id){try{storage?.setItem(KEY,normalizeMotionSetting(id));return !!storage;}catch{return false;}}
