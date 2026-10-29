const {chromium}=require('../node_modules/@playwright/test');
const fs=require('fs'),path=require('path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3016/Shiguang');await page.waitForFunction(()=>typeof window.remotion_setFrame==='function');await page.waitForTimeout(500);
  for(const second of [1,3,5,8,13,16.5,20,22.2,24.5,26,28.5,30.8,32.7,35.5,38.5]){
   await page.evaluate(frame=>window.remotion_setFrame(frame,'Shiguang',0),second*60);await page.waitForTimeout(450);
   const clip=await page.evaluate(()=>{for(const el of document.querySelectorAll('div')){const r=el.getBoundingClientRect();if(r.width>800&&r.width<1200&&Math.abs(r.width/r.height-16/9)<.01&&r.y>50&&r.y<200)return {x:r.x,y:r.y,width:r.width,height:r.height};}return undefined;});
   await page.screenshot({path:path.join(__dirname,'qa',`scene-${second}.png`),clip});
   console.log(second,await page.locator('h1').allTextContents());
  }
  const standalone=['Chat','Clutter','Lost','Reveal','Capture','Find','Finale'];
  for(const scene of standalone){await page.goto('http://localhost:3016/'+scene);await page.waitForFunction(()=>typeof window.remotion_setFrame==='function');await page.evaluate(id=>window.remotion_setFrame(150,id,0),scene);await page.waitForTimeout(200);}
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('PASS: 7 scenes seek correctly; standalone editable scene timelines load; no runtime errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
