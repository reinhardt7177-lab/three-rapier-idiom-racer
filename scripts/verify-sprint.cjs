const { chromium }=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const {openMenu,resume,exitDrive,recoverDrive}=require('./drive-ui.cjs');
(async()=>{
  const {COAST_ROADS,offsetPoint}=await import('../src/driving/coastRoute.js');
  const {steeringLimit}=await import('../src/driving/steering.js');
  const {SPRINT_KEY}=await import('../src/driving/sprint.js');
  const output=require('node:path').resolve(process.env.GARAGE_ARTIFACT_ROOT||'artifacts','sprint');await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.GARAGE_BROWSER_PATH,args:['--enable-unsafe-swiftshader']});
  const errors=[],failures=[];
  try{
    const page=await browser.newPage({viewport:{width:1280,height:800}});page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failures.push(r.url()));
    await page.goto(process.env.GARAGE_BASE_URL||'http://127.0.0.1:5175/',{waitUntil:'networkidle'});
    // Network idle alone does not mean the initial WebGL frame is ready.
    await page.waitForFunction(()=>document.querySelector('footer')?.textContent.includes('FPS'),null,{timeout:60000});
    await page.getByRole('button',{name:/해안 스프린트 →/}).click();console.log('sprint entry clicked');await page.locator('[data-sprint-phase="briefing"]').waitFor({timeout:60000});console.log('briefing ready');
    await page.screenshot({path:`${output}/briefing.jpg`,type:'jpeg',quality:75});
    await page.getByRole('button',{name:'3초 후 출발 →'}).click();
    const stationarySpeed=await page.locator('[data-speed]').getAttribute('data-speed');
    const stationaryZ=await page.locator('[data-z]').getAttribute('data-z');
    await page.keyboard.down('KeyW');await page.waitForTimeout(350);await page.keyboard.up('KeyW');
    assert.equal(await page.locator('[data-speed]').getAttribute('data-speed'),stationarySpeed);
    assert.equal(await page.locator('[data-z]').getAttribute('data-z'),stationaryZ);
    assert.equal(await page.locator('[data-sprint-time]').getAttribute('data-sprint-time'),'0');
    await openMenu(page);const frozen=await page.locator('[data-sprint-time]').getAttribute('data-sprint-time');await page.waitForTimeout(350);assert.equal(await page.locator('[data-sprint-time]').getAttribute('data-sprint-time'),frozen);await resume(page);
    await page.locator('[data-sprint-phase="running"]').waitFor();await page.locator('canvas').focus();
    const points=COAST_ROADS.harbor.filter(p=>p.z>=-725).map(p=>({...p,...offsetPoint(p,3.5)}));
    let index=0,sigma=0,peak=0,maxCalls=0,lastGate=0;const held=new Set();
    const read=()=>page.locator('[data-time]').evaluate(e=>({x:+e.dataset.x,z:+e.dataset.z,speed:+e.dataset.speed,yaw:+e.dataset.heading,contacts:+e.dataset.contacts,calls:+e.dataset.drawCalls,phase:document.querySelector('[data-sprint-phase]').dataset.sprintPhase,valid:document.querySelector('[data-sprint-valid]').dataset.sprintValid,gate:+document.querySelector('[data-sprint-gate]').dataset.sprintGate,time:+document.querySelector('[data-sprint-time]').dataset.sprintTime}));
    const input=async codes=>{for(const c of held)if(!codes.includes(c)){await page.keyboard.up(c);held.delete(c);}for(const c of codes)if(!held.has(c)){await page.keyboard.down(c);held.add(c);}};
    let final;
    for(let k=0;k<2500;k++){
      const s=await read();peak=Math.max(peak,s.speed);maxCalls=Math.max(maxCalls,s.calls);if(k%200===0)console.log(JSON.stringify(s));
      if(s.gate!==lastGate){lastGate=s.gate;await page.screenshot({path:`${output}/sector-${lastGate}.jpg`,type:'jpeg',quality:75});}
      if(s.phase==='complete'){final=s;break;}
      if(s.phase==='cooldown'){await input([]);await page.waitForTimeout(80);continue;}
      assert.equal(s.valid,'true',`invalid run at ${JSON.stringify(s)}`);
      let nearest=index,distance=Infinity;
      for(let j=index;j<=Math.min(index+45,points.length-1);j++){const d=Math.hypot(points[j].x-s.x,points[j].z-s.z);if(d<distance){distance=d;nearest=j;}}
      assert.ok(distance<9,`driver left lane: ${distance}`);index=nearest;
      let target=index,travel=0;while(target<points.length-1&&travel<7+s.speed/3.6*.35){travel+=Math.hypot(points[target+1].x-points[target].x,points[target+1].z-points[target].z);target++;}
      const t=points[target],angle=Math.atan2(t.x-s.x,t.z-s.z),err=Math.atan2(Math.sin(angle-s.yaw),Math.cos(angle-s.yaw));
      const desire=Math.max(-1,Math.min(1,-Math.atan(2*2.84*Math.sin(err)/Math.max(3,Math.hypot(t.x-s.x,t.z-s.z)))/steeringLimit(s.speed/3.6)));
      sigma=Math.max(-1.5,Math.min(1.5,sigma+desire));const steer=sigma>.5?'KeyD':sigma<-.5?'KeyA':null;if(steer)sigma-=steer==='KeyD'?1:-1;
      const targetSpeed=points[index].s<345?145:points[index].s<405?85:points[index].s<690?63:105;
      const power=s.speed<targetSpeed-1?'KeyW':s.speed>targetSpeed+2?'KeyB':null;
      await input([steer,power].filter(Boolean));await page.waitForTimeout(55);
    }
    await input([]);assert.ok(final,'finish reached by real keyboard input');assert.equal(final.gate,3);assert.equal(final.valid,'true');
    await page.screenshot({path:`${output}/result.jpg`,type:'jpeg',quality:75});
    const record=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),SPRINT_KEY);assert.ok(record.time>5&&record.splits.length===3);assert.ok(Math.abs(record.time-final.time)<.01);
    const {GHOST_KEY,validateGhost,createGhostSampler}=await import('../src/driving/ghost.js');
    const ghostRecord=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),GHOST_KEY);
    assert.ok(validateGhost(ghostRecord),'actual completed run produced a valid recorded ghost');
    assert.ok(Math.abs(ghostRecord.time-final.time)<.001);
    await page.getByRole('button',{name:'바로 재도전 →'}).click();await page.locator('[data-sprint-phase="running"]').waitFor();
    assert.equal(await page.locator('[data-sprint-gate]').getAttribute('data-sprint-gate'),'0');
    await page.waitForFunction(()=>document.querySelector('[data-ghost-visible]')?.dataset.ghostVisible==='true',null,{timeout:10000});
    await page.screenshot({path:`${output}/ghost-replay.jpg`,type:'jpeg',quality:75});
    await openMenu(page);await page.waitForTimeout(250);
    const ghostRead=()=>page.locator('[data-ghost-clock]').evaluate(e=>({time:+e.dataset.ghostClock,x:+e.dataset.ghostX,z:+e.dataset.ghostZ,visible:e.dataset.ghostVisible}));
    const ghostPaused=await ghostRead();await page.waitForTimeout(350);assert.deepEqual(await ghostRead(),ghostPaused,'pause freezes ghost and race on the same clock');
    const sampled=createGhostSampler()(ghostRecord,ghostPaused.time);
    const {Vector3,Quaternion}=await import('three');
    const {VEHICLE}=await import('../src/driving/physics.js');
    // Recorded coordinates are the rigid body's centre; the visible car origin
    // is lowered along its rotated local Y, exactly like the player model.
    const offset=new Vector3(0,-VEHICLE.modelOffset,0).applyQuaternion(new Quaternion(sampled.rotation.x,sampled.rotation.y,sampled.rotation.z,sampled.rotation.w));
    const replayError=Math.hypot(sampled.position.x+offset.x-ghostPaused.x,sampled.position.z+offset.z-ghostPaused.z);
    assert.ok(replayError<.01,`rendered ghost matches recording in model coordinates: ${JSON.stringify({replayError,ghostPaused,sampled})}`);
    await page.getByRole('button',{name:'고스트 숨기기',exact:true}).click();await page.waitForTimeout(150);assert.equal((await ghostRead()).visible,'false');
    await page.getByRole('button',{name:'고스트 표시',exact:true}).click();await resume(page);
    await recoverDrive(page);assert.equal(await page.locator('[data-sprint-valid]').getAttribute('data-sprint-valid'),'false');
    const sizes=[[800,1280],[1024,600],[390,844],[640,400]];
    for(const [width,height] of sizes){await page.setViewportSize({width,height});await page.waitForTimeout(250);await openMenu(page);await page.getByLabel('터치 버튼 표시',{exact:true}).selectOption('on');await resume(page);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      for(const name of ['왼쪽 조향','오른쪽 조향','가속']){const b=await page.getByRole('button',{name,exact:true}).boundingBox();assert.ok(b&&b.width>=48&&b.height>=48&&b.y+b.height<=height);}
      await page.screenshot({path:`${output}/${width}x${height}.jpg`,type:'jpeg',quality:65});
    }
    const gas=await page.getByRole('button',{name:'가속',exact:true}).boundingBox(),right=await page.getByRole('button',{name:'오른쪽 조향',exact:true}).boundingBox();
    const cdp=await page.context().newCDPSession(page);
    const finger=(r,id)=>({x:r.x+r.width/2,y:r.y+r.height/2,id,radiusX:6,radiusY:6});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger(gas,1),finger(right,2)]});
    await page.waitForTimeout(700);const touched=await read();assert.ok(touched.speed>3&&touched.yaw<-.005,'two fingers accelerate and steer');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(350);
    await openMenu(page);const pausedTime=(await read()).time;await page.waitForTimeout(250);assert.equal((await read()).time,pausedTime);await resume(page);
    await exitDrive(page);await page.reload({waitUntil:'networkidle'});assert.ok((await page.locator('.sprint-entry').innerText()).includes('개인 최고'));
    await page.getByRole('button',{name:/해안 스프린트 →/}).click();await page.locator('[data-sprint-phase="briefing"]').waitFor({timeout:60000});
    assert.ok((await page.locator('.sprint-result').innerText()).includes('개인 최고 0:'));
    assert.equal(await page.locator('[data-ghost-available]').getAttribute('data-ghost-available'),'true','garage reload restores the recorded ghost');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    const report={checkedAt:new Date().toISOString(),time:final.time,peakKmh:peak,maxDrawCalls:maxCalls,record,ghost:{samples:ghostRecord.samples.length,serializedBytes:Buffer.byteLength(JSON.stringify(ghostRecord)),replayError},errors,failures,checks:['countdown blocks throttle','pause freezes countdown','actual keyboard three gates and automatic braking','valid PB and real ghost saved','instant retry resets gates and replays ghost','pause freezes ghost','rendered ghost matches recording','hide/show ghost','recovery invalidates run','4 touch viewports','real two-finger input, cancellation and pause','garage and reload preserve best and ghost'],note:'Headless Chrome software GPU. No real Samsung device or human fun assessment.'};
    await fs.writeFile(`${output}/verification.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
