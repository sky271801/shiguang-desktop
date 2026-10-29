const {_electron}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sg-actions-'));let app;
 try{
  app=await _electron.launch({args:[process.cwd()],env:{...process.env,SHIGUANG_TEST_DATA:data,SHIGUANG_NO_TRAY:'1'}});const p=await app.firstWindow();await p.waitForSelector('#quickText');
  const bytes=[...fs.readFileSync('assets/icon.png')];await p.evaluate(async bytes=>{const image=(await window.vault.addImage(new Uint8Array(bytes))).value;for(let i=0;i<12;i++)await window.vault.save({images:[image]});},bytes);
  await p.reload();await p.waitForSelector('.card-actions');await p.waitForFunction(()=>[...document.querySelectorAll('.card-image img')].every(i=>i.complete));
  // Position a footer inside the transparent padding above the fixed composer.
  await p.evaluate(()=>{
   const button=document.querySelectorAll('[data-action="star"]')[3];
   const rect=button.getBoundingClientRect(),dock=document.querySelector('.capture-dock').getBoundingClientRect();
   window.scrollBy(0,rect.y+rect.height/2-dock.y-7);
  });
  const hit=await p.locator('[data-action="star"]').nth(3).evaluate(button=>{const r=button.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);return {x,y,hit:top?.closest('button')===button,top:top?.className,viewport:innerHeight};});console.log('footer hit',hit);
  assert.ok(hit.hit,'Transparent composer padding intercepts card button clicks');
  await p.mouse.click(hit.x,hit.y);await p.waitForFunction(()=>document.querySelectorAll('.starred').length===1);
  const card=p.locator('.card').nth(3),id=await card.getAttribute('data-id');
  await card.locator('[data-action="copy"]').click();await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('图片已复制'));
  const clipboard=await app.evaluate(async({clipboard})=>(await clipboard.read()).flatMap(item=>item.types));assert.ok(clipboard.includes('image/png'));
  await card.locator('[data-action="trash"]').click();await p.waitForFunction(()=>document.querySelectorAll('.card').length===11);assert.equal(await p.locator('dialog[open]').count(),0);
  const note=(await p.evaluate(()=>window.vault.list())).value.find(n=>n.id===id);assert.ok(note.deletedAt);
  await p.locator('#quickText').fill('输入区按钮仍可使用');await p.locator('#quickSend').click();await p.waitForFunction(()=>document.querySelectorAll('.card').length===12);
  console.log('PASS: 底部透明区域内真实鼠标点击星标、复制图片、回收站，均不误打开卡片');
 }finally{if(app)await app.close().catch(()=>{});fs.rmSync(data,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
