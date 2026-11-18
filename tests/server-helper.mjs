import {spawn} from 'node:child_process';
export const cleanEnv={PATH:process.env.PATH,HOME:process.env.HOME,NSP_LOAD_ENV:'0',CBR_ENABLED:'0',API_HOST:'127.0.0.1',API_PORT:'0',HOST:'127.0.0.1',PORT:'0'};
export async function launch(entry,cwd,env){
  const child=spawn(process.execPath,[entry],{cwd,env:{...cleanEnv,...env},stdio:['ignore','pipe','pipe']});
  let log='';
  const origin=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(new Error('Server startup timed out'));},15000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited during startup (${code}): ${log.slice(-1500)}`));});
    child.stderr.on('data',b=>{log+=b;});
    child.stdout.on('data',b=>{log+=b;const url=log.match(/http:\/\/127\.0\.0\.1:\d+|unix:[^\n]+/)?.[0];if(url){clearTimeout(timer);resolve(url);}});
  });
  return {origin,async stop(){if(child.exitCode!==null||child.signalCode)return;const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(timer);}};
}
