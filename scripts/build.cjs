const path = require('node:path');
const fs = require('node:fs');
const { build, Platform } = require('electron-builder');
(async () => {
  // Resolves the installed runtime before asking the builder to package it.
  const runtime = path.dirname(require('electron'));
  const { version } = require('../package.json');
  const output = path.resolve('release', version);
  await build({ targets: Platform.WINDOWS.createTarget('dir'), config: { electronDist: runtime, directories: { output } } });
  const { rcedit } = await import('rcedit');
  const executable = path.join(output,'win-unpacked/拾光.exe');
  await rcedit(executable, { icon: path.resolve('assets/icon.ico'), 'file-version':version, 'product-version':version, 'version-string': { ProductName:'拾光', FileDescription:'拾光 · 随手一贴，即刻收藏', CompanyName:'Sky', OriginalFilename:'拾光.exe' } });
  fs.copyFileSync('使用说明.md',path.join(output,'win-unpacked/使用说明.md'));
  const {execFileSync}=require('node:child_process');
  const folder=path.dirname(executable);
  execFileSync(path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:winexe','/optimize+','/platform:anycpu','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/win32icon:'+path.resolve('assets/icon.ico'),'/out:'+path.join(folder,'拾光托盘.exe'),path.resolve('assets/LightTray.cs')],{windowsHide:true});
  fs.copyFileSync('assets/icon.ico',path.join(folder,'拾光.ico'));
  console.log('Ready: '+executable);
})().catch(e=>{console.error(e);process.exitCode=1;});
