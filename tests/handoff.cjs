const {_electron}=require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),{execFile}=require('node:child_process');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sg-handoff-')),exe=path.resolve('release',require('../package.json').version,'win-unpacked/拾光.exe');
 const env={...process.env,SHIGUANG_TEST_DATA:data,SHIGUANG_SUSPEND_MS:'300',SHIGUANG_HELPER_TEST:'-handoff-'+process.pid};let app;
 const launch=async()=>{app=await _electron.launch({executablePath:exe,env});const page=await app.firstWindow();await page.waitForSelector('#quickText');return page;};
 try{
  let page=await launch();await page.evaluate(()=>window.vault.copy({text:'轻量托盘交接后保留的收藏'}));await page.keyboard.press('Control+v');await page.waitForSelector('.card');
  await page.locator('#quickText').fill('未提交草稿阻止退出');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await new Promise(r=>setTimeout(r,700));assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1);
  await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));await page.locator('#quickText').fill('');
  const closed=app.waitForEvent('close',{timeout:10000});await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());await closed;app=null;
  assert.ok(fs.existsSync(path.join(data,'collection','library.json')));
  page=await launch();await page.waitForSelector('.card');assert.ok((await page.locator('.card').textContent()).includes('轻量托盘交接后保留的收藏'));await page.waitForFunction(()=>document.activeElement.id==='quickText');
  console.log('PASS: 正式 EXE 有草稿时不退出，无草稿时交给原生轻量托盘并完全退出，重新打开保留数据与输入焦点');
 }finally{
  if(app)await app.close().catch(()=>{});
  await new Promise(resolve=>execFile(path.join(path.dirname(exe),'拾光托盘.exe'),['--stop'],{env,windowsHide:true},()=>resolve()));
  fs.rmSync(data,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
