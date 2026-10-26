// Model geometry dimensions and gameplay calibration, not factory simulation.
export const VEHICLES=Object.freeze([
 {id:'supra',name:'GR Supra',label:'SPORT COUPÉ',color:'#69b5f0',length:4.38,track:1.59,wheelbase:2.47,wheelRadius:.35},
 {id:'slk',name:'SLK Roadster',label:'OPEN-TOP ROADSTER',color:'#bcc6cc',length:4.14,track:1.55,wheelbase:2.43,wheelRadius:.34},
 {id:'mustang',name:'Mustang GT',label:'AMERICAN MUSCLE',color:'#b74935',length:4.8,track:1.62,wheelbase:2.72,wheelRadius:.365},
 {id:'porsche911',name:'Porsche 911',label:'REAR-ENGINE ICON',color:'#dcc497',length:4.52,track:1.58,wheelbase:2.45,wheelRadius:.35},
 {id:'gtr',name:'Nissan GT-R',label:'JAPANESE SUPERCAR',color:'#66768b',length:4.71,track:1.60,wheelbase:2.78,wheelRadius:.36,quadExhaust:true},
 {id:'rx7',name:'Mazda RX-7',label:'ROTARY LEGEND',color:'#eaa41e',length:4.28,track:1.47,wheelbase:2.42,wheelRadius:.335},
 {id:'m3',name:'BMW M3',label:'SPORT SEDAN',color:'#63b4a5',length:4.67,track:1.55,wheelbase:2.81,wheelRadius:.345,quadExhaust:true},
 {id:'huracan',name:'Lamborghini Huracán',label:'MID-ENGINE EXOTIC',color:'#afdd25',length:4.46,track:1.66,wheelbase:2.62,wheelRadius:.35},
]);
export function rivalFleet(selected,count=5){
 const start=VEHICLES.findIndex(v=>v.id===selected);
 return Array.from({length:count},(_,i)=>VEHICLES[(start+i+1)%VEHICLES.length].id);
}
