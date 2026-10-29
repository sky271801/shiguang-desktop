const { app, BrowserWindow, ipcMain, protocol, net, clipboard, ClipboardItem, nativeImage, dialog, shell, globalShortcut, Tray, Menu } = require('electron');
const {spawn,execFile}=require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { Store, IMAGE, FILE } = require('./store');
const { StorageManager } = require('./storage-manager');
const {getStartup,setStartup}=require('./startup');
const testData = process.env.SHIGUANG_TEST_DATA;
app.setPath('userData', testData || path.join(app.getPath('appData'), 'Shiguang'));
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let win, store, storage, tray, startupReady, openingWindow, suspendTimer, lastBounds, quitting = false, shortcutReady = false;
const thumbnailJobs=new Map();
let thumbnailQueue=Promise.resolve();
const quietStart=process.argv.includes('--autostart');
const helperPath=()=>path.join(path.dirname(process.execPath),'拾光托盘.exe');
function stopLightTray(){return new Promise(resolve=>{if(!app.isPackaged||!fs.existsSync(helperPath()))return resolve();execFile(helperPath(),['--stop'],{windowsHide:true,timeout:4000},()=>resolve());});}
function startLightTray(){return new Promise(resolve=>{
  const child=spawn(helperPath(),['--handoff'],{windowsHide:true,stdio:['ignore','pipe','ignore']});let done=false;
  const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);if(ok){child.stdout.destroy();child.unref();}resolve(ok);};
  const timeout=setTimeout(()=>finish(false),4000);
  child.stdout.on('data',data=>{if(data.toString().includes('READY'))finish(true);});child.on('error',()=>finish(false));child.on('exit',()=>finish(false));
});}
function ensureLibrary(){if(!storage){storage=new StorageManager(app.getPath('userData'));store=storage.store;}}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event,args) => {if(args.includes('--capture'))void capture();else void show();});
  startupReady=app.whenReady().then(async () => {
    protocol.handle('app', async req => {
      const url = new URL(req.url);
      let file;
      if (url.hostname === 'bundle' && ['/brand.svg'].includes(url.pathname)) file = path.join(__dirname, 'assets', 'brand.svg');
      else if (url.hostname === 'bundle' && ['/', '/index.html', '/app.js', '/style.css'].includes(url.pathname)) file = path.join(__dirname, 'ui', url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
      else if (url.hostname === 'thumb' && IMAGE.test(url.pathname.slice(1))) {
        const name=url.pathname.slice(1),file=await thumbnail(name);return net.fetch(pathToFileURL(file).toString());
      }
      else if (url.hostname === 'media' && IMAGE.test(url.pathname.slice(1))) file = path.join(store.media, url.pathname.slice(1));
      else return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });
    function handle(name, fn) {
      ipcMain.handle(name, async (event, ...args) => {
        if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !event.senderFrame.url.startsWith('app://bundle/')) throw new Error('访问被拒绝');
        try {
          ensureLibrary();
          if (storage.busy && !['notes:list','app:info'].includes(name)) throw new Error('正在迁移收藏库，请稍候再操作');
          return { ok: true, value: await fn(...args) };
        } catch(e) { return { ok: false, error: e.message }; }
      });
    }
    const putImage = data => {
      if (storage.busy) throw new Error('正在迁移收藏库，请稍候再添加图片');
      const bytes = Buffer.from(data);
      if (bytes.length > 40 * 1024 * 1024) throw new Error('单张图片不能超过 40 MB');
      const image = nativeImage.createFromBuffer(bytes);
      if (image.isEmpty()) throw new Error('无法读取这张图片，请使用 PNG、JPG、WebP 或 GIF');
      const size = image.getSize();
      if (size.width * size.height > 50000000) throw new Error('图片尺寸过大');
      const ext = bytes.subarray(0,6).toString() === 'GIF89a' || bytes.subarray(0,6).toString() === 'GIF87a' ? 'gif' : 'png';
      return store.addImage(ext === 'gif' ? bytes : image.toPNG(), ext);
    };
    handle('notes:list', () => store.list());
    handle('notes:save', input => store.save(input));
    handle('notes:action', (id, action) => store.action(id, action));
    handle('images:add', putImage);
    handle('files:add', (bytes, name) => store.addFile(Buffer.from(bytes), name));
    handle('files:pick', async () => {
      const result = await dialog.showOpenDialog(win, { title: '收藏文件', properties: ['openFile', 'multiSelections'] });
      if (result.canceled) return [];
      if (result.filePaths.length > 30) throw new Error('一次最多选择 30 个文件');
      return result.filePaths.map(file => { if (fs.statSync(file).size > 100 * 1024 * 1024) throw new Error('单个文件不能超过 100 MB'); return store.addFile(fs.readFileSync(file), path.basename(file)); });
    });
    function findFile(key) { if (!FILE.test(key)) throw new Error('无效文件'); const f = store.state.notes.flatMap(n => n.files || []).find(f => f.key === key); if (!f) throw new Error('请先保存收藏，再打开附件'); return f; }
    handle('files:open', async key => {
      const f = findFile(key);
      const safeName = path.basename(f.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      const folder = path.join(app.getPath('userData'), 'opened', key.slice(0,16));
      fs.mkdirSync(folder, { recursive: true });
      const dest = path.join(folder, safeName);
      fs.copyFileSync(path.join(store.files, key), dest);
      if (!/\.(pdf|txt|md|docx?|xlsx?|pptx?|csv|rtf|odt|ods|odp|mp3|mp4|wav|flac|m4a|mov)$/i.test(safeName)) { shell.showItemInFolder(dest); return 'folder'; }
      const error = await shell.openPath(dest); if (error) throw new Error('无法打开，请安装相应程序或另存文件后打开。'); return 'opened';
    });
    handle('files:save', async key => {
      const f = findFile(key);
      const result = await dialog.showSaveDialog(win, { defaultPath: path.basename(f.name) });
      if (result.canceled) return false;
      fs.copyFileSync(path.join(store.files, key), result.filePath); return true;
    });
    handle('images:pick', async () => {
      const result = await dialog.showOpenDialog(win, { title: '收藏图片', properties: ['openFile', 'multiSelections'], filters: [{ name: '图片', extensions: ['png','jpg','jpeg','webp','gif','bmp'] }] });
      if (result.canceled) return [];
      if (result.filePaths.length > 30) throw new Error('一次最多选择 30 张图片');
      return result.filePaths.map(file => { if (fs.statSync(file).size > 40 * 1024 * 1024) throw new Error('单张图片不能超过 40 MB'); return putImage(fs.readFileSync(file)); });
    });
    handle('clipboard:read', async () => {
      const items = await clipboard.read();
      let text = ''; const images = [], files = [], paths = [];
      for (const item of items) {
        if (item.types.includes('text/uri-list')) {
          const uris = await (await item.getType('text/uri-list')).text();
          for (const uri of uris.split(/\r?\n/).filter(x => x && !x.startsWith('#'))) {
            const url = new URL(uri);
            if (url.protocol === 'file:') paths.push(fileURLToPath(url));
          }
        }
        if (item.types.includes('text/plain')) text += await (await item.getType('text/plain')).text();
        const mime = item.types.find(t => ['image/png','image/jpeg','image/webp','image/gif','image/bmp'].includes(t));
        if (mime && images.length < 30) images.push(putImage(Buffer.from(await (await item.getType(mime)).arrayBuffer())));
      }
      if (paths.length > 30) throw new Error('一次最多收藏 30 个文件，请分批粘贴');
      if (storage.busy) throw new Error('正在迁移收藏库，请稍候再粘贴');
      for (const file of new Set(paths)) {
        const stat = fs.statSync(file);
        if (!stat.isFile()) throw new Error('暂不支持收藏整个文件夹，请选择文件');
        if (stat.size > 100 * 1024 * 1024) throw new Error(path.basename(file) + ' 超过 100 MB');
        if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(file)) images.push(putImage(fs.readFileSync(file)));
        else files.push(store.addFile(fs.readFileSync(file), path.basename(file)));
      }
      return { text: paths.length ? '' : text, images: [...new Set(images)], files };
    });
    handle('clipboard:write', async note => {
      if (note.image && IMAGE.test(note.image) && fs.existsSync(path.join(store.media, note.image))) {
        const png = nativeImage.createFromPath(path.join(store.media, note.image)).toPNG();
        await clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })]);
      } else await clipboard.writeText(String(note.text || ''));
    });
    handle('backup:export', async () => {
      const result = await dialog.showSaveDialog(win, { defaultPath: '拾光备份-' + new Date().toISOString().slice(0,10) + '.shiguang.zip', filters: [{ name: '拾光备份', extensions: ['zip'] }] });
      if (result.canceled) return null;
      store.exportTo(result.filePath); return result.filePath;
    });
    handle('backup:import', async () => {
      const result = await dialog.showOpenDialog(win, { title: '合并导入拾光备份（保留现有收藏）', properties: ['openFile'], filters: [{ name: '拾光备份', extensions: ['zip'] }] });
      if (result.canceled) return null;
      return store.importFrom(result.filePaths[0]);
    });
    handle('app:info', () => ({ path: store.root, version: app.getVersion(), shortcut: shortcutReady, recovered: !!store.recovered, recoveredPending: !!store.recoveredPending }));
    handle('startup:get',()=>getStartup(app.getPath('userData')));
    handle('startup:set',async enabled=>{
      if(testData)return {enabled:!!enabled,delay:45,simulated:true};
      if(!app.isPackaged)throw new Error('请在正式 EXE 中设置开机启动');
      return setStartup(app.getPath('userData'),helperPath(),!!enabled);
    });
    handle('app:folder', () => shell.openPath(store.root));
    handle('storage:change', async () => {
      const result = await dialog.showOpenDialog(win, { title: '选择新的数据位置（将在其中创建「拾光收藏库」）', properties: ['openDirectory', 'createDirectory'] });
      if (result.canceled) return null;
      const migrated = await storage.migrateTo(result.filePaths[0], value => win.webContents.send('storage-progress', value));
      store = storage.store;
      return migrated;
    });
    handle('app:quit', () => { quitting = true; setTimeout(() => app.quit(), 100); });
    handle('link:open', async value => { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) throw new Error('仅支持打开网页链接'); await shell.openExternal(url.href); });
    await stopLightTray();
    if (!process.env.SHIGUANG_NO_TRAY) {
      tray = new Tray(path.join(__dirname, 'assets/icon.png'));
      tray.setToolTip('拾光 · 随手存，好好找');
      tray.setContextMenu(Menu.buildFromTemplate([{ label: '打开拾光', click: show }, { label: '收藏剪贴板', click: capture }, { type: 'separator' }, { label: '退出拾光', click: () => { quitting = true; app.quit(); } }]));
      tray.on('double-click', show);
      tray.on('click', show);
      shortcutReady = globalShortcut.register('CommandOrControl+Alt+S', capture);
    }
    if(process.argv.includes('--capture'))void capture();else if(!quietStart||!tray)void show();
    if(testData&&process.env.SHIGUANG_BOOT_REPORT){
      setTimeout(()=>{
        const metrics=app.getAppMetrics();
        fs.writeFileSync(path.join(testData,'boot-report.json'),JSON.stringify({windows:BrowserWindow.getAllWindows().length,renderer:metrics.filter(m=>m.type==='Tab').length,workingSetMB:Math.round(metrics.reduce((sum,m)=>sum+m.memory.workingSetSize,0)/1024),libraryLoaded:!!storage}));
        app.quit();
      },1500);
    }
  }).catch(e => { dialog.showErrorBox('拾光启动失败', e.stack || e.message); app.quit(); });
}
async function createWindow(){
  if(openingWindow)return openingWindow;
  openingWindow=(async()=>{
    ensureLibrary();
    const current=new BrowserWindow({width:1280,height:850,...lastBounds,minWidth:940,minHeight:640,show:false,title:'拾光 · 我的收藏',backgroundColor:'#f7f8fb',icon:path.join(__dirname,'assets/icon.png'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
    win=current;
    current.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    current.webContents.on('will-navigate',event=>event.preventDefault());
    current.webContents.session.setPermissionRequestHandler((_wc,_p,cb)=>cb(false));
    current.on('close',event=>{if(!quitting&&tray){event.preventDefault();lastBounds=current.getBounds();current.hide();scheduleSuspend(current);}});
    current.on('closed',()=>{if(win===current)win=null;});
    await current.loadURL('app://bundle/index.html');return current;
  })();
  try{return await openingWindow;}finally{openingWindow=null;}
}
async function show(){
  try{
    await startupReady;if(quitting)return;
    clearTimeout(suspendTimer);
    const current=win||await createWindow();
    if(current.isMinimized())current.restore();current.show();current.focus();current.webContents.send('focus-input');return current;
  }catch(e){dialog.showErrorBox('拾光启动失败',e.message);}
}
async function capture(){const current=await show();current?.webContents.send('capture');}
function scheduleSuspend(current){
  clearTimeout(suspendTimer);
  const delay=testData?Number(process.env.SHIGUANG_SUSPEND_MS||60000):60000;
  suspendTimer=setTimeout(async()=>{
    if(current.isDestroyed()||current.isVisible()||storage?.busy)return;
    try{
      const safe=await current.webContents.executeJavaScript(`Boolean(!document.querySelector('dialog[open]')&&!document.querySelector('#quickText').value.trim()&&!pendingQuick&&!pendingAttachments&&!failedCaptures.length&&!migratingStorage)`);
      if(!current.isDestroyed()&&!current.isVisible()&&safe){
        if(app.isPackaged&&fs.existsSync(helperPath())){
          const handedOff=await startLightTray();
          if(current.isVisible()){await stopLightTray();return;}
          if(handedOff){quitting=true;app.quit();return;}
        }
        current.destroy();store=null;storage=null;
      }
      else if(!current.isDestroyed()&&!current.isVisible())scheduleSuspend(current);
    }catch{/* A partially loaded or busy window is kept intact. */}
  },Math.max(200,delay));suspendTimer.unref();
}
async function thumbnail(name){
  ensureLibrary();
  const source=path.join(store.media,name);
  const folder=path.join(app.getPath('userData'),'cache','thumbnails-v1');
  const file=path.join(folder,name+'.png');
  if(fs.existsSync(file))return file;
  if(!thumbnailJobs.has(name)){
    const job=thumbnailQueue.then(async()=>{
    fs.mkdirSync(folder,{recursive:true});
    // Decode asynchronously off the renderer; grid previews use a bounded texture.
    const header=Buffer.alloc(32),fd=fs.openSync(source,'r');
    try{fs.readSync(fd,header,0,32,0);}finally{fs.closeSync(fd);}
    let original;
    if(header.subarray(1,4).toString()==='PNG')original={width:header.readUInt32BE(16),height:header.readUInt32BE(20)};
    else if(header.subarray(0,3).toString()==='GIF')original={width:header.readUInt16LE(6),height:header.readUInt16LE(8)};
    else original=nativeImage.createFromPath(source).getSize();
    if(!original.width||!original.height)return source;
    const targetWidth=Math.max(1,Math.min(original.width,600,Math.floor(original.width*300/original.height)));
    let preview=await nativeImage.createThumbnailFromPath(source,{width:targetWidth,height:300});
    if(preview.isEmpty())return source;
    const {width,height}=preview.getSize();
    if(width>targetWidth)preview=preview.resize({width:targetWidth});
    fs.writeFileSync(file,preview.toPNG());return file;
    });
    thumbnailQueue=job.catch(()=>{});thumbnailJobs.set(name,job.finally(()=>thumbnailJobs.delete(name)));
  }
  return thumbnailJobs.get(name);
}
app.on('before-quit', event => { if(storage?.busy){event.preventDefault();quitting=false;show();return;}quitting = true; clearTimeout(suspendTimer); });
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => {if(!tray)app.quit();});
