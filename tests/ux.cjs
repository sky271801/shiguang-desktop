const {_electron}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const {Resvg}=require('@resvg/resvg-js');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sg-ux-'));
 const parent=fs.mkdtempSync(path.join(process.cwd(),'.migration-test-'));
 let app,page;
 const launch=async()=>{app=await _electron.launch({args:[process.cwd()],env:{...process.env,SHIGUANG_TEST_DATA:data,SHIGUANG_NO_TRAY:'1'}});page=await app.firstWindow();await page.waitForSelector('#quickText');};
 try{
  await launch();
  const images=[];
  for(const [w,h] of [[1600,100],[80,800],[40,30]]){
   const png=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#dfe6ff"/><rect x="1" y="1" width="${w-2}" height="${h-2}" fill="none" stroke="#4263eb" stroke-width="2"/></svg>`).render().asPng();
   const image=await page.evaluate(async bytes=>(await window.vault.addImage(new Uint8Array(bytes))).value,[...png]);images.push(image);
   await page.evaluate(image=>window.vault.save({images:[image]}),image);
  }
  for(let i=0;i<24;i++)await page.evaluate(i=>window.vault.save({text:'布局和滚动验证 '+i}),i);
  await page.reload();await page.waitForSelector('.card');await page.locator('[data-view="image"]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.card-image img')].every(i=>i.complete));
  const geometry=await page.locator('.card-image img').evaluateAll(imgs=>imgs.map(img=>{const box=img.getBoundingClientRect();return {w:box.width,h:box.height,nw:img.naturalWidth,nh:img.naturalHeight,fit:getComputedStyle(img).objectFit,foot:img.closest('.card').querySelector('.card-content').getBoundingClientRect().height};}));
  for(const g of geometry){assert.equal(g.fit,'contain');assert.ok(g.w<=g.nw&&g.h<=g.nh);assert.ok(g.h<=150);assert.ok(Math.abs(g.w/g.h-g.nw/g.nh)<.1);assert.ok(g.foot<55);}
  await page.screenshot({path:path.resolve('assets/images-fit-preview.png')});
  await page.locator('[data-view="all"]').click();await page.evaluate(()=>scrollTo(0,320));
  await page.locator('#settingsBtn').click();await page.waitForFunction(()=>document.documentElement.classList.contains('modal-open'));
  const before=await page.evaluate(()=>scrollY);
  await page.locator('.settings-body').evaluate(e=>e.scrollTop=e.scrollHeight);
  const box=await page.locator('.settings-body').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,1800);
  await page.mouse.move(5,100);await page.mouse.wheel(0,1200);
  await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>scrollY),before);
  await page.locator('.settings-body').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.resolve('assets/settings-preview.png')});
  // The native folder picker is stubbed; everything after folder selection is real.
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},parent);
  await page.locator('#changeStorage').click();await page.waitForFunction(()=>document.querySelector('#changeStorage').textContent==='更换位置');
  const selected=(await page.evaluate(()=>window.vault.info())).value.path;
  assert.equal(selected,path.join(parent,'拾光收藏库'));assert.ok(fs.existsSync(path.join(data,'collection','library.json')));assert.equal((await page.evaluate(()=>window.vault.list())).value.length,27);
  await page.locator('#closeSettings').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('modal-open'));
  await page.locator('#newBtn').click();assert.ok(await page.locator('#editor').evaluate(e=>e.getAnimations().length>0));
  for(const selector of ['#noteTitle','#noteText','#noteTags']){await page.locator(selector).focus();const style=await page.locator(selector).evaluate(e=>({radius:parseFloat(getComputedStyle(e).borderRadius),outline:getComputedStyle(e).outlineStyle}));assert.ok(style.radius>=8);assert.equal(style.outline,'none');}
  await page.locator('#noteText').focus();await page.screenshot({path:path.resolve('assets/editor-preview.png')});
  await page.locator('#noteText').fill('嵌套确认窗口滚动隔离');await page.locator('#cancelEditor').click();await page.waitForSelector('#confirmDialog[open]');await page.locator('#confirmNo').click();await page.waitForSelector('#confirmDialog',{state:'hidden'});assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('modal-open')),true);
  await page.locator('#cancelEditor').click();await page.locator('#confirmYes').click();await page.waitForFunction(()=>!document.documentElement.classList.contains('modal-open'));
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#newBtn').click();assert.equal(await page.locator('#editor').evaluate(e=>e.getAnimations().length),0);await page.locator('#cancelEditor').click();
  await app.close();await launch();assert.equal((await page.evaluate(()=>window.vault.info())).value.path,selected);assert.equal((await page.evaluate(()=>window.vault.list())).value.length,27);
  await page.locator('[data-view="image"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.card-image img')].every(i=>i.complete&&i.naturalWidth>0));
  console.log('PASS: 横长图/竖长图/小图完整等比例且不放大、紧凑底座、圆角焦点、弹窗背景滚动锁、嵌套弹窗、非线性动画及减少动效、实际跨目录迁移与重启加载图片');
 }catch(e){if(page)await page.screenshot({path:path.resolve('assets/ux-failure.png')}).catch(()=>{});throw e;}finally{if(app)await app.close().catch(()=>{});fs.rmSync(data,{recursive:true,force:true});fs.rmSync(parent,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
