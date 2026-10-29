const $ = s => document.querySelector(s);
const icons = {
 lock:'<rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
 chevron:'<path d="m9 5 7 7-7 7"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 send:'<path d="m4 4 17 8-17 8 3-8-3-8ZM7 12h14"/>',
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
 clipboard:'<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
 text:'<path d="M5 5h14M12 5v15M8 20h8M5 5v3M19 5v3"/>',
 link:'<path d="m10 13 4-4M8 15l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 9l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(0 -1) scale(.94)"/>',
 star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
 trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
 tag:'<path d="m3 3 8 .1L21 13l-8 8L3 11V3Z"/><circle cx="7.5" cy="7.5" r="1"/>',
 settings:'<path d="m10 3-1 3-3 1-3 3 2 2-1 4 3 1 2 4h4l1-3 4-1 3-4-2-2 1-4-3-1-2-3h-5Z"/><circle cx="12" cy="12" r="3"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', x:'<path d="m6 6 12 12M18 6 6 18"/>',
 sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 restore:'<path d="M3 10a9 9 0 1 1 1 8M3 4v6h6M12 7v6l4 2"/>',
 file:'<path d="M14 2H5v20h14V7l-5-5ZM14 2v6h5M8 13h8M8 17h6"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
function hydrate() { document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); el.removeAttribute('data-icon'); }); }

const closingDialogs=new WeakMap();
const reducedMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const modalScrim=document.createElement('div');
modalScrim.id='modalScrim';modalScrim.setAttribute('aria-hidden','true');document.body.append(modalScrim);
let scrimVisible=false,scrimAnimation;
function setScrimVisible(visible){
  if(scrimVisible===visible)return;
  scrimVisible=visible;
  const from=getComputedStyle(modalScrim).opacity;
  scrimAnimation?.cancel();
  modalScrim.style.opacity=visible?'1':'0';
  if(!reducedMotion())scrimAnimation=modalScrim.animate([{opacity:from},{opacity:visible?1:0}],{duration:visible?200:150,easing:visible?'cubic-bezier(.16,1,.3,1)':'cubic-bezier(.4,0,1,1)'});
}
function syncModalLock(){
  const visible=!!document.querySelector('dialog[open]');
  document.documentElement.classList.toggle('modal-open',visible);
  setScrimVisible(visible);
}
function openDialog(dialog){
  if(dialog.open)return;
  dialog.showModal();syncModalLock();
  if(!reducedMotion())dialog.animate([
    {opacity:0,transform:'translate3d(0,12px,0) scale(.985)'},
    {opacity:1,transform:'translate3d(0,0,0) scale(1)'}
  ],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});
}
async function closeDialog(dialog){
  if(!dialog.open)return;
  if(dialog.id==='settingsDialog'&&typeof migratingStorage!=='undefined'&&migratingStorage)return;
  if(closingDialogs.has(dialog))return closingDialogs.get(dialog);
  const task=(async()=>{
    dialog.classList.add('closing');
    if(document.querySelectorAll('dialog[open]').length===1)setScrimVisible(false);
    if(!reducedMotion())await dialog.animate([{opacity:1,transform:'translate3d(0,0,0) scale(1)'},{opacity:0,transform:'translate3d(0,6px,0) scale(.99)'}],{duration:160,easing:'cubic-bezier(.4,0,1,1)'}).finished.catch(()=>{});
    dialog.close();dialog.classList.remove('closing');syncModalLock();
  })();
  closingDialogs.set(dialog,task);try{await task;}finally{closingDialogs.delete(dialog);}
}
for(const dialog of document.querySelectorAll('dialog')){
  new MutationObserver(syncModalLock).observe(dialog,{attributes:true,attributeFilter:['open']});
  dialog.addEventListener('close',syncModalLock);
  if(!['editor','confirmDialog'].includes(dialog.id))dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog(dialog);});
}
document.addEventListener('wheel',event=>{
  const top=[...document.querySelectorAll('dialog[open]')].at(-1);
  if(top&&!top.contains(event.target))event.preventDefault();
},{passive:false});

const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let notes = [], view = 'all', type = 'all', tag = '', editing = null, draftImages = [], draftFiles = [], initialDraft = '', saving = false, pendingAttachments = false, toastTimer, gallery = [], galleryIndex = 0;
const date = (time, seconds = false) => new Date(time).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{}),hour12:false});
const size = n => n < 1024 ? n+' B' : n < 1048576 ? (n/1024).toFixed(1)+' KB' : (n/1048576).toFixed(1)+' MB';
const links = text => [...new Set(text.match(/https?:\/\/[^\s<>"'）。，、]+/g) || [])];
const kind = n => n.images.length ? 'image' : n.files?.length ? 'file' : links(n.text).length ? 'link' : 'text';
const title = n => n.title || n.text.split('\n').find(x=>x.trim())?.slice(0,60) || n.files?.[0]?.name || '图片收藏';
function toast(message, action) { const el=$('#toast');el.replaceChildren(document.createTextNode(message));if(action){const b=document.createElement('button');b.textContent=action.label;b.onclick=()=>guard(action.run);el.append(b);}el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.classList.remove('visible'),action?7000:3500); }
async function call(method, ...args) { const r = await window.vault[method](...args); if (!r.ok) throw new Error(r.error); return r.value; }
async function guard(fn) { try { return await fn(); } catch(e) { if(!e.captureHandled)toast(e.message || '操作失败，请重试'); } }
async function refresh() { notes = await call('list'); render(); }
let lastRenderKey='',visibleLimit=60;
const navs = [['all','layers','全部收藏'],['text','text','文字笔记'],['image','image','图片收藏'],['file','file','文件收藏'],['link','link','链接收藏'],['star','star','星标收藏'],['trash','trash','回收站']];
function matchKind(n,t) { return t==='all' || t==='image' && n.images.length>0 || t==='file' && n.files?.length>0 || t==='text' && !n.images.length && !n.files?.length && !links(n.text).length || t==='link' && links(n.text).length>0; }
function render() {
  const alive = notes.filter(n=>!n.deletedAt);
  $('#navigation').innerHTML = navs.map(([id,i,label])=>`<button class="nav-item ${view===id&&!tag?'active':''} ${id==='trash'?'trash':''}" ${view===id&&!tag?'aria-current="page"':''} data-view="${id}">${icon(i)}${label}<span class="count">${id==='trash'?notes.filter(n=>n.deletedAt).length:id==='star'?alive.filter(n=>n.starred).length:alive.filter(n=>matchKind(n,id)).length}</span></button>`).join('');
  const allTags = [...new Set(alive.flatMap(n=>n.tags))].sort((a,b)=>a.localeCompare(b,'zh'));
  $('#tagCount').textContent = allTags.length ? String(allTags.length).padStart(2,'0') : '';
  $('#tags').innerHTML = allTags.length ? allTags.map(t=>`<button class="${t===tag?'active':''}" data-tag="${esc(t)}"><span class="tag-hash">#</span>${esc(t)}<span class="tag-total">${alive.filter(n=>n.tags.includes(t)).length}</span></button>`).join('') : '<p class="no-tags">为收藏加个标签，<br>以后找起来更轻松。</p>';
  const label = tag ? '# '+tag : navs.find(n=>n[0]===view)[2];
  $('#breadcrumb').textContent=label;
  $('#pageTitle').innerHTML=esc(label)+'<span class="heading-dot">.</span>';
  $('#subtitle').textContent=view==='trash'?'删除的内容先放在这里，随时可以恢复。':'复制过来，就已经收好了。';

  $('#filters').style.visibility = ['all','star','trash'].includes(view)||tag?'visible':'hidden';
  const q = $('#search').value.toLowerCase().trim();
  let shown = notes.filter(n=>(view==='trash'?!!n.deletedAt:!n.deletedAt) && (tag?n.tags.includes(tag):view==='star'?n.starred:['trash','all'].includes(view)||matchKind(n,view)) && matchKind(n,type) && (!q || [n.title,n.text,...n.tags,...(n.files||[]).map(f=>f.name),date(n.createdAt)].join(' ').toLowerCase().includes(q)));
  const sort = $('#sort').value;
  shown.sort((a,b)=>sort==='old'?a.createdAt-b.createdAt:sort==='updated'?b.updatedAt-a.updatedAt:b.createdAt-a.createdAt);
  const renderKey=JSON.stringify([view,type,tag,q,sort]);
  if(renderKey!==lastRenderKey)visibleLimit=60;
  $('#loadMore').hidden=shown.length<=visibleLimit;
  $('#resultCount').textContent=`${shown.length} 条收藏`;
  $('#cards').innerHTML=shown.slice(0,visibleLimit).map(n=>{const k=kind(n);return `<article class="card ${n.images.length&&!n.title&&!n.text&&!n.files?.length&&!n.tags.length?'image-only':''}" tabindex="0" role="button" aria-label="打开 ${esc(title(n))}" data-id="${n.id}">${n.images.length?`<div class="card-image" role="button" tabindex="0" aria-label="查看完整图片"><img loading="lazy" src="app://thumb/${n.images[0]}" alt="${esc(title(n))}">${n.images.length>1?`<span class="image-count">${n.images.length} 张图片</span>`:''}</div>`:''}<div class="card-content"><div class="card-kind">${icon(k)}${{image:'IMAGE · 图片',text:'NOTE · 文字',link:'LINK · 链接',file:'FILE · 文件'}[k]}</div>${n.images.length&&!n.title&&!n.text&&!n.files?.length?'':`<h3>${esc(title(n))}</h3>`}${n.text?`<p class="card-text">${esc(n.text)}</p>`:''}${n.files?.length?`<div class="card-file">${icon('file')}<div>${esc(n.files[0].name)}<small>${size(n.files[0].size)}${n.files.length>1?' · 共 '+n.files.length+' 个文件':''}</small></div></div>`:''}<div class="card-tags">${n.tags.slice(0,4).map(t=>`<span class="tag-pill"># ${esc(t)}</span>`).join('')}</div><div class="card-foot"><time title="收藏：${date(n.createdAt,true)}&#10;修改：${date(n.updatedAt,true)}">${date(n.createdAt)}</time><div class="card-actions">${n.deletedAt?`<button data-action="restore" title="恢复">${icon('restore')}</button><button data-action="delete" title="永久删除">${icon('trash')}</button>`:`<button data-action="star" class="${n.starred?'starred':''}" title="${n.starred?'取消星标':'添加星标'}">${icon('star')}</button><button data-action="copy" title="复制内容">${icon('copy')}</button><button data-action="trash" title="移入回收站">${icon('trash')}</button>`}</div></div></div></article>`;}).join('');
  const empty = !shown.length;
  $('#empty').hidden=!empty;
  if (empty) {
    const first=!notes.length&&!q&&!tag&&view==='all';
    $('#empty h2').textContent=first?'粘贴一下，就收好了。':q?'没有找到匹配的收藏':view==='trash'?'回收站是空的':'把下一份灵感，放在这里';
    $('#empty p').innerHTML=first?'一段文字、一张截图、一份 PDF。<br>直接按 Ctrl + V，或把文件拖到这里。':q?'试试更短的关键词，或切换到全部收藏。':view==='trash'?'删除的内容会留在这里，直到你手动永久删除。':'直接粘贴或拖入内容，即刻保存。';
    $('#emptyAdd').hidden=view==='trash'||!!q;
  }
  if(renderKey!==lastRenderKey&&!reducedMotion()&&shown.length)$('#cards').animate([{opacity:.45,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.16,1,.3,1)'});
  lastRenderKey=renderKey;
}
function resetView(next, nextTag='') { view=next;tag=nextTag;type='all';$('#filters').querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.type==='all');b.setAttribute('aria-pressed',String(b.dataset.type==='all'));});render(); }
$('#navigation').onclick=e=>{const b=e.target.closest('[data-view]');if(b)resetView(b.dataset.view);};
$('#tags').onclick=e=>{const b=e.target.closest('[data-tag]');if(b)resetView('all',b.dataset.tag);};
$('#filters').onclick=e=>{const b=e.target.closest('[data-type]');if(!b)return;type=b.dataset.type;$('#filters').querySelectorAll('button').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});render();};
$('#search').oninput=render;$('#sort').onchange=render;
function draft() { return {id:editing?.id,title:$('#noteTitle').value,text:$('#noteText').value,tags:$('#noteTags').value.split(/[\s,，、#]+/).filter(Boolean),images:draftImages,files:draftFiles}; }
function openEditor(note=null, seed={}) {
  if ($('#editor').open) return;
  editing=note;draftImages=[...(note?.images||seed.images||[])];draftFiles=[...(note?.files||seed.files||[])];
  $('#noteTitle').value=note?.title||seed.title||'';$('#noteText').value=note?.text||seed.text||'';$('#noteTags').value=(note?.tags|| (tag?[tag]:[])).join(' ');
  $('#editorTitle').textContent=note?'查看与编辑':'新建收藏';
  $('#editHint').textContent=note?`收藏于 ${date(note.createdAt,true)}　｜　修改于 ${date(note.updatedAt,true)}`:'自动记录收藏时间；修改后保留原始收藏时间。';
  $('#suggestTags').innerHTML=[...new Set(notes.filter(n=>!n.deletedAt).flatMap(n=>n.tags))].slice(0,10).map(t=>`<button type="button" data-suggest="${esc(t)}"># ${esc(t)}</button>`).join('');
  renderAttachments();renderLinks();initialDraft=JSON.stringify(draft());openDialog($('#editor'));setTimeout(()=>$('#noteText').focus(),50);
}
function renderLinks() { $('#noteLinks').innerHTML=links($('#noteText').value).slice(0,10).map(l=>`<button type="button" data-url="${esc(l)}">↗ ${esc(l)}</button>`).join(''); }
$('#noteText').oninput=renderLinks;
$('#noteLinks').onclick=e=>{const b=e.target.closest('[data-url]');if(b)guard(()=>call('openLink',b.dataset.url));};
function renderAttachments() {
  $('#attachments').innerHTML=draftImages.map((name,i)=>`<div class="attachment"><img src="app://thumb/${name}" alt="附件图片 ${i+1}" data-preview="${i}"><button type="button" data-remove="${i}" title="移除图片">×</button></div>`).join('');
  $('#fileAttachments').innerHTML=draftFiles.map((f,i)=>`<div class="file-row">${icon('file')}<div class="file-info"><strong>${esc(f.name)}</strong><small>${size(f.size)}</small></div>${editing?.files?.some(x=>x.key===f.key)?`<button type="button" data-open-file="${i}" title="使用默认程序打开">打开 ↗</button><button type="button" data-save-file="${i}" title="另存为">另存</button>`:'<small>保存后可打开</small>'}<button type="button" data-remove-file="${i}" title="移除文件">×</button></div>`).join('');
}
$('#suggestTags').onclick=e=>{const b=e.target.closest('[data-suggest]');if(b){const tags=new Set(draft().tags);tags.add(b.dataset.suggest);$('#noteTags').value=[...tags].join(' ');}};
$('#attachments').onclick=e=>{const remove=e.target.closest('[data-remove]');if(remove){draftImages.splice(Number(remove.dataset.remove),1);renderAttachments();}else if(e.target.dataset.preview!==undefined)showGallery(draftImages,Number(e.target.dataset.preview));};
$('#fileAttachments').onclick=e=>guard(async()=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.removeFile!==undefined){draftFiles.splice(Number(b.dataset.removeFile),1);renderAttachments();}if(b.dataset.openFile!==undefined){const r=await call('openFile',draftFiles[Number(b.dataset.openFile)].key);toast(r==='folder'?'已在文件夹中显示，请选择程序打开':'已使用默认程序打开；编辑后如需保存到收藏，请重新添加文件');}if(b.dataset.saveFile!==undefined&&await call('saveFile',draftFiles[Number(b.dataset.saveFile)].key))toast('文件已另存');});
async function confirmAction(heading,text) { return new Promise(resolve=>{const d=$('#confirmDialog');$('#confirmTitle').textContent=heading;$('#confirmText').textContent=text;let done=false;const close=async v=>{if(done)return;done=true;await closeDialog(d);resolve(v);};$('#confirmYes').onclick=()=>close(true);$('#confirmNo').onclick=()=>close(false);d.oncancel=e=>{e.preventDefault();close(false);};openDialog(d);}); }
async function closeEditor() { if(saving||pendingAttachments)return;if(JSON.stringify(draft())!==initialDraft&&!await confirmAction('放弃本次修改？','尚未保存的内容将不会加入收藏库。'))return;await closeDialog($('#editor')); }
$('#closeEditor').onclick=closeEditor;$('#cancelEditor').onclick=closeEditor;$('#editor').oncancel=e=>{e.preventDefault();closeEditor();};
$('#editForm').onsubmit=e=>{e.preventDefault();guard(async()=>{if(saving||pendingAttachments)return;saving=true;$('#saveBtn').disabled=true;try{await call('save',draft());await closeDialog($('#editor'));await refresh();toast(editing?'修改已保存':'已收藏，时间也记下了');}finally{saving=false;$('#saveBtn').disabled=false;}});};
$('#newBtn').onclick=()=>openEditor();$('#emptyAdd').onclick=()=>guard(captureClipboard);
$('#addImages').onclick=()=>guard(async()=>{const picked=await call('pickImages');draftImages=[...new Set([...draftImages,...picked])].slice(0,30);renderAttachments();});
$('#addFiles').onclick=()=>guard(async()=>{draftFiles=[...draftFiles,...await call('pickFiles')].slice(0,30);renderAttachments();});
async function captureClipboard() {
  const data=await call('clipboard');
  if(!data.text&&!data.images.length&&!data.files?.length){toast('复制文字、截图或文件，再直接粘贴');return;}
  await quickSave(data);
}
$('#quickPaste').onclick=()=>guard(captureClipboard);window.vault.onCapture(()=>guard(captureClipboard));
let saveQueue=Promise.resolve(), pendingQuick=0, failedCaptures=[];
function setSendState(message,busy=false){$('#sendState').innerHTML=icon(busy?'bolt':'check')+esc(message);$('#sendState').classList.toggle('busy',busy);}
async function quickSave(data, {retry=false}={}) {
  const payload={title:'',text:data.text||'',images:data.images||[],files:data.files||[],tags:data.tags|| (tag?[tag]:[])};
  pendingQuick++;setSendState('正在收好…',true);
  const task=saveQueue.then(async()=>{
    try{
      const note=await call('save',payload);
      await refresh();$('#search').value='';$('#sort').value='new';resetView('all');
      const card=[...$('#cards').children].find(c=>c.dataset.id===note.id);
      if(card){card.classList.add('just-saved');card.scrollIntoView({block:'nearest',behavior:'instant'});}
      toast('已收好 · '+date(note.createdAt),{label:'撤销',run:async()=>{await call('action',note.id,'trash');await refresh();toast('已撤销，可在回收站恢复');}});
      return note;
    }catch(e){
      if(!retry)failedCaptures.push(payload);
      toast('未保存：'+e.message,{label:'重试',run:retryFailed});e.captureHandled=true;throw e;
    }finally{
      pendingQuick--;setSendState(pendingQuick?'正在收好…':failedCaptures.length?'有内容未保存，点击重试':'已保存到本机',!!pendingQuick);
    }
  });
  saveQueue=task.catch(()=>{});return task;
}
async function retryFailed(){const pending=[...failedCaptures];for(const item of pending){await quickSave(item,{retry:true});failedCaptures.splice(failedCaptures.indexOf(item),1);}setSendState('已保存到本机');}
$('#sendState').onclick=()=>{if(failedCaptures.length)guard(retryFailed);};
$('#quickForm').onsubmit=e=>{e.preventDefault();guard(async()=>{const input=$('#quickText'),text=input.value;if(!text.trim())return;$('#quickSend').disabled=true;try{await quickSave({text});if(input.value===text)input.value='';}finally{$('#quickSend').disabled=false;input.focus();}});};
$('#quickText').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();$('#quickForm').requestSubmit();}};
$('#quickFiles').onclick=()=>guard(async()=>{const files=await call('pickFiles');if(files.length)await quickSave({files});});
$('#quickImages').onclick=()=>guard(async()=>{const images=await call('pickImages');if(images.length)await quickSave({images});});
async function cardAction(id,action) {
  const n=notes.find(x=>x.id===id);
  if(action==='copy'){await call('copy',n.text||n.title?{text:n.text||n.title}:n.images.length?{image:n.images[0]}:{text:(n.files||[]).map(f=>f.name).join('\n')});toast(n.text||n.title?'文字已复制':n.images.length?'图片已复制':'文件名已复制');return;}
  if(action==='delete'&&!await confirmAction('永久删除这条收藏？','删除后无法从回收站恢复。已导出的备份不受影响。'))return;
  await call('action',id,action);await refresh();if(action==='trash')toast('已移入回收站，可以随时恢复');if(action==='restore')toast('已恢复到收藏库');
}
$('#cards').onclick=e=>{const card=e.target.closest('[data-id]');if(!card)return;const action=e.target.closest('[data-action]');if(action)guard(()=>cardAction(card.dataset.id,action.dataset.action));else {const n=notes.find(x=>x.id===card.dataset.id);if(n.deletedAt)toast('请点击恢复按钮，再查看或编辑内容');else if(e.target.closest('.card-image'))showGallery(n.images,0);else openEditor(n);}};
$('#cards').onkeydown=e=>{if((e.target.classList.contains('card')||e.target.classList.contains('card-image'))&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();}};
async function addDropped(files) {
  if(!files.length)return;
  const inEditor=$('#editor').open;
  if(inEditor&&pendingAttachments){toast('正在添加附件，请稍候');return;}
  const incoming={text:'',images:[],files:[],tags:tag?[tag]:[]};
  if(inEditor){pendingAttachments=true;$('#saveBtn').disabled=true;}else setSendState('正在读取附件…',true);
  try {
    if(files.length>30)throw new Error('一次最多添加 30 个文件，请分批操作');
    let failure;
    for(const f of files){
      try{
        if(f.size>100*1024*1024)throw new Error(f.name+' 超过 100 MB');
        const bytes=new Uint8Array(await f.arrayBuffer());
        if(/^image\//.test(f.type)&&!f.name.toLowerCase().endsWith('.svg'))incoming.images.push(await call('addImage',bytes));
        else incoming.files.push(await call('addFile',bytes,f.name));
      }catch(e){failure=e;break;}
    }
    if(inEditor){draftImages=[...new Set([...draftImages,...incoming.images])].slice(0,30);draftFiles=[...draftFiles,...incoming.files].slice(0,30);renderAttachments();}
    else if(incoming.images.length||incoming.files.length)await quickSave(incoming);
    if(failure)throw new Error('部分附件未添加：'+failure.message+'；已读取的附件已保留，请重新添加其余附件');
  } finally { if(inEditor){pendingAttachments=false;$('#saveBtn').disabled=false;}else if(!pendingQuick)setSendState(failedCaptures.length?'有内容未保存，点击重试':'粘贴即保存'); }
}
document.addEventListener('paste',e=>{
  if($('#imageViewer').open||$('#settingsDialog').open||$('#confirmDialog').open)return;
  const files=[...e.clipboardData.files];
  if(files.length){e.preventDefault();guard(()=>addDropped(files));return;}
  if(!$('#editor').open&&document.activeElement.id!=='search'){e.preventDefault();const text=e.clipboardData.getData('text/plain');if(text)guard(()=>quickSave({text}));}
});
let dragDepth=0;
document.addEventListener('dragenter',e=>{if(e.dataTransfer.types.includes('Files')){e.preventDefault();dragDepth++;if(!$('#settingsDialog').open&&!$('#confirmDialog').open&&!$('#imageViewer').open)$('#dropOverlay').hidden=false;}});
document.addEventListener('dragover',e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault();});
document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('#dropOverlay').hidden=true;}});
document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('#dropOverlay').hidden=true;if($('#settingsDialog').open||$('#confirmDialog').open||$('#imageViewer').open)return;guard(()=>addDropped([...e.dataTransfer.files]));});
$('#settingsBtn').onclick=()=>guard(async()=>{const info=await call('info');$('#dataPath').textContent=info.path;$('#shortcutStatus').textContent=info.shortcut?'Ctrl + Alt + S':'快捷键被占用，可用托盘菜单收藏';openDialog($('#settingsDialog'));guard(async()=>{const status=await call('getStartup');$('#startupToggle').setAttribute('aria-checked',String(status.enabled));});});
$('#closeSettings').onclick=()=>{if(!migratingStorage)closeDialog($('#settingsDialog'));};$('#openFolder').onclick=()=>guard(()=>call('folder'));
$('#exportBtn').onclick=()=>guard(async()=>{const b=$('#exportBtn');b.disabled=true;b.textContent='正在导出…';try{const r=await call('exportBackup');if(r)toast('备份已导出，文字、图片和文件都在里面');}finally{b.disabled=false;b.textContent='导出备份';}});
$('#importBtn').onclick=()=>guard(async()=>{const b=$('#importBtn');b.disabled=true;b.textContent='正在导入…';try{const n=await call('importBackup');if(n!==null){await refresh();toast(`已合并导入 ${n} 条收藏`);}}finally{b.disabled=false;b.textContent='导入备份';}});
function showGallery(images,i){gallery=[...images];galleryIndex=i;updateGallery();openDialog($('#imageViewer'));}
function updateGallery(){$('#fullImage').src='app://media/'+gallery[galleryIndex];$('#viewerCounter').textContent=`${galleryIndex+1} / ${gallery.length}`;$('#prevImage').disabled=galleryIndex===0;$('#nextImage').disabled=galleryIndex===gallery.length-1;}
$('#closeViewer').onclick=()=>closeDialog($('#imageViewer'));$('#prevImage').onclick=()=>{if(galleryIndex>0){galleryIndex--;updateGallery();}};$('#nextImage').onclick=()=>{if(galleryIndex<gallery.length-1){galleryIndex++;updateGallery();}};$('#copyImage').onclick=()=>guard(async()=>{await call('copy',{image:gallery[galleryIndex]});toast('图片已复制');});
document.addEventListener('keydown',e=>{
  const modal=!!document.querySelector('dialog[open]');
  if(!modal&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='v'&&document.activeElement.id!=='search'){e.preventDefault();guard(captureClipboard);}
  if(e.ctrlKey&&e.key==='Enter'&&$('#editor').open&&!$('#confirmDialog').open&&!$('#imageViewer').open){e.preventDefault();$('#editForm').requestSubmit();}
  if(!modal&&e.ctrlKey&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus();$('#search').select();}
  if(!modal&&e.ctrlKey&&e.key.toLowerCase()==='n'){e.preventDefault();openEditor();}
  if($('#imageViewer').open&&e.key==='ArrowLeft')$('#prevImage').click();
  if($('#imageViewer').open&&e.key==='ArrowRight')$('#nextImage').click();
});
function focusQuickInput(){if(!document.querySelector('dialog[open]'))$('#quickText').focus({preventScroll:true});}
window.vault.onFocusInput(()=>requestAnimationFrame(focusQuickInput));
hydrate();guard(async()=>{await refresh();focusQuickInput();const info=await call('info');if(info.recoveredPending)toast('已恢复上次未完成保存的收藏');else if(info.recovered)toast('已从上次备份恢复收藏库，请及时导出完整备份');});

$('#quitApp').onclick=()=>guard(async()=>{if(pendingQuick){toast('正在保存内容，请稍候再退出');return;}if(failedCaptures.length){toast('还有内容未保存，请先点击重试');return;}await call('quit');});

let migratingStorage=false;
window.vault.onStorageProgress(({done,total})=>{$('#changeStorage').textContent=`正在迁移 ${done}/${total}…`;});
$('#changeStorage').onclick=()=>guard(async()=>{
  if(pendingQuick||pendingAttachments||failedCaptures.length){toast('请先完成正在保存或重试的内容，再更换位置');return;}
  const buttons=[...$('#settingsDialog').querySelectorAll('button')];
  migratingStorage=true;buttons.forEach(b=>b.disabled=true);$('#changeStorage').textContent='选择新位置…';
  try{const result=await call('changeStorage');if(result){$('#dataPath').textContent=result.path;await refresh();toast(`已迁移 ${result.count} 条收藏，原位置保留副本`);}}
  finally{migratingStorage=false;buttons.forEach(b=>b.disabled=false);$('#changeStorage').textContent='更换位置';}
});

$('#startupToggle').onclick=()=>guard(async()=>{
  const button=$('#startupToggle'),enabled=button.getAttribute('aria-checked')!=='true';button.disabled=true;
  try{const status=await call('setStartup',enabled);button.setAttribute('aria-checked',String(status.enabled));toast(status.enabled?'已开启：登录后延迟 45 秒驻留托盘':'已关闭开机启动');}finally{button.disabled=false;}
});

$('#loadMore').onclick=()=>{visibleLimit+=60;render();};
new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)&&!$('#loadMore').hidden){visibleLimit+=60;render();}},{rootMargin:'200px'}).observe($('#loadMore'));
