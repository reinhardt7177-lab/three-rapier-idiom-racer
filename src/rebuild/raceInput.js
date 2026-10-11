// Each keyboard key and captured pointer owns its own press. Releasing one
// source must never cancel another finger or a keyboard key on the same pedal.
export function createRaceInput(){
 const held=new Map();
 const has=(...codes)=>codes.some(code=>held.get(code)?.size);
 return {has,clear:()=>held.clear(),press(code,source='keyboard',repeat=false){
  if(repeat&&!held.get(code)?.has(source))return;
  if(!held.has(code))held.set(code,new Set());held.get(code).add(source);
 },release(code,source='keyboard'){
  const owners=held.get(code);if(!owners)return;owners.delete(source);if(!owners.size)held.delete(code);
 },read:()=>({throttle:has('KeyW','ArrowUp')?1:0,brake:has('TouchBrake')?1:0,reverse:has('KeyS','ArrowDown')?1:0,steer:Number(has('KeyD','ArrowRight'))-Number(has('KeyA','ArrowLeft')),handbrake:has('ShiftLeft','ShiftRight'),boost:has('Space')})};
}
const handled=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','Space','Escape','KeyC','KeyR','KeyM','KeyV']);
export function handleRaceKeyDown(event,actions){
 if(!actions.inRace()||!handled.has(event.code)||event.target.closest?.('input,textarea,select,[contenteditable="true"]'))return;
 // ESC must work even when clicking the menu left its button focused.
 if(event.code==='Escape'){event.preventDefault();if(!event.repeat)actions.pause();return;}
 // Recovery remains available after touching a pedal left its button focused.
 if(event.code==='KeyC'){event.preventDefault();if(!event.repeat&&actions.canDrive())actions.recover();return;}
 // Preserve Space/Enter and navigation semantics on menu buttons.
 if(event.target.closest?.('button'))return;
 event.preventDefault();
 if(event.code==='KeyR'){if(!event.repeat)actions.restart();return;}
 if(event.code==='KeyM'){if(!event.repeat)actions.mute();return;}
 if(event.code==='KeyV'){if(!event.repeat)actions.camera?.();return;}
 if(actions.canDrive())actions.input.press(event.code,'keyboard',event.repeat);
}
export function raceLayout(width,height){
 const touch=width<=700||(height<=550&&width<=1000);
 return `${width>height?'landscape':'portrait'}-${touch?'touch':'keyboard'}`;
}
