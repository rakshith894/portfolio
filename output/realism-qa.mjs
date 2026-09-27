import { writeFile } from 'node:fs/promises';
const pages = await (await fetch('http://127.0.0.1:9335/json/list')).json();
const page = pages.find(p => p.type === 'page');
if (!page) throw new Error('Isolated QA page unavailable');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, {once:true}); socket.addEventListener('error', reject, {once:true}); });
let sequence=0;
const pending=new Map(), errors=[];
socket.addEventListener('message', ({data}) => {
  const message=JSON.parse(data);
  if(message.id){const callback=pending.get(message.id);pending.delete(message.id);message.error?callback.reject(message.error):callback.resolve(message.result);}
  if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
  if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(a=>a.value??a.description));
});
const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++sequence,{resolve,reject});socket.send(JSON.stringify({id:sequence,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const shot=async name=>{const {data}=await call('Page.captureScreenshot',{format:'png'});await writeFile(`E:/port/output/${name}.png`,Buffer.from(data,'base64'));};
await call('Runtime.enable');await call('Page.enable');
await call('Network.enable');
await call('Network.setCacheDisabled',{cacheDisabled:true});
const action=process.argv[2]??'initial';
if(action==='initial'||action==='mobile'){
 await call('Emulation.setDeviceMetricsOverride',{width:action==='mobile'?390:1440,height:action==='mobile'?844:960,deviceScaleFactor:1,mobile:action==='mobile'});
 await call('Page.navigate',{url:'http://localhost:3000/'});
 for(let i=0;i<60;i++){await wait(500);if(await evaluate('!!document.querySelector(".landing-next")'))break;}
 await shot(`realism-${action}-landing`);
 await evaluate('document.querySelector(".landing-next").click()');
 for(let i=0;i<60;i++){await wait(500);if(await evaluate('!!document.querySelector("canvas")&&!document.querySelector(".island-loading")'))break;}
 await wait(4000);await shot(`realism-${action}`);
}else if(action==='enter'){
 const rect=await evaluate('(()=>{const r=document.querySelector(".landing-next").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
 await call('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...rect});
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...rect});
 for(let i=0;i<60;i++){await wait(500);if(await evaluate('!!document.querySelector("canvas")&&!document.querySelector(".island-loading")'))break;}
 await wait(4000);await shot('realism-entered');
}else if(action==='overview'){
 await evaluate(`document.querySelector('button[aria-label="View the whole island"]')?.click()`);await wait(3000);await shot('realism-overview');
}else if(action==='place'){
 const name=process.argv[3];
 await evaluate('document.querySelector(".island-destinations-toggle").click()');
 await evaluate(`[...document.querySelectorAll('.island-destinations-menu button')].find(b=>b.textContent===${JSON.stringify(name)})?.click()`);
 for(let i=0;i<120;i++){await wait(500);if(await evaluate('!document.querySelector(".walk-objective")?.textContent.includes("Walking to")'))break;}
 await shot('realism-place');
}else if(action==='checks'){
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await evaluate(`document.querySelector('button[aria-label="Return to close camera"]')?.click()`);
 await evaluate('document.querySelector(".island-destinations-toggle").click()');
 await evaluate(`[...document.querySelectorAll('.island-destinations-menu button')].find(b=>b.textContent==='Rakshith Manor').click()`);
 await wait(750);
 if(!await evaluate('document.querySelector(".walk-objective").textContent.includes("Walking to")'))throw new Error('No destination feedback');
 await evaluate(`[...document.querySelectorAll('.walk-objective button')].find(b=>b.textContent.includes('Stop walking')).click()`);
 if(await evaluate('document.querySelector(".walk-objective").textContent.includes("Walking to")'))throw new Error('Stop did not cancel route');
 await evaluate('document.querySelector(".island-destinations-toggle").click()');
 await evaluate(`[...document.querySelectorAll('.island-destinations-menu button')].find(b=>b.textContent==='Rakshith Manor').click()`);
 for(let i=0;i<160;i++){await wait(500);if(await evaluate('!!document.querySelector(".island-enter-house")'))break;}
 await shot('realism-manor-final');
 await evaluate('document.querySelector(".island-enter-house").click()');
 await wait(2000);await shot('realism-house');
 console.log('CHECKS: route feedback, Stop, manor arrival, and house entry passed');
}else if(action==='housecheck'){
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('B1')).click()`);
 await wait(2000);
 await evaluate('document.querySelector(".record-invitation button").click()');
 await wait(400); await shot('realism-record');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Quick portfolio')).click()`);
 await wait(400); await shot('realism-portfolio');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='The island').click()`);
 for(let i=0;i<60;i++){await wait(500);if(await evaluate('!!document.querySelector(".island-enter-house")'))break;}
 if(!await evaluate('!!document.querySelector(".island-enter-house")'))throw new Error('Return from house did not preserve entrance position');
 console.log('CHECKS: gallery, record, quick portfolio, and return to island passed');
}else if(action==='mobilecheck'){
 await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate('document.querySelector(".island-destinations-toggle").click()');
 await shot('realism-mobile-menu');
 const layout=await evaluate(`(()=>{const menu=document.querySelector('.island-destinations-menu').getBoundingClientRect();const pad=document.querySelector('.walk-pad').getBoundingClientRect();return {menu:{x:menu.x,y:menu.y,right:menu.right,bottom:menu.bottom},pad:{y:pad.y,bottom:pad.bottom},width:innerWidth,height:innerHeight}})()`);
 console.log(JSON.stringify({layout}));
 if(layout.menu.x<0||layout.menu.right>layout.width||layout.menu.y<0||layout.menu.bottom>layout.pad.y)throw new Error('Mobile controls overlap or leave viewport');
 await call('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});
 await call('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});
 if(await evaluate('!!document.querySelector(".island-destinations-menu")'))throw new Error('Escape did not close menu');
 console.log('CHECKS: mobile menu, walking controls, and Escape passed');
}else if(action==='capture') await shot(process.argv[3]??'realism-current');
console.log(JSON.stringify({text:await evaluate('document.body.innerText'),errors},null,2));
socket.close();
