const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { Store, replaceFile } = require('./store');

function inside(parent, child) {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
}
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
class StorageManager {
  constructor(profile) {
    this.profile = profile;
    fs.mkdirSync(profile, { recursive: true });
    this.settingsFile = path.join(profile, 'storage.json');
    this.busy = false;
    let selected;
    const read = file => {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (typeof data.collectionPath !== 'string' || !path.isAbsolute(data.collectionPath)) throw new Error('数据位置设置无效');
      return data.collectionPath;
    };
    if (fs.existsSync(this.settingsFile)) {
      try { selected = read(this.settingsFile); }
      catch {
        if (!fs.existsSync(this.settingsFile + '.bak')) throw new Error('数据位置设置损坏，请保留 storage.json 并恢复备份。');
        selected = read(this.settingsFile + '.bak');
      }
    }
    // A disconnected drive must not silently produce an empty replacement library.
    if (selected && !fs.existsSync(path.join(selected, 'library.json')) && !fs.existsSync(path.join(selected, 'library.json.tmp'))) throw new Error('找不到收藏库：' + selected + '。请连接原来的磁盘后重试。');
    this.store = new Store(selected || path.join(profile, 'collection'));
  }
  async migrateTo(parent, progress = () => {}) {
    if (this.busy) throw new Error('正在迁移，请稍候');
    this.busy = true;
    let target, selectedParent, created = false, complete = false;
    try {
      const parentReal = await fsp.realpath(parent);
      selectedParent = parentReal;
      const source = await fsp.realpath(this.store.root);
      target = path.join(parentReal, '拾光收藏库');
      if (inside(source, target) || inside(target, source)) throw new Error('新位置不能是当前收藏库或它的内部目录');
      if (fs.existsSync(target)) throw new Error('该位置已存在「拾光收藏库」，请选择另一个位置，避免覆盖原有资料');
      const snapshot = JSON.stringify(this.store.state);
      const entries = [];
      async function walk(folder, relative = '') {
        for (const entry of await fsp.readdir(folder, { withFileTypes: true })) {
          const rel = path.join(relative, entry.name);
          if (entry.isSymbolicLink()) throw new Error('收藏库内存在链接目录，迁移前请移除链接');
          if (entry.isDirectory()) await walk(path.join(folder, entry.name), rel);
          else if (entry.isFile()) entries.push(rel);
        }
      }
      await walk(source);
      await fsp.mkdir(target); created = true;
      // An empty library still needs an index before it becomes the selected library.
      if (!entries.includes('library.json')) {
        const candidate = new Store(target);candidate.commit(JSON.parse(snapshot));
      }
      let copied = 0;
      for (const rel of entries) {
        const from = path.join(source, rel), to = path.join(target, rel);
        await fsp.mkdir(path.dirname(to), { recursive: true });
        await pipeline(fs.createReadStream(from), fs.createWriteStream(to, { flags: 'wx', flush: true }));
        if (await digest(from) !== await digest(to)) throw new Error('迁移校验失败，原收藏库已保留');
        progress({ done: ++copied, total: entries.length });
      }
      const next = new Store(target);
      if (JSON.stringify(next.state) !== snapshot) throw new Error('收藏记录校验失败，原收藏库已保留');
      complete = true;
      const temp = this.settingsFile + '.tmp';
      const fd = fs.openSync(temp, 'w');
      try { fs.writeFileSync(fd, JSON.stringify({ collectionPath: target }));fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      if (fs.existsSync(this.settingsFile)) fs.copyFileSync(this.settingsFile, this.settingsFile + '.bak');
      else fs.writeFileSync(this.settingsFile + '.bak', JSON.stringify({ collectionPath: source }));
      replaceFile(temp, this.settingsFile);
      this.store = next;
      return { path: target, count: next.list().length };
    } catch (error) {
      // Only roll back a newly created, incomplete directory within the chosen parent.
      // A complete copy is retained if writing the location setting failed.
      if (created && !complete && target && selectedParent && inside(selectedParent, target) && target !== selectedParent && path.basename(target) === '拾光收藏库') await fsp.rm(target, { recursive: true, force: true }).catch(() => {});
      throw error;
    } finally { this.busy = false; }
  }
}
module.exports = { StorageManager };
