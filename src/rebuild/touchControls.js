// A tablet may report a mouse as its primary pointer while still supporting fingers.
export function hasTouchInput({primaryCoarse=false,anyCoarse=false,maxTouchPoints=0}={}){
 return primaryCoarse||anyCoarse||maxTouchPoints>0;
}

export function showTouchControls(width,height,{touch=false,force=false}={}){
 // Match the compact HUD, including short windows wider than 1000px.
 return touch||force||width<=700||height<=550;
}

export const TOUCH_CONTROLS_KEY='mumu-touch-controls-v1';
