import { serializeStatement } from '../shared/openui/serialize.js';
import type { RequestData, Turn } from '../shared/contracts.js';
import { ScreenDocument } from '../shared/openui/document.js';
export function mockTurn(request: RequestData, fixture: string, session = ''): Turn {
  const last=request.messages.at(-1)?.content.trim().toLowerCase() ?? '';
  const fence=(code:string)=>'```openui\n'+code+'\n```';
  if(last==='load wiring sample' || last==='/demo')return {reply:'Wiring fixture loaded. This is deterministic, not a model interpreting your skill.\n'+fence('root = Screens([])')+'\n'+fence(fixture)};
  if(last==='/workout' && session)return {reply:'Neon Intervals is loaded — a scripted demo session, not a model reading your skill.\n'+fence('root = Screens([])')+'\n'+fence(session)};
  const doc=new ScreenDocument();if(request.state.ui_state)doc.apply(fence(request.state.ui_state));
  const screens=doc.screens;const index=screens.findIndex(s=>s.key===doc.cursor);
  const move=(target:number,text:string)=>({reply:text+'\n'+fence(`root = Screens([${screens.map(s=>s.key).join(', ')}], ${screens[Math.max(0,Math.min(screens.length-1,target))].key})`)});
  if(['next','back'].includes(last) && screens.length)return move(index+(last==='back'?-1:1),'Fixture cursor moved.');
  if(/^change value to (\d{1,2})$/.test(last) && doc.program.includes('count1 =')){const value=Number(last.match(/\d+/)![0]);return {reply:'Fixture values patched under their existing names.\n'+fence(serializeStatement('count1','Keyword',[String(value),'Sample value'])+'\n'+serializeStatement('count2','Keyword',[String(value),'Second sample value']))};}
  if(doc.program.includes('effort1 =')){
    if(last==="let's go")return move(index+1,'Round one, coming up. Start the clock when you’re ready.');
    if(last==='run it back')return move(0,'Back to the top. Same fictional session, fresh clocks whenever you start them.');
    const level=last==='make it lighter'?4:last==='make it harder'?8:0;
    if(level)return {reply:(level<6?'Dialled down. Still entirely simulated.':'Turned up. The intensity is fictional, the vibes are real.')+'\n'+fence(serializeStatement('effort1','Effort',[level,'Simulated intensity']))};
  }
  return {reply:'Mock only understands /workout, /demo, next, back, the demo session buttons and “change value to 6”. It does not read your skill. Edit the fixture/mock, test a local OpenUI patch in Builder tools, or explicitly enable a live provider.'};
}
