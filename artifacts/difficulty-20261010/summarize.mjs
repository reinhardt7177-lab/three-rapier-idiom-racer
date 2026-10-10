import fs from 'node:fs';
for(const f of process.argv.slice(2)){
 try{const r=JSON.parse(fs.readFileSync(f));const rv=r.cars.filter(c=>!c.player);
 console.log(f,r.seconds,'rivalMean',(rv.reduce((s,c)=>s+c.finish,0)/rv.length).toFixed(1),'\n  ',r.cars.map(c=>(c.player?'YOU':c.id)+':'+c.place+'/'+c.finish+(c.offroadSeconds?' off'+c.offroadSeconds+'@'+c.offroadAt:'')+(c.scrapeSeconds?' scr'+c.scrapeSeconds:'')+(c.boostSeconds?' n'+c.boostSeconds:'')+(c.draftSeconds?' d'+c.draftSeconds:'')+' low'+c.lowest).join(' | '));}catch(e){console.log(f,'pending',e.message.slice(0,60));}
}
