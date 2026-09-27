import { writeFile } from 'node:fs/promises';
const targets = await (await fetch('http://localhost:9223/json/list')).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No local test tab');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map(), errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) { const callbacks = pending.get(message.id); pending.delete(message.id); message.error ? callbacks?.reject(message.error) : callbacks?.resolve(message.result); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
});
const call = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const screenshot = async (name) => { const { data } = await call('Page.captureScreenshot', { format: 'png' }); await writeFile(`E:/port/output/${name}.png`, Buffer.from(data, 'base64')); };
await call('Runtime.enable'); await call('Log.enable'); await call('Page.enable');
await call('Emulation.setDeviceMetricsOverride', { width: 1672, height: 941, deviceScaleFactor: 1, mobile: false });
await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
const action = process.argv[2] ?? 'initial';
if (action === 'initial') {
  await call('Page.navigate', { url: 'http://localhost:3000/' });
  for (let i = 0; i < 50; i++) { await wait(600); if (await evaluate('!!document.querySelector("canvas") && !document.querySelector(".island-loading")')) break; }
  await wait(700); await screenshot('island-aerial');
} else if (action === 'mobile') {
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await call('Page.reload'); await wait(6000); await screenshot('island-mobile');
} else if (action === 'house') {
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Enter the house"))?.click()');
  await wait(4000); await screenshot('island-house');
} else {
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(action)})?.click()`);
  await wait(1200); await screenshot(action === 'The approach' ? 'island-approach' : action === 'At the gates' ? 'island-gate' : 'island-other');
}
console.log(JSON.stringify({ title: await evaluate('document.title'), text: await evaluate('document.body.innerText'), errors }, null, 2));
socket.close();
