const {chromium}=require('../node_modules/@playwright/test');
const {createHash}=require('crypto');
const fs=require('fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3016/Shiguang');await page.waitForFunction(()=>typeof window.remotion_setFrame==='function');await page.waitForTimeout(750);
  const clip=await page.evaluate(()=>{for(const el of document.querySelectorAll('div')){const r=el.getBoundingClientRect();if(r.width>800&&r.width<1200&&Math.abs(r.width/r.height-16/9)<.01&&r.y>50&&r.y<200)return {x:r.x,y:r.y,width:r.width,height:r.height};}throw new Error('Preview not found');});
  const unchanged=[];
  for(let second=.25;second<40;second+=.5){
   let previous;
   for(const frame of [Math.round(second*60),Math.round(second*60)+1]){
    await page.evaluate(f=>window.remotion_setFrame(f,'Shiguang',0),frame);await page.waitForTimeout(65);
    const data=await page.screenshot({clip});const hash=createHash('sha256').update(data).digest('hex');
    if(previous===hash)unchanged.push(second);previous=hash;
   }
  }
  if(errors.length)throw new Error(errors.join('\n'));
  const report={durationSeconds:40,fps:60,sampledAdjacentFramePairs:80,unchangedPairs:unchanged,method:'Screenshot pixels of the video viewport at 0.5s intervals, comparing frame f and f+1; sampling does not prove every frame changes.'};
  fs.writeFileSync('qa/motion-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
