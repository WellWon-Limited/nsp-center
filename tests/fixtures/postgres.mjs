// Keep embedded-postgres's process-wide exit hooks outside the Node test runner.
import EmbeddedPostgres from 'embedded-postgres';
const [databaseDir,port,name]=process.argv.slice(2);
const database=new EmbeddedPostgres({databaseDir,port:Number(port),user:'test',password:'test',persistent:false,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});
let stopping;
function stop(){return stopping??=(async()=>{await database.stop();if(process.connected)process.disconnect();})();}
process.on('message',message=>{if(message==='stop')void stop().catch(error=>{console.error(error);process.exitCode=1;if(process.connected)process.disconnect();});});
process.once('SIGTERM',()=>void stop());
process.once('disconnect',()=>void stop());
try{await database.initialise();await database.start();await database.createDatabase(name);process.send?.({ready:true});}
catch(error){console.error(error);process.exitCode=1;await stop();}
