import { Conversation } from '../shared/controller.js';
import { APP_VERSION, SCHEMA_VERSION, type Provider, type ProviderStatus, type RequestData, type Result } from '../shared/contracts.js';
import { TimerLedger, type TimerListEntry } from '../shared/openui/timer-store.js';
import { activityClientEvents, timerTransitionEvent } from '../shared/openui/activity-client-events.js';
import { createRunNav } from '../shared/openui/run-nav.js';
import { splitReply } from '../shared/openui/document.js';
import type { StatementNode } from '../shared/openui/openui-model.js';
import { redactValue } from '../shared/redact.js';
import { motion, renderComponent } from './components.js';
import { byId,el } from './dom.js';
import { withIcon } from './icons.js';
const setLabel=(id:string,text:string)=>{byId(id).querySelector('.label')!.textContent=text;};
const clockTime=(iso:string)=>new Date(iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});

type Config={providers:ProviderStatus[];token:string};let config:Config|undefined;
const timers=new TimerLedger();let previousTimers=new Map<string,TimerListEntry>(),updates:(()=>void)[]=[],paused=false,pausedTimers:string[]=[],renderKey='',lastClear=0,lastIndex=-1,seenEvents=0,lastCue='',lastProps=new Map<string,string>();
const draft=byId<HTMLTextAreaElement>('message');
const c=new Conversation(async(request:RequestData,signal:AbortSignal):Promise<Result>=>{
  const controller=new AbortController(),abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});const timeout=setTimeout(abort,request.provider==='claude-cli'?85000:48000);
  try{const response=await fetch('/api/turn',{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':config!.token},body:JSON.stringify(request),signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error??'Request failed.');return data;}
  catch(error){if(error instanceof Error && error.name==='AbortError')throw new Error('Request cancelled or timed out. Retry when ready.');throw error;}
  finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
},render,()=>[...(paused?['Preview is currently paused.']:[]),...timers.list().map(t=>`Simulated timer ${t.id} (${t.label}): ${t.status}, ${Math.ceil(t.remaining)} of ${t.seconds} seconds remaining.`)]);
function makeNav(){return createRunNav({index:()=>c.document.screens.findIndex(s=>s.key===c.document.cursor),stepCount:()=>c.document.screens.length,isConsumed:()=>false,awaiting:()=>false,leave:()=>{if(c.pending)c.cancel('interrupted');},land:(from,to)=>{c.document.move(to);c.localEvent(to<from?activityClientEvents.wentBack(`step ${from+1}`,`step ${to+1}`):activityClientEvents.nowOnStep(`step ${to+1} of ${c.document.screens.length}`));},phase:()=>{},finish:()=>c.localEvent('Reached the final screen. This is not evidence of physical completion.')},{outMs:30,inMs:30});}
let nav=makeNav();
function send(text:string){if(!config)return;const provider=config.providers.find(p=>p.id===c.provider)!;if(!provider.enabled||(c.provider!=='mock'&&!c.consent)){c.error='Set up this provider and agree to usage, or select Mock.';render();return;}if(paused){c.error='Resume the preview before sending.';render();return;}const f=byId<HTMLSelectElement>('fault');const fault=f.value as RequestData['fault'];f.value='none';void c.send(text,fault);}
function syncTimers(){
  if(lastClear!==c.document.clearVersion){nav.dispose();nav=makeNav();timers.forget();previousTimers.clear();lastClear=c.document.clearVersion;}
  const ids=new Set<string>();for(const s of c.document.screens)for(const node of s.props.children as StatementNode[])if(node.name==='Timer'){ids.add(node.key);timers.ensure(node.key,{label:String(node.props.label),seconds:Number(node.props.seconds)});}
  for(const t of timers.list())if(!ids.has(t.id)){timers.forget(t.id);previousTimers.delete(t.id);}
}
function tick(){const snapshot=timers.list();for(const entry of snapshot){const before=previousTimers.get(entry.id);previousTimers.set(entry.id,{...entry});if(before && before.status!=='done'&&entry.status==='done')c.localEvent(activityClientEvents.finishedTimer(entry.label),false);}updates.forEach(fn=>fn());}
function timerAction(id:string,action:'start'|'pause'|'reset'|'finish'){
  const before=timers.list().find(t=>t.id===id);if(!before||paused)return;
  if(action==='start')timers.start(id);if(action==='pause')timers.pause(id);if(action==='reset')timers.reset(id);if(action==='finish')timers.finish(id);
  const after=timers.list().find(t=>t.id===id)!;previousTimers.set(id,{...after});
  const event=action==='reset'?activityClientEvents.resetTimer(after.label,after.seconds):action==='start'&&before.status==='stopped'?activityClientEvents.startedTimer(after.label,after.seconds):timerTransitionEvent(before,after);
  c.localEvent(event??`Simulated ${action} for ${after.label}.`);tick();
}
function render(){
  if(config){const selected=config.providers.find(p=>p.id===c.provider)!;byId('mode').textContent=c.provider==='mock'?'MOCK · NO MODEL CALLS':selected.enabled?'LIVE WHEN SENT':'SETUP / BLOCKED';byId('mode').dataset.state=c.provider==='mock'?'mock':selected.enabled?'live':'blocked';byId('provider-description').textContent=selected.message;byId('consent-wrap').hidden=c.provider==='mock'||!selected.enabled;byId('consent-label').textContent=c.provider==='claude-cli'?'Use my subscription quota on Send/Retry; I reviewed the host-policy limits.':'Use my API budget on Send/Retry.';byId<HTMLInputElement>('consent').checked=c.consent;byId<HTMLButtonElement>('send').disabled=!selected.enabled||(c.provider!=='mock'&&!c.consent)||paused;byId('mock-controls').hidden=c.provider!=='mock';byId('sample').hidden=c.provider!=='mock';byId('demo-session').hidden=c.provider!=='mock';byId<HTMLButtonElement>('demo-session').disabled=paused;}
  setLabel('send',c.pending?'Send update':'Send');byId<HTMLButtonElement>('cancel').disabled=!c.pending;byId('pending').hidden=!c.pending;byId('status').textContent=c.pending?'Thinking… type an update to interrupt':c.error?'Needs attention':'Ready when you are';byId('error').hidden=!c.error;byId('error-message').textContent=c.error;
  const transcript=byId('transcript');transcript.replaceChildren();if(c.events.length<seenEvents)seenEvents=0;const fresh=(i:number)=>i>=seenEvents?' new':'';
  if(!c.events.length){const n=el('div','','message assistant intro-line new');n.append(el('span','Coach','who'),el('p','Tell me how much simulated time you’ve got — or start the demo session and I’ll run it.'));transcript.append(n);}
  for(const [i,event] of c.events.entries()){if(event.kind==='input'||event.kind==='response'){const n=el('div','','message '+(event.kind==='input'?'user':'assistant')+fresh(i));n.append(el('span',event.kind==='input'?'You':'Coach','who'),el('p',event.text??splitReply(event.result!.turn.reply).prose??''));transcript.append(n);}else if(event.text){const n=el('p','','event'+fresh(i));n.append(el('time',clockTime(event.at)),document.createTextNode(event.text));transcript.append(n);}else if(event.kind==='interrupted'||event.kind==='cancelled')transcript.append(el('p',event.kind==='interrupted'?'Previous reply interrupted. Your messages are kept.':'Reply cancelled.','event'+fresh(i)));}
  seenEvents=c.events.length;
  if(c.pending){const n=el('div','','message assistant typing new'),dots=el('p','','dots');dots.setAttribute('aria-label','Coach is typing');for(let i=0;i<3;i++)dots.append(el('span'));n.append(el('span','Coach','who'),dots);transcript.append(n);}
  transcript.scrollTop=transcript.scrollHeight;syncTimers();
  const screens=c.document.screens,index=screens.findIndex(s=>s.key===c.document.cursor),key=c.document.echo()+String(paused)+c.provider;
  if(key!==renderKey || !byId('screen').childNodes.length){renderKey=key;updates=[];const surface=byId('screen');surface.replaceChildren();const current=c.document.current;
    const entering=!!current&&index!==lastIndex,frame=surface.parentElement!;surface.classList.remove('enter','enter-back');frame.classList.remove('finale');if(entering){void surface.offsetWidth;surface.classList.add(index<lastIndex?'enter-back':'enter');if(index===screens.length-1&&screens.length>1&&index>lastIndex)frame.classList.add('finale');}lastIndex=index;
    if(!current){const n=el('div','','empty'),lanes=el('ol','','lanes');lanes.setAttribute('aria-label','Typical session shape');for(const [i,name] of ['Brief','Round','Round','Recover','Debrief'].entries()){const li=el('li');li.append(el('b',String(i+1).padStart(2,'0')),el('span',name));lanes.append(li);}
      n.append(el('p','No session loaded','kicker'),el('h3','Your workout starts here.'),el('p',c.provider==='mock'?'Five screens, three simulated clocks, one coach. Nothing to lift — you just steer.':'Tell your coach how much simulated time you have and what kind of session you want.','empty-copy'),lanes);
      if(c.provider==='mock'){const go=el('button','Start demo session','primary cta');go.type='button';go.disabled=paused;go.addEventListener('click',()=>send('/workout'));n.append(withIcon(go,'play'));}surface.append(n);}
    else{const props=new Map<string,string>();let i=0;for(const node of current.props.children as StatementNode[]){if(node.name==='Cue')continue;
      const n=renderComponent(node,{send,timers,timerAction,updates,paused,entering}),sig=JSON.stringify(node.props);n.style.setProperty('--i',String(i++));props.set(node.key,sig);
      // A patch on the screen already in view (e.g. "Make it lighter") flashes only the statements it changed.
      if(!entering&&lastProps.size&&lastProps.get(node.key)!==sig&&motion())n.classList.add('updated');surface.append(n);}
      lastProps=props;}
    if(!current)lastProps=new Map();
    const progress=byId('progress');progress.replaceChildren();progress.classList.toggle('enter',entering);if(screens.length>1)for(let i=0;i<screens.length;i++){const n=el('span','',''+(i===index?'active':i<index?'past':''));n.setAttribute('aria-label',`Screen ${i+1}${i===index?', current':''}`);progress.append(n);}
  }
  byId('navigation').hidden=screens.length<2;byId('position').hidden=screens.length<2;byId('position').textContent=`${index+1} / ${screens.length}`;byId<HTMLButtonElement>('back').disabled=paused||index<=0;byId<HTMLButtonElement>('next').disabled=paused;setLabel('next',index===screens.length-1?'Finish preview':'Next');
  byId<HTMLButtonElement>('pause').disabled=!screens.length;setLabel('pause',paused?'Resume preview':'Pause preview');byId('paused').hidden=!paused;
  const cues=(c.document.current?.props.children as StatementNode[]??[]).filter(n=>n.name==='Cue').map(n=>String(n.props.text));const cue=cues.join(' ')||c.document.prose||'Current-screen Cues appear here as text. No audio is produced.',spoken=byId('spoken');spoken.textContent=cue;if(cue!==lastCue){lastCue=cue;spoken.classList.remove('cue-in');void spoken.offsetWidth;spoken.classList.add('cue-in');}
  byId('state-json').textContent=JSON.stringify({ui_state:c.document.echo(),client_events:c.clientEvents,timers:timers.list()},null,2);byId<HTMLButtonElement>('export').disabled=c.pending||!c.events.length;
}
byId<HTMLFormElement>('composer').addEventListener('submit',event=>{event.preventDefault();const text=draft.value.trim();if(text){draft.value='';send(text);}});
draft.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();byId<HTMLFormElement>('composer').requestSubmit();}});
byId('sample').addEventListener('click',()=>send('Load wiring sample'));withIcon(byId<HTMLButtonElement>('demo-session'),'play').addEventListener('click',()=>send('/workout'));byId('cancel').addEventListener('click',()=>c.cancel());byId('retry').addEventListener('click',()=>{if(!paused)void c.retry();});
byId('reset').addEventListener('click',()=>{nav.dispose();paused=false;pausedTimers=[];timers.forget();previousTimers.clear();draft.value='';c.reset();});
byId('back').addEventListener('click',()=>nav.back());byId('next').addEventListener('click',()=>nav.next());
byId('pause').addEventListener('click',()=>{paused=!paused;if(paused){pausedTimers=timers.list().filter(t=>t.status==='running').map(t=>t.id);for(const id of pausedTimers)timers.pause(id);}else{for(const id of pausedTimers)timers.start(id);pausedTimers=[];}c.localEvent(paused?'User paused the preview.':'User resumed the preview.');tick();});
byId<HTMLSelectElement>('provider').addEventListener('change',event=>c.selectProvider((event.target as HTMLSelectElement).value as Provider));
byId<HTMLInputElement>('consent').addEventListener('change',event=>{c.consent=(event.target as HTMLInputElement).checked;if(!c.consent)c.cancel();render();});
byId('apply-patch').addEventListener('click',()=>{try{const raw=byId<HTMLTextAreaElement>('patch').value;c.document.apply(raw.includes('```')?raw:'```openui\n'+raw+'\n```');c.localEvent('Builder applied local OpenUI data: '+raw);byId('patch-status').textContent='Patch accepted. This is local fixture evidence, not a model run.';}catch{byId('patch-status').textContent='Invalid patch. Previous screen kept. Check names, arguments and catalog.';}});
byId('export').addEventListener('click',()=>{const label=byId<HTMLSelectElement>('run-label').value;const payload={format:'aira-workout-run-v1',label,appVersion:APP_VERSION,schemaVersion:SCHEMA_VERSION,selectedProvider:c.provider,note:byId<HTMLTextAreaElement>('note').value,events:c.events,state:{ui_state:c.document.echo(),client_events:c.clientEvents},timers:timers.list()};const url=URL.createObjectURL(new Blob([JSON.stringify(redactValue(payload),null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download=label+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);byId('export-status').textContent=`Downloaded ${label}.json. Review and move it into runs/.`;});
async function start(){render();try{const response=await fetch('/api/config');if(!response.ok)throw new Error();config=await response.json();const select=byId<HTMLSelectElement>('provider');select.replaceChildren();for(const p of config!.providers){const option=el('option',p.label+(p.enabled?'':' · setup / blocked'));option.value=p.id;select.append(option);}select.value='mock';select.disabled=false;render();}catch{byId('status').textContent='Could not connect. Restart the local server and reload.';}}
setInterval(tick,250);void start();
