const {_electron}=require('../node_modules/@playwright/test');
const {Resvg}=require('../node_modules/@resvg/resvg-js');
const fs=require('fs'),path=require('path'),os=require('os');
(async()=>{
 const publicDir=path.join(__dirname,'public');fs.mkdirSync(publicDir,{recursive:true});
 fs.copyFileSync(path.join(__dirname,'../assets/brand.svg'),path.join(publicDir,'brand.svg'));
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><rect width="1200" height="720" fill="#eef2ff"/><g stroke="#d6dff7" stroke-width="1">${Array.from({length:25},(_,i)=>`<path d="M${i*50} 0v720"/>`).join('')}${Array.from({length:15},(_,i)=>`<path d="M0 ${i*50}h1200"/>`).join('')}</g><text x="70" y="95" font-family="Microsoft YaHei UI" font-size="34" fill="#4263eb">LINEAR ALGEBRA / 线性代数</text><text x="70" y="175" font-family="Microsoft YaHei UI" font-size="56" font-weight="bold" fill="#25304c">把抽象，变成看得见的几何。</text><path d="M240 550h650M340 650V250" stroke="#8898bc" stroke-width="3"/><path d="m340 550 310-180 170 70-310 180Z" fill="#4263eb30" stroke="#4263eb" stroke-width="4"/><path d="M340 550 650 370M340 550l170 70" stroke="#4263eb" stroke-width="7"/><circle cx="650" cy="370" r="10" fill="#4263eb"/><circle cx="510" cy="620" r="10" fill="#f09372"/><text x="885" y="565" font-family="Arial" font-size="27" fill="#5c709e">x</text><text x="320" y="235" font-family="Arial" font-size="27" fill="#5c709e">y</text></svg>`;
 const diagram=new Resvg(svg).render().asPng();fs.writeFileSync(path.join(publicDir,'diagram.png'),diagram);
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'sg-promo-assets-'));let app;
 try{
  app=await _electron.launch({args:[path.resolve(__dirname,'..')],env:{...process.env,SHIGUANG_TEST_DATA:data,SHIGUANG_NO_TRAY:'1'}});
  const page=await app.firstWindow();await page.waitForSelector('#quickText');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,900));
  const shot=async name=>{await page.evaluate(()=>{document.activeElement.blur();document.querySelector('#toast').classList.remove('visible');scrollTo(0,0);});await page.waitForTimeout(400);await page.screenshot({path:path.join(publicDir,name+'.png')});};
  await shot('app-empty');
  await page.evaluate(()=>window.vault.copy({text:'证明思路：先判断单调性，再用有界性得到收敛。\n回头复习时，别忘了检查使用条件。'}));await page.keyboard.press('Control+v');await page.waitForSelector('.card');await shot('app-text');await page.locator('.card').screenshot({path:path.join(publicDir,'card-note.png')});
  await page.evaluate(async bytes=>{const image=(await window.vault.addImage(new Uint8Array(bytes))).value;await window.vault.save({title:'线性变换的几何意义',images:[image],tags:['数学','复习']});},[...diagram]);
  await page.evaluate(async()=>{const file=(await window.vault.addFile(new TextEncoder().encode('%PDF-1.7\nPromotional demo file'),'数学分析·课程讲义.pdf')).value;await window.vault.save({title:'数学分析 · 课程讲义',text:'下次复习要用的资料。',files:[file],tags:['数学','资料']});await window.vault.save({title:'下次想读的文章',text:'整理与记忆：让每份内容都能再次找到。\nhttps://example.com/reading',tags:['阅读']});});
  await page.reload();await page.waitForSelector('.card');await shot('app-library');
  await page.locator('#search').fill('数学');await shot('app-search');
  await page.locator('#search').fill('');await page.locator('[data-tag="数学"]').click();await shot('app-tag');
  console.log('Saved isolated demo screenshots; real user library untouched');
 }finally{if(app)await app.close().catch(()=>{});fs.rmSync(data,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
