// Original stylized synthesis, not recordings or manufacturer acoustic data.
const voice=(label,pulses,harmonics,bass,brightness,intake)=>Object.freeze({label,pulses,harmonics:Object.freeze(harmonics),bass,brightness,intake});
export const ENGINE_VOICES=Object.freeze({
 legacy:voice('기본 엔진',2,[1,.28,.12,.06],.055,1,0),
 supra:voice('부드러운 터보 톤',3,[1,.42,.21,.12,.07,.04],.055,.92,.055),
 slk:voice('경쾌한 로드스터 톤',2,[1,.25,.32,.10,.15,.05],.025,.85,.035),
 mustang:voice('낮고 굵은 머슬 톤',4,[1,.72,.24,.36,.10,.18,.04,.08],.10,.65,0),
 porsche911:voice('건조한 스포츠 톤',3,[1,.23,.48,.18,.27,.10,.13,.06],.04,1.18,.015),
 gtr:voice('깊은 트윈터보 톤',3,[1,.58,.15,.29,.07,.14,.04],.075,.86,.085),
 rx7:voice('높고 매끈한 로터리 톤',2,[.65,.80,.24,.34,.10,.17,.05],.018,1.30,.035),
 m3:voice('선명한 스포츠 세단 톤',3,[1,.35,.32,.17,.12,.10,.06,.03],.045,1.08,.02),
 huracan:voice('날카로운 고회전 톤',5,[1,.48,.38,.24,.18,.13,.09,.06,.04],.025,1.48,.01),
});
export const engineVoice=id=>ENGINE_VOICES[id]||ENGINE_VOICES.legacy;
export function engineWave(id){
 const harmonics=engineVoice(id).harmonics,real=new Float32Array(harmonics.length+1),imag=new Float32Array(harmonics.length+1);
 harmonics.forEach((a,i)=>imag[i+1]=a);return {real,imag};
}
