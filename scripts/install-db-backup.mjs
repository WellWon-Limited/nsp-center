// Install this project's hourly local backup check. Run only after Factory admin intent approval.
import {mkdir, writeFile, access, chmod} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {adminUrl} from '../apps/api/database/config.mjs';
if(process.platform!=='darwin')throw new Error('This installer is for the local macOS workstation.');
await adminUrl();
const root=fileURLToPath(new URL('../',import.meta.url));
const state=join(homedir(),'.local/state/nsp-center');
const label='com.wellwon.nsp-center.database-backup';
const agents=join(homedir(),'Library/LaunchAgents');
const plist=join(agents,label+'.plist');
try{await access(plist);throw new Error('Backup schedule already exists; inspect it before replacing.');}catch(error){if(error.code!=='ENOENT')throw error;}
await mkdir(join(state,'bin'),{recursive:true,mode:0o700});
await mkdir(agents,{recursive:true});
const launcher=join(state,'bin/nsp-center-database-backup');
const quote=s=>"'"+s.replaceAll("'","'\\''")+"'";
await writeFile(launcher,`#!/bin/sh\n# NSP Center: create a daily backup and verify restoration.\nexec ${quote(process.execPath)} ${quote(join(root,'scripts/backup-db.mjs'))} --due\n`,{mode:0o700});
await chmod(launcher,0o700);
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const log=join(state,'database-backup.log');
await writeFile(log,'',{flag:'a',mode:0o600});await chmod(log,0o600);
const text=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(launcher)}</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>StartInterval</key><integer>3600</integer>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${xml(log)}</string>
<key>StandardErrorPath</key><string>${xml(log)}</string>
<key>Umask</key><integer>63</integer>
</dict></plist>\n`;
await writeFile(plist,text,{mode:0o600,flag:'wx'});
execFileSync('/bin/launchctl',['bootstrap',`gui/${process.getuid()}`,plist],{stdio:'inherit'});
console.log('NSP Center backup schedule installed: hourly check, daily verified backup, catch-up after login.');
