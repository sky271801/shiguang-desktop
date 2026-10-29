const path=require('node:path');
const {setStartup}=require('../startup');
setStartup(path.join(process.env.APPDATA,'Shiguang'),path.resolve(process.argv[3]),process.argv[2]==='enable').then(s=>console.log(JSON.stringify({enabled:s.enabled,delay:s.delay}))).catch(e=>{console.error(e.message);process.exitCode=1;});
