const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const AdmZip = require('adm-zip');
const IMAGE = /^[a-f0-9]{64}\.(png|jpg|jpeg|webp|gif)$/;
const FILE = /^[a-f0-9]{64}\.bin$/;

// Some redirected Windows folders cannot rename, even within one directory.
// Keep the fully flushed source until the destination is verified and flushed.
function replaceFile(source, destination) {
  try { fs.renameSync(source, destination); }
  catch (error) {
    if (error.code !== 'EXDEV') throw error;
    fs.copyFileSync(source, destination);
    const fd = fs.openSync(destination, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (!fs.readFileSync(source).equals(fs.readFileSync(destination))) throw new Error('保存校验失败，请重试');
    // A leftover source is safe: startup can finish an interrupted replacement.
    try { fs.unlinkSync(source); } catch { /* recover or discard on next startup */ }
  }
}

class Store {
  constructor(root) {
    this.root = root;
    this.media = path.join(root, 'images');
    this.files = path.join(root, 'files');
    this.file = path.join(root, 'library.json');
    fs.mkdirSync(this.media, { recursive: true });
    fs.mkdirSync(this.files, { recursive: true });
    this.state = { version: 1, notes: [] };
    const temp = this.file + '.tmp';
    let primaryValid = false, primaryError = false;
    if (fs.existsSync(this.file)) {
      try { this.state = this.read(this.file); primaryValid = true; }
      catch { primaryError = true; }
    }
    if (fs.existsSync(temp)) {
      let pending;
      try { pending = this.read(temp); }
      catch {
        fs.copyFileSync(temp, temp + '.damaged-' + Date.now());
        if (!primaryValid && !fs.existsSync(this.file + '.bak')) throw new Error('未完成的收藏库无法读取，请保留数据文件并从备份恢复。');
      }
      if (pending && (!primaryValid || fs.statSync(temp).mtimeMs >= fs.statSync(this.file).mtimeMs)) {
        if (primaryValid) fs.copyFileSync(this.file, this.file + '.bak');
        else if (primaryError) fs.copyFileSync(this.file, this.file + '.damaged-' + Date.now());
        replaceFile(temp, this.file);
        this.state = pending;
        this.recoveredPending = true;
        primaryValid = true;
      } else if (pending || primaryValid) {
        if (pending) fs.copyFileSync(temp, temp + '.stale-' + Date.now());
        fs.unlinkSync(temp);
      }
    }
    if (!primaryValid && (primaryError || fs.existsSync(this.file + '.bak'))) {
      if (!fs.existsSync(this.file + '.bak')) throw new Error('收藏库损坏，请保留数据文件并从备份恢复。');
      this.state = this.read(this.file + '.bak');
      if (primaryError) fs.copyFileSync(this.file, this.file + '.damaged-' + Date.now());
      fs.copyFileSync(this.file + '.bak', this.file);
      this.recovered = true;
    }
  }
  read(file) { const data = JSON.parse(fs.readFileSync(file, 'utf8')); this.validate(data); return data; }
  validate(data) {
    if (data?.version !== 1 || !Array.isArray(data.notes) || data.notes.length > 100000) throw new Error('不是有效的拾光备份');
    const ids = new Set();
    for (const n of data.notes) {
      if (typeof n.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(n.id) || ids.has(n.id) || typeof n.title !== 'string' || typeof n.text !== 'string' || !Array.isArray(n.tags) || n.tags.some(t => typeof t !== 'string') || !Array.isArray(n.images) || n.images.some(i => typeof i !== 'string' || !IMAGE.test(i)) || !Number.isFinite(n.createdAt) || !Number.isFinite(n.updatedAt) || typeof n.starred !== 'boolean' || !(n.deletedAt === null || Number.isFinite(n.deletedAt))) throw new Error('备份内容格式错误');
      ids.add(n.id);
      if (n.files !== undefined && (!Array.isArray(n.files) || n.files.some(f => !FILE.test(f.key) || typeof f.name !== 'string' || !Number.isFinite(f.size) || f.size < 0))) throw new Error('备份文件格式错误');
    }
  }
  commit(next) {
    this.validate(next);
    const temp = this.file + '.tmp';
    const fd = fs.openSync(temp, 'w');
    try { fs.writeFileSync(fd, JSON.stringify(next)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    if (fs.existsSync(this.file)) fs.copyFileSync(this.file, this.file + '.bak');
    replaceFile(temp, this.file);
    this.state = next;
  }
  list() { return structuredClone(this.state.notes); }
  addImage(buffer, ext = 'png') {
    if (!Buffer.isBuffer(buffer) || buffer.length > 40 * 1024 * 1024 || !buffer.length || !['png','jpg','jpeg','webp','gif'].includes(ext)) throw new Error('图片无效或超过 40 MB');
    const name = createHash('sha256').update(buffer).digest('hex') + '.' + ext;
    const file = path.join(this.media, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, buffer, { flag: 'wx' });
    return name;
  }
  addFile(buffer, name) {
    if (!Buffer.isBuffer(buffer) || buffer.length > 100 * 1024 * 1024) throw new Error('单个文件不能超过 100 MB');
    const key = createHash('sha256').update(buffer).digest('hex') + '.bin';
    const dest = path.join(this.files, key);
    if (!fs.existsSync(dest)) fs.writeFileSync(dest, buffer, { flag: 'wx' });
    return { key, name: path.basename(String(name)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180) || '未命名文件', size: buffer.length };
  }
  save(input) {
    const old = input.id ? this.state.notes.find(n => n.id === input.id) : null;
    if (input.id && !old) throw new Error('这条收藏不存在');
    if (old?.deletedAt) throw new Error('请先从回收站恢复这条收藏');
    const title = String(input.title || '').trim().slice(0, 200);
    const text = String(input.text || '').trim().slice(0, 500000);
    const tags = [...new Set((input.tags || []).map(t => String(t).trim().slice(0, 30)).filter(Boolean))].slice(0, 20);
    const images = [...new Set(input.images || [])].slice(0, 30);
    const files = (input.files || []).slice(0, 30).map(f => ({ key: f.key, name: String(f.name).slice(0,180), size: f.size }));
    if (files.some(f => !FILE.test(f.key) || !fs.existsSync(path.join(this.files, f.key)) || fs.statSync(path.join(this.files, f.key)).size !== f.size)) throw new Error('附件不存在，请重新添加');
    if (images.some(i => !IMAGE.test(i) || !fs.existsSync(path.join(this.media, i)))) throw new Error('图片不存在，请重新添加');
    if (!title && !text && !images.length && !files.length) throw new Error('写点文字，或添加图片、文件吧');
    const now = Date.now();
    const note = { id: old?.id || randomUUID(), title, text, tags, images, files, starred: old?.starred || false, createdAt: old?.createdAt || now, updatedAt: now, deletedAt: null };
    this.commit({ version: 1, notes: old ? this.state.notes.map(n => n.id === old.id ? note : n) : [...this.state.notes, note] });
    return note;
  }
  action(id, action) {
    const note = this.state.notes.find(n => n.id === id);
    if (!note) throw new Error('收藏不存在');
    let notes = this.list();
    const target = notes.find(n => n.id === id);
    if (action === 'star') target.starred = !target.starred;
    else if (action === 'trash') target.deletedAt = Date.now();
    else if (action === 'restore') target.deletedAt = null;
    else if (action === 'delete' && note.deletedAt) notes = notes.filter(n => n.id !== id);
    else throw new Error('无效的操作');
    this.commit({ version: 1, notes });
  }
  exportTo(file) {
    const zip = new AdmZip();
    zip.addFile('library.json', Buffer.from(JSON.stringify(this.state, null, 2)));
    const used = new Set(this.state.notes.flatMap(n => n.images));
    for (const name of used) zip.addLocalFile(path.join(this.media, name), 'images');
    for (const key of new Set(this.state.notes.flatMap(n => (n.files || []).map(f => f.key)))) zip.addLocalFile(path.join(this.files, key), 'files');
    const temp = file + '.tmp';
    zip.writeZip(temp); replaceFile(temp, file);
  }
  importFrom(file) {
    if (fs.statSync(file).size > 2 * 1024 * 1024 * 1024) throw new Error('备份超过 2 GB，请分批整理');
    const zip = new AdmZip(file);
    const entries = zip.getEntries();
    if (entries.reduce((a,e) => a + e.header.size, 0) > 2 * 1024 * 1024 * 1024) throw new Error('备份解压后过大');
    const index = zip.getEntry('library.json');
    if (!index || index.header.size > 64 * 1024 * 1024) throw new Error('备份缺少有效的收藏库');
    const data = JSON.parse(index.getData().toString('utf8')); this.validate(data);
    const used = new Set(data.notes.flatMap(n => n.images));
    const buffers = [];
    for (const name of used) {
      const entry = zip.getEntry('images/' + name);
      if (!entry || entry.header.size > 40 * 1024 * 1024) throw new Error('备份中的图片缺失或过大');
      const bytes = entry.getData();
      if (createHash('sha256').update(bytes).digest('hex') !== name.split('.')[0]) throw new Error('备份图片校验失败');
      buffers.push([name, bytes]);
    }
    const existing = new Map(this.state.notes.map(n => [n.id, n]));
    const fileBuffers = [];
    for (const key of new Set(data.notes.flatMap(n => (n.files || []).map(f => f.key)))) {
      const entry = zip.getEntry('files/' + key);
      if (!entry || entry.header.size > 100 * 1024 * 1024) throw new Error('备份中的文件缺失或过大');
      const bytes = entry.getData();
      if (createHash('sha256').update(bytes).digest('hex') !== key.split('.')[0]) throw new Error('备份文件校验失败');
      if (data.notes.some(n => (n.files || []).some(f => f.key === key && f.size !== bytes.length))) throw new Error('备份文件大小不匹配');
      fileBuffers.push([key, bytes]);
    }
    const added = [];
    for (const n of data.notes) {
      const prior = existing.get(n.id);
      if (prior && JSON.stringify(prior) === JSON.stringify(n)) continue;
      added.push({ ...n, id: prior ? randomUUID() : n.id });
    }
    for (const [name, bytes] of buffers) if (!fs.existsSync(path.join(this.media, name))) fs.writeFileSync(path.join(this.media, name), bytes);
    for (const [key, bytes] of fileBuffers) if (!fs.existsSync(path.join(this.files, key))) fs.writeFileSync(path.join(this.files, key), bytes);
    this.commit({ version: 1, notes: [...this.state.notes, ...added] });
    return added.length;
  }
}
module.exports = { Store, IMAGE, FILE, replaceFile };
