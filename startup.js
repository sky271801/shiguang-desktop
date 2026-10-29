const fs=require('node:fs');
const path=require('node:path');
const {execFile}=require('node:child_process');
const TASK='Shiguang-DelayedStartup';
const quote=value=>"'"+String(value).replace(/'/g,"''")+"'";
function runPowerShell(script){return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:20000},(error,stdout,stderr)=>error?reject(new Error((stderr||error.message).trim())):resolve(stdout.trim())));}
function getStartup(profile){try{return {...JSON.parse(fs.readFileSync(path.join(profile,'startup.json'),'utf8')),delay:45};}catch{return {enabled:false,delay:45};}}
async function setStartup(profile,exe,enabled){
 if(process.platform!=='win32')throw new Error('此功能仅适用于 Windows');
 if(enabled&&!fs.existsSync(exe))throw new Error('启动程序不存在');
 const script=`$ErrorActionPreference='Stop'
 $taskName=${quote(TASK)}
 ${enabled?`$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $action=New-ScheduledTaskAction -Execute ${quote(exe)} -Argument '--autostart' -WorkingDirectory ${quote(path.dirname(exe))}
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $sid
 $trigger.Delay='PT45S'
 $principal=New-ScheduledTaskPrincipal -UserId $sid -LogonType Interactive -RunLevel Limited
 $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
 Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null`:`if(Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue){Unregister-ScheduledTask -TaskName $taskName -Confirm:$false}`}
 `;
 await runPowerShell(script);
 fs.mkdirSync(profile,{recursive:true});
 const value={enabled:!!enabled,delay:45,exe};
 fs.writeFileSync(path.join(profile,'startup.json'),JSON.stringify(value));
 return value;
}
module.exports={getStartup,setStartup,TASK};
