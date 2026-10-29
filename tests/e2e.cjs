const { _electron: electron } = require('@playwright/test');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=fs.mkdtempSync(path.join(os.tmpdir(),'shiguang-ui-'));
 let app,page;const errors=[];let count=0;
 const launch=async()=>{app=await electron.launch({args:[root],env:{...process.env,SHIGUANG_TEST_DATA:data,SHIGUANG_NO_TRAY:'1'}});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('#quickText');};
 const total=async()=> (await page.evaluate(()=>window.vault.list())).value.length;
 const waitCount=async n=>{await page.waitForFunction(n=>document.querySelectorAll('.card').length===n,n);assert.equal(await page.locator('dialog[open]').count(),0);};
 const paste=async text=>{await page.evaluate(text=>window.vault.copy({text}),text);await page.locator('#quickText').focus();await page.keyboard.press('Control+v');};
 try{
 await launch();await page.waitForFunction(()=>document.activeElement.id==='quickText');
 await page.locator('#search').focus();await app.evaluate(({app,BrowserWindow})=>{BrowserWindow.getAllWindows()[0].hide();app.emit('second-instance',{},[],process.cwd());});
 await page.waitForFunction(()=>document.activeElement.id==='quickText');
 await page.waitForFunction(()=>getComputedStyle(document.querySelector('#quickForm')).borderColor==='rgb(66, 99, 235)');
 const focusStyle=await page.locator('#quickText').evaluate(e=>({outline:getComputedStyle(e).outlineStyle,radius:getComputedStyle(e.closest('form')).borderRadius,border:getComputedStyle(e.closest('form')).borderColor}));assert.equal(focusStyle.outline,'none');assert.equal(focusStyle.radius,'12px');assert.equal(focusStyle.border,'rgb(66, 99, 235)');
 await page.screenshot({path:path.join(root,'assets/empty-preview.png')});
 // One paste is one saved note; no creation or confirmation dialog.
 await paste('先证明单调有界，再研究极限。');await waitCount(++count);
 let n=(await page.evaluate(()=>window.vault.list())).value[0],created=n.createdAt;
 await page.locator('.card').click();assert.ok((await page.locator('#editHint').textContent()).includes('收藏于'));await page.locator('#noteTitle').fill('数学分析 · 有用的证明');await page.locator('#noteTags').fill('学习 数学');await page.locator('#saveBtn').click();
 n=(await page.evaluate(()=>window.vault.list())).value[0];assert.equal(n.createdAt,created);assert.ok(n.updatedAt>=created);
 await page.locator('[data-action="star"]').click();await page.waitForSelector('.starred');await page.locator('[data-view="star"]').click();assert.equal(await page.locator('.card').count(),1);
 await page.locator('#search').fill('不存在的关键词');assert.equal(await page.locator('.card').count(),0);await page.locator('#search').fill('');await page.waitForSelector('.card');
 await page.evaluate(()=>window.vault.copy({text:'搜索粘贴测试'}));await page.locator('#search').focus();await page.keyboard.press('Control+v');assert.equal(await page.locator('#search').inputValue(),'搜索粘贴测试');assert.equal(await total(),count);await page.locator('#search').fill('');
 await page.locator('[data-view="all"]').click();await page.locator('[data-action="trash"]').click();await page.waitForSelector('#empty:not([hidden])');await page.locator('[data-view="trash"]').click();await page.waitForSelector('.card');await page.locator('[data-action="restore"]').click();await page.waitForSelector('#empty:not([hidden])');await page.locator('[data-view="all"]').click();await page.waitForSelector('.card');
 const png=fs.readFileSync(path.join(root,'assets/icon.png')).toString('base64');
 // Native clipboard image, then keyboard paste, is saved immediately.
 await app.evaluate(async({clipboard,ClipboardItem},png)=>{await clipboard.write([new ClipboardItem({'image/png':new Blob([Buffer.from(png,'base64')],{type:'image/png'})})]);},png);
 await page.locator('#quickText').focus();await page.keyboard.press('Control+v');await waitCount(++count);
 // Native copied PDF (Explorer's CF_HDROP representation).
 const pdf=path.join(data,'课程资料.pdf');fs.writeFileSync(pdf,'%PDF-1.7\nTest');
 await app.evaluate(async({clipboard,ClipboardItem},file)=>{const {pathToFileURL}=process.getBuiltinModule('node:url');await clipboard.write([new ClipboardItem({'text/uri-list':pathToFileURL(file).href})]);},pdf);
 await page.keyboard.press('Control+v');await waitCount(++count);assert.ok((await page.evaluate(()=>window.vault.list())).value.some(n=>n.files.some(f=>f.name==='课程资料.pdf')));
 // Drop image and PDF together with no dialog.
 await page.evaluate(png=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(png),x=>x.charCodeAt(0))],'图标.png',{type:'image/png'}));dt.items.add(new File(['%PDF-1.7'],'复习资料.pdf',{type:'application/pdf'}));document.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},png);await waitCount(++count);
 await page.locator('.card').first().locator('.card-content').click();await page.waitForSelector('.file-row');await page.locator('.attachment img').click();await page.waitForSelector('#imageViewer[open]');await page.locator('#closeViewer').click();await page.locator('#cancelEditor').click();await page.waitForSelector('#editor',{state:'hidden'});
 // Typed Enter, Shift+Enter newline, and IME safety.
 await page.locator('#quickText').fill('随手记录的一句话');await page.locator('#quickText').press('Enter');await waitCount(++count);assert.equal(await page.locator('#quickText').inputValue(),'');
 await page.locator('#quickText').fill('第一行');await page.locator('#quickText').press('Shift+Enter');assert.equal(await page.locator('#quickText').inputValue(),'第一行\n');assert.equal(await total(),count);
 await page.locator('#quickText').dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.equal(await total(),count);await page.locator('#quickText').fill('');
 // Global shortcut event saves independently, without swallowing an editing draft.
 await page.locator('.card').first().click();await page.locator('#noteText').fill('尚未提交的编辑草稿');await page.evaluate(()=>window.vault.copy({text:'全局快捷键直接收藏'}));await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('capture'));await page.waitForFunction(n=>document.querySelectorAll('.card').length===n,++count);assert.equal(await page.locator('#noteText').inputValue(),'尚未提交的编辑草稿');await page.locator('#cancelEditor').click();await page.locator('#confirmYes').click();await page.waitForSelector('#editor',{state:'hidden'});
 // Undo immediately saved content, then restore.
 await paste('这条稍后撤销');await waitCount(++count);await page.locator('#toast button').click();await page.waitForFunction(n=>document.querySelectorAll('.card').length===n,count-1);await page.locator('[data-view="trash"]').click();await page.locator('[data-action="restore"]').click();await page.locator('[data-view="all"]').click();await waitCount(count);
 // A failed auto-save shows failure and can retry without re-pasting.
 await app.evaluate(({app})=>{const {Store}=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/main.js')('./store.js');global.originalSave=Store.prototype.save;Store.prototype.save=function(input){if(input.text==='模拟保存失败')throw new Error('模拟磁盘写入失败');return global.originalSave.call(this,input);};});
 await paste('模拟保存失败');await page.waitForFunction(()=>document.querySelector('#sendState').textContent.includes('未保存'));assert.equal(await total(),count);
 await app.evaluate(({app})=>{const {Store}=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/main.js')('./store.js');Store.prototype.save=global.originalSave;});await page.locator('#sendState').click();await waitCount(++count);
 // Successive DOM pastes queue safely.
 await page.evaluate(()=>{for(const text of ['连续粘贴 A','连续粘贴 B']){const dt=new DataTransfer();dt.setData('text/plain',text);document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}});count+=2;await waitCount(count);
 const backup=path.join(data,'backup.zip');await app.evaluate(({dialog},backup)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:backup});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[backup]});},backup);
 await page.locator('#settingsBtn').click();await page.locator('#exportBtn').click();await page.waitForFunction(()=>document.querySelector('#exportBtn').textContent==='导出备份');assert.ok(fs.existsSync(backup));await page.locator('#importBtn').click();await page.waitForFunction(()=>document.querySelector('#importBtn').textContent==='导入备份');assert.equal(await total(),count);await page.locator('#closeSettings').click();
 // Layout at the supported minimum, normal and large Windows sizes; no overlap at focus.
 await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('visible'));
 for(const [width,height] of [[940,640],[1280,850],[1440,900]]){
  await app.evaluate(({BrowserWindow},{width,height})=>BrowserWindow.getAllWindows()[0].setSize(width,height),{width,height});
  await page.locator('#quickText').focus();const box=await page.locator('#quickText').boundingBox();const viewport=await page.evaluate(()=>({w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth}));assert.ok(box.y+box.height<=viewport.h);assert.ok(viewport.scroll<=viewport.w);const settingsBox=await page.locator('#settingsBtn').boundingBox();assert.ok(settingsBox.y+settingsBox.height<=viewport.h);await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(root,`assets/preview-${width}.png`)});
 }
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.card').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 await app.close();await launch();await page.waitForSelector('.card');assert.equal(await total(),count);assert.equal((await page.evaluate(()=>window.vault.list())).value.find(x=>x.id===n.id).createdAt,created);assert.deepEqual(errors,[]);
 console.log('PASS: 无前置步骤的文字/截图/PDF粘贴、拖放、输入发送、输入法安全、搜索粘贴隔离、编辑中全局收藏、撤销、失败重试、并发粘贴、备份、重启、三种窗口尺寸、减少动效');
 }catch(e){if(page)await page.screenshot({path:path.join(root,'assets/test-failure.png')}).catch(()=>{});throw e;}finally{if(app)await app.close().catch(()=>{});fs.rmSync(data,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
