export const LANDSCAPE_ASPECT = 16 / 9;

// Fit a landscape rectangle even inside a tall desktop pane.
export function landscapePresentation(width, height, coarse = false) {
  const safeWidth=Math.max(0,Number.isFinite(width)?width:0);
  const safeHeight=Math.max(0,Number.isFinite(height)?height:0);
  const stageWidth=Math.min(safeWidth,safeHeight*LANDSCAPE_ASPECT);
  const orientation=safeWidth<safeHeight?'portrait':'landscape';
  return {width:stageWidth,height:stageWidth/LANDSCAPE_ASPECT,orientation,blocked:coarse&&orientation==='portrait'};
}

// A 16:9 stage stays landscape during phone rotation. Observe the containing
// viewport too, so captured pedals are cleared on that change.
export function createPresentationGuard({clear,pause}) {
  let blocked=false,orientation=null;
  return {
    update(next) {
      const changed=orientation!==null&&orientation!==next.orientation;
      const newlyBlocked=next.blocked&&!blocked;
      blocked=!!next.blocked;orientation=next.orientation;
      if(changed||newlyBlocked){clear();pause(blocked?'orientation':'layout');}
    },
    canDrive:()=>!blocked,
  };
}

// Called only by a real button gesture. Unsupported browsers keep the
// rotation gate and landscape stage instead of pretending the lock worked.
export async function requestLandscapeFullscreen(element,{documentApi=document,orientation=screen.orientation}={}) {
  if(!documentApi.fullscreenElement){
    if(typeof element?.requestFullscreen!=='function')return {fullscreen:false,locked:false};
    try {await element.requestFullscreen({navigationUI:'hide'});}
    catch {return {fullscreen:false,locked:false};}
  }
  const fullscreen=!!documentApi.fullscreenElement;
  if(!fullscreen||typeof orientation?.lock!=='function')return {fullscreen,locked:false};
  try {await orientation.lock('landscape');return {fullscreen,locked:true};}
  catch {return {fullscreen,locked:false};}
}
