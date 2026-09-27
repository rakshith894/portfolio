import { writeFile } from 'node:fs/promises';
const targets = await (await fetch('http://localhost:9224/json/list')).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('No isolated test tab');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map(), errors = [];
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data);
  if (message.id) { const callbacks = pending.get(message.id); pending.delete(message.id); message.error ? callbacks?.reject(message.error) : callbacks?.resolve(message.result); }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(a => a.value ?? a.description));
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
const action = process.argv[2] ?? 'initial';
if (action === 'initial' || action === 'mobile' || action === 'reduce') {
  await call('Emulation.setDeviceMetricsOverride', { width: action === 'mobile' ? 390 : 1440, height: action === 'mobile' ? 844 : 960, deviceScaleFactor: 1, mobile: action === 'mobile' });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: action === 'reduce' ? 'reduce' : 'no-preference' }] });
  await call('Page.navigate', { url: 'http://localhost:3000/' });
  for (let i = 0; i < 40; i++) { await wait(500); if (await evaluate('!!document.querySelector("canvas") && !document.querySelector(".island-loading")')) break; }
  await wait(1500); await screenshot(`storm-${action}`);
} else if (action === 'capture') {
  await screenshot('storm-current');
} else if (action === 'pause' || action === 'play') {
  await evaluate(`document.querySelector('button[aria-label="${action === 'pause' ? 'Pause atmosphere' : 'Resume atmosphere'}"]')?.click()`);
  await wait(800); await screenshot(`storm-${action}`);
} else if (action === 'view') {
  const label = process.argv[3];
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)})?.click()`);
  await wait(3500); await screenshot('storm-view');
} else if (action === 'motion') {
  await screenshot('storm-motion-a'); await wait(2500); await screenshot('storm-motion-b');
}
console.log(JSON.stringify({ text: await evaluate('document.body.innerText'), buttons: await evaluate('[...document.querySelectorAll("button")].map(b=>({label:b.getAttribute("aria-label"),text:b.textContent,pressed:b.getAttribute("aria-pressed")}))'), errors }, null, 2));
socket.close();
