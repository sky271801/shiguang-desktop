const { _electron } = require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const dataBase=process.platform==='win32'?path.join(process.env.APPDATA,'Shiguang'):os.tmpdir();fs.mkdirSync(dataBase,{recursive:true});
 const data=fs.mkdtempSync(path.join(dataBase,'.exe-regression-'));
 let app;
 const launch=async()=>{app=await _electron.launch({executablePath:path.resolve('release',require('../package.json').version,'win-unpacked/拾光.exe'),env:{...process.env,SHIGUANG_TEST_DATA:data}});const p=await app.firstWindow();await p.waitForSelector('#newBtn');return p;};
 try{
  let p=await launch();await p.waitForFunction(()=>document.activeElement.id==='quickText');await p.evaluate(()=>window.vault.copy({text:'EXE 持久化验证'}));await p.keyboard.press('Control+v');await p.waitForSelector('.card');assert.equal(await p.locator('dialog[open]').count(),0);
  assert.equal(await app.evaluate(({app})=>app.isPackaged),true);
  const info=await p.evaluate(()=>window.vault.info());assert.ok(info.ok);console.log('Packaged executable ready; shortcut registered:',info.value.shortcut);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
  await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));await p.waitForFunction(()=>document.activeElement.id==='quickText');
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
  await app.close();p=await launch();await p.waitForSelector('.card');await p.waitForFunction(()=>document.activeElement.id==='quickText');assert.ok((await p.locator('.card').textContent()).includes('EXE 持久化验证'));
  console.log('PASS: 最终 EXE 在真实 AppData 目录粘贴保存、重启读取、启动与重新唤起自动聚焦');
 }finally{if(app)await app.close().catch(()=>{});fs.rmSync(data,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
