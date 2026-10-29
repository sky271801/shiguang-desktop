const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { StorageManager } = require('../storage-manager');
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'shiguang-move-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('迁移全部记录、附件、回收站和时间，重启使用新位置并保留原始副本',async t=>{
 const root=fixture(t),profile=path.join(root,'profile'),parent=path.join(root,'new');fs.mkdirSync(parent);
 const manager=new StorageManager(profile),oldRoot=manager.store.root;
 const image=manager.store.addImage(Buffer.from('image bytes'));const file=manager.store.addFile(Buffer.from('%PDF test'),'资料.pdf');
 const n=manager.store.save({text:'搬家不丢内容',images:[image],files:[file],tags:['数学']});manager.store.action(n.id,'trash');const before=manager.store.list();
 const progress=[];const result=await manager.migrateTo(parent,p=>progress.push(p));
 assert.deepEqual(manager.store.list(),before);assert.equal(result.path,path.join(parent,'拾光收藏库'));assert.ok(progress.length>0);assert.ok(fs.existsSync(path.join(oldRoot,'library.json')));
 assert.deepEqual(new StorageManager(profile).store.list(),before);assert.equal(new StorageManager(profile).store.root,result.path);
 assert.equal(fs.readFileSync(path.join(result.path,'images',image),'utf8'),'image bytes');assert.equal(fs.readFileSync(path.join(result.path,'files',file.key),'utf8'),'%PDF test');
 manager.store.save({text:'新位置继续收藏'});assert.equal(new StorageManager(profile).store.list().length,2);
 assert.equal(JSON.parse(fs.readFileSync(path.join(oldRoot,'library.json'))).notes.length,1);
});
test('拒绝内部位置和已存在的目标，绝不覆盖目标内容',async t=>{
 const root=fixture(t),manager=new StorageManager(path.join(root,'profile'));
 await assert.rejects(manager.migrateTo(manager.store.root),/内部目录/);
 const parent=path.join(root,'target');fs.mkdirSync(path.join(parent,'拾光收藏库'),{recursive:true});fs.writeFileSync(path.join(parent,'拾光收藏库','keep'),'保留');
 await assert.rejects(manager.migrateTo(parent),/已存在/);assert.equal(fs.readFileSync(path.join(parent,'拾光收藏库','keep'),'utf8'),'保留');assert.equal(manager.busy,false);
});
test('空收藏库可以迁移，选择位置的设置损坏时回到原库备份',async t=>{
 const root=fixture(t),profile=path.join(root,'profile'),manager=new StorageManager(profile),parent=path.join(root,'new');fs.mkdirSync(parent);
 // Give the empty source a durable index, just like a previously used library.
 manager.store.commit(manager.store.state);const original=manager.store.root;
 await manager.migrateTo(parent);assert.equal(new StorageManager(profile).store.list().length,0);
 fs.writeFileSync(manager.settingsFile,'bad json');assert.equal(new StorageManager(profile).store.root,original);
});
test('迁移复制失败时保留原库且不切换设置，未连接磁盘不能默默显示空库',async t=>{
 const root=fixture(t),manager=new StorageManager(path.join(root,'profile')),parent=path.join(root,'new');fs.mkdirSync(parent);
 manager.store.save({text:'必须保留'});const source=manager.store.root;
 const link=path.join(source,'unsupported-link');fs.symlinkSync(path.join(root,'profile'),link,'junction');
 await assert.rejects(manager.migrateTo(parent),/链接目录/);assert.equal(manager.store.root,source);assert.equal(manager.store.list()[0].text,'必须保留');assert.equal(fs.existsSync(manager.settingsFile),false);
 fs.unlinkSync(link);
 fs.writeFileSync(manager.settingsFile,JSON.stringify({collectionPath:path.join(root,'missing-disk')}));assert.throws(()=>new StorageManager(manager.profile),/找不到收藏库/);
});
test('复制流中途失败会撤回新目录，原内容和数据位置保持不变',async t=>{
 const root=fixture(t),manager=new StorageManager(path.join(root,'profile')),parent=path.join(root,'new');fs.mkdirSync(parent);
 manager.store.save({text:'迁移失败也不能丢失'});const source=manager.store.root;
 t.mock.method(fs,'createWriteStream',()=>{throw new Error('模拟目标磁盘写入失败');});
 await assert.rejects(manager.migrateTo(parent),/目标磁盘写入失败/);
 assert.equal(manager.store.root,source);assert.equal(manager.store.list().length,1);assert.equal(fs.existsSync(manager.settingsFile),false);assert.equal(fs.existsSync(path.join(parent,'拾光收藏库')),false);
});
