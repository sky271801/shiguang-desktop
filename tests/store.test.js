const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Store } = require('../store');
const AdmZip = require('adm-zip');
function fixture(t) { const root=fs.mkdtempSync(path.join(os.tmpdir(),'shiguang-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root; }
test('保存、修改、重启、回收站恢复均保留原始时间和附件', t=>{
 const root=fixture(t),s=new Store(root),img=s.addImage(Buffer.from('fake-image')),file=s.addFile(Buffer.from('%PDF sample'),'分析.pdf');
 const n=s.save({title:'收藏',text:'测试正文',tags:['数学','数学'],images:[img],files:[file]});
 const m=s.save({...n,text:'修改后的正文'});
 assert.equal(n.createdAt,m.createdAt);assert.ok(m.updatedAt>=n.updatedAt);assert.deepEqual(m.tags,['数学']);
 s.action(n.id,'trash');assert.ok(s.list()[0].deletedAt);s.action(n.id,'restore');s.action(n.id,'star');
 const reopened=new Store(root);assert.equal(reopened.list()[0].text,'修改后的正文');assert.ok(reopened.list()[0].starred);assert.equal(reopened.list()[0].files[0].name,'分析.pdf');
 assert.throws(()=>s.action(n.id,'delete'));s.action(n.id,'trash');s.action(n.id,'delete');assert.equal(s.list().length,0);
});
test('完整备份可恢复文字、图片、PDF与时间，重复导入跳过，冲突保留两份',t=>{
 const root=fixture(t),s=new Store(path.join(root,'one'));
 const img=s.addImage(Buffer.from('some image'));const file=s.addFile(Buffer.from('%PDF-1.7'),'高等代数.pdf');
 const n=s.save({title:'资料',text:'记住这些',tags:['课程'],images:[img],files:[file]});
 const backup=path.join(root,'test.zip');s.exportTo(backup);
 const other=new Store(path.join(root,'two'));assert.equal(other.importFrom(backup),1);assert.deepEqual(other.list(),s.list());assert.equal(other.importFrom(backup),0);
 assert.equal(fs.readFileSync(path.join(other.files,file.key),'utf8'),'%PDF-1.7');assert.equal(fs.readFileSync(path.join(other.media,img),'utf8'),'some image');
 other.save({...n,text:'另一处修改'});assert.equal(other.importFrom(backup),1);assert.equal(other.list().length,2);
});
test('损坏的主库可从备份恢复，不覆盖损坏证据',t=>{
 const root=fixture(t),s=new Store(root);s.save({text:'第一条'});s.save({text:'第二条'});fs.writeFileSync(s.file,'bad json');
 const recovered=new Store(root);assert.ok(recovered.recovered);assert.equal(recovered.list()[0].text,'第一条');assert.ok(fs.readdirSync(root).some(x=>x.includes('.damaged-')));
});
test('拒绝路径穿越、损坏附件的备份，失败时不改变原有内容',t=>{
 const root=fixture(t),s=new Store(root);const n=s.save({text:'保留我'});const before=s.list();
 const zip=new AdmZip();zip.addFile('library.json',Buffer.from(JSON.stringify({version:1,notes:[{...n,images:['../../escape.png']}]})));const file=path.join(root,'bad.zip');zip.writeZip(file);
 assert.throws(()=>s.importFrom(file));assert.deepEqual(s.list(),before);
 assert.throws(()=>s.save({...n,images:['../../escape.png']}));assert.deepEqual(s.list(),before);
 const f=s.addFile(Buffer.from('abc'),'ok.pdf');const zip2=new AdmZip();zip2.addFile('library.json',Buffer.from(JSON.stringify({version:1,notes:[{...n,files:[f]}]})));zip2.addFile('files/'+f.key,Buffer.from('wrong'));zip2.writeZip(file);assert.throws(()=>s.importFrom(file));assert.deepEqual(s.list(),before);
});
test('EXDEV 环境仍可连续保存、修改和导出备份，重启后内容完整',t=>{
 const root=fixture(t),s=new Store(root);
 t.mock.method(fs,'renameSync',()=>{throw Object.assign(new Error('cross-device rename'),{code:'EXDEV'});});
 const n=s.save({text:'直接粘贴的文字'});s.save({...n,text:'修改后的收藏'});s.save({text:'第二条文字'});
 assert.equal(fs.existsSync(s.file+'.tmp'),false);
 assert.equal(JSON.parse(fs.readFileSync(s.file,'utf8')).notes.length,2);
 const backup=path.join(root,'backup.zip');s.exportTo(backup);
 const restored=new Store(path.join(root,'restored'));restored.importFrom(backup);
 assert.deepEqual(restored.list(),s.list());assert.deepEqual(new Store(root).list(),s.list());
});
test('兼容写入中途失败保留完整临时文件，下次启动恢复而非丢失内容',t=>{
 const root=fixture(t),s=new Store(root);s.save({text:'已保存'});const originalCopy=fs.copyFileSync;
 t.mock.method(fs,'renameSync',()=>{throw Object.assign(new Error('EXDEV'),{code:'EXDEV'});});
 t.mock.method(fs,'copyFileSync',(source,destination,...args)=>{
   if(source===s.file+'.tmp'&&destination===s.file){fs.writeFileSync(destination,'{');throw Object.assign(new Error('disk full'),{code:'ENOSPC'});}
   return originalCopy(source,destination,...args);
 });
 assert.throws(()=>s.save({text:'未完成的粘贴'}),{code:'ENOSPC'});assert.equal(s.list().length,1);assert.ok(fs.existsSync(s.file+'.tmp'));
 t.mock.restoreAll();
 t.mock.method(fs,'renameSync',()=>{throw Object.assign(new Error('EXDEV'),{code:'EXDEV'});});
 const recovered=new Store(root);assert.ok(recovered.recoveredPending);assert.deepEqual(recovered.list().map(n=>n.text),['已保存','未完成的粘贴']);assert.equal(new Store(root).list().length,2);
});
test('旧版首次保存失败留下的 .tmp 可自动恢复，时间不变',t=>{
 const root=fixture(t),source=new Store(path.join(root,'source')),note=source.save({text:'旧版未保存的文字'});
 const recoveredRoot=path.join(root,'old-version');fs.mkdirSync(recoveredRoot);
 fs.copyFileSync(source.file,path.join(recoveredRoot,'library.json.tmp'));
 const recovered=new Store(recoveredRoot);assert.ok(recovered.recoveredPending);assert.deepEqual(recovered.list(),[note]);assert.ok(fs.existsSync(recovered.file));
});
test('权限错误不会伪报保存成功或擅自降级写入',t=>{
 const root=fixture(t),s=new Store(root);s.save({text:'原有内容'});const before=s.list();
 t.mock.method(fs,'renameSync',()=>{throw Object.assign(new Error('permission denied'),{code:'EACCES'});});
 assert.throws(()=>s.save({text:'应报告失败'}),{code:'EACCES'});assert.deepEqual(s.list(),before);assert.deepEqual(JSON.parse(fs.readFileSync(s.file,'utf8')).notes,before);
});
test('实际 AppData 目录里文字保存与重启读取正常', {skip:process.platform!=='win32'}, t=>{
 const base=path.join(process.env.APPDATA,'Shiguang','collection');fs.mkdirSync(base,{recursive:true});
 const root=fs.mkdtempSync(path.join(base,'.regression-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const s=new Store(root),note=s.save({text:'实际数据目录的保存验证'});assert.deepEqual(new Store(root).list(),[note]);
});
