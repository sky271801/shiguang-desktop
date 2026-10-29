const {_electron}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sg-memory-'));let app;
 const stats=()=>app.evaluate(({app,BrowserWindow,webContents})=>({pages:webContents.getAllWebContents().length,windows:BrowserWindow.getAllWindows().length,renderer:app.getAppMetrics().filter(m=>m.type==='Tab').length,workingSetMB:Math.round(app.getAppMetrics().reduce((a,m)=>a+m.memory.workingSetSize,0)/1024)}));
 const waitNoWindow=async()=>{for(let i=0;i<30;i++){if(!(await stats()).windows)return;await new Promise(r=>setTimeout(r,100));}throw new Error('Idle renderer did not unload');};
 try{
  app=await _electron.launch({args:[process.cwd(),'--autostart'],env:{...process.env,SHIGUANG_TEST_DATA:data,SHIGUANG_SUSPEND_MS:'400'}});
  await app.evaluate(async({app})=>{await app.whenReady();});await new Promise(r=>setTimeout(r,400));
  const cold=await stats();assert.equal(cold.windows,0);assert.equal(cold.pages,0);assert.equal(fs.existsSync(path.join(data,'collection')),false);
  await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));let page=await app.firstWindow();await page.waitForSelector('#quickText');
  await page.evaluate(()=>window.vault.copy({text:'闲置释放后仍然保留的收藏'}));await page.keyboard.press('Control+v');await page.waitForSelector('.card');
  const open=await stats();
  await page.locator('#settingsBtn').click();await page.waitForSelector('#settingsDialog[open]');
  assert.equal(await page.locator('#settingsDialog').evaluate(e=>getComputedStyle(e,'::backdrop').backdropFilter),'none');
  const effects=await page.locator('#modalScrim').evaluate(e=>e.getAnimations().flatMap(a=>a.effect.getKeyframes()));
  assert.ok(effects.every(f=>Object.keys(f).every(k=>['opacity','offset','computedOffset','easing','composite'].includes(k))));
  assert.equal(await page.locator('#quickBanner').count(),0);
  await page.locator('#startupToggle').click();await page.waitForFunction(()=>document.querySelector('#startupToggle').getAttribute('aria-checked')==='true');
  await page.locator('#closeSettings').click();await page.waitForSelector('#settingsDialog',{state:'hidden'});
  await page.locator('#quickText').fill('不能丢失的未发送草稿');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await new Promise(r=>setTimeout(r,800));assert.equal((await stats()).windows,1);
  await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));await page.waitForFunction(()=>document.activeElement.id==='quickText');assert.equal(await page.locator('#quickText').inputValue(),'不能丢失的未发送草稿');
  await page.locator('#quickText').fill('');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await waitNoWindow();
  const idle=await stats();assert.equal(idle.pages,0);
  await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));page=await app.firstWindow();await page.waitForSelector('.card');await page.waitForFunction(()=>document.activeElement.id==='quickText');
  assert.ok((await page.locator('.card').textContent()).includes('闲置释放后仍然保留的收藏'));
  console.log(JSON.stringify({cold,open,idle}));console.log('PASS: 主程序静默启动不创建界面、首次使用延迟加载、闲置释放、草稿保护、重新唤起、纯透明度遮罩、横幅移除、启动开关（隔离模拟）');
 }finally{if(app)await app.close().catch(()=>{});fs.rmSync(data,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
