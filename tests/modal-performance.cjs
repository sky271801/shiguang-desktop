const {_electron}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sg-perf-'));let app;
 try{
  app=await _electron.launch({args:[process.cwd()],env:{...process.env,SHIGUANG_TEST_DATA:data,SHIGUANG_NO_TRAY:'1'}});
  const page=await app.firstWindow();await page.waitForSelector('#settingsBtn');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
  const png=fs.readFileSync('assets/icon.png');
  await page.evaluate(async bytes=>{const image=(await window.vault.addImage(new Uint8Array(bytes))).value;for(let i=0;i<36;i++)await window.vault.save({text:'渲染性能验证 '+i,images:i%2?[image]:[]});},[...png]);
  await page.reload();await page.waitForSelector('.card');
  const cdp=await page.context().newCDPSession(page);let events=[];cdp.on('Tracing.dataCollected',({value})=>events.push(...value));
  await cdp.send('Tracing.start',{categories:'devtools.timeline,cc,benchmark',options:'record-as-much-as-possible'});
  const timings=await page.evaluate(async()=>{
   const intervals=[];let previous=0,collect=false;
   const frame=time=>{if(collect&&previous)intervals.push(time-previous);previous=time;requestAnimationFrame(frame);};requestAnimationFrame(frame);
   for(let i=0;i<5;i++){
    collect=true;previous=0;document.querySelector('#settingsBtn').click();
    await new Promise(resolve=>setTimeout(resolve,440));
    await closeDialog(document.querySelector('#settingsDialog'));
    await new Promise(resolve=>setTimeout(resolve,240));collect=false;
   }
   return intervals;
  });
  const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');await done;
  const sorted=[...timings].sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))];
  const paint=events.filter(e=>e.name==='Paint'&&e.ph==='X');
  const gpu=await app.evaluate(({app})=>app.getGPUFeatureStatus());
  const result={samples:timings.length,medianMs:+pct(.5).toFixed(2),p95Ms:+pct(.95).toFixed(2),over25ms:timings.filter(t=>t>25).length,paintEvents:paint.length,paintMs:+(paint.reduce((s,e)=>s+(e.dur||0),0)/1000).toFixed(2),gpu};
  const suffix=process.argv[2]||'current';fs.mkdirSync('tests/results',{recursive:true});fs.writeFileSync(`tests/results/modal-${suffix}.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{if(app)await app.close().catch(()=>{});fs.rmSync(data,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
