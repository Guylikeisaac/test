import { el, button } from './dom.js';
import { icon, withIcon } from './icons.js';
import type { StatementNode } from '../shared/openui/openui-model.js';
import type { TimerLedger } from '../shared/openui/timer-store.js';
export type Context = { send: (text:string)=>void; timers: TimerLedger; timerAction: (id:string, action:'start'|'pause'|'reset'|'finish')=>void; updates: (()=>void)[]; paused: boolean; entering: boolean };
const clock = (seconds:number) => `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
export const motion = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
// Rolls an integer ("30", "+120") or clock ("2:15") value up from zero when a screen enters.
function countUp(target:Text, context:Context) {
  const raw=target.data,m=/^([+-]?)(\d{1,5})$/.exec(raw)??/^()(\d{1,3}):(\d{2})$/.exec(raw);if(!m||!context.entering||!motion())return;
  const total=m[3]===undefined?Number(m[2]):Number(m[2])*60+Number(m[3]),format=(v:number)=>m[3]===undefined?m[1]+v:clock(v),began=performance.now();
  const step=(now:number)=>{const t=Math.min(1,(now-began)/750);target.data=t<1?format(Math.round(total*(1-(1-t)**3))):raw;if(t<1)requestAnimationFrame(step);};
  target.data=format(0);requestAnimationFrame(step);
}
const STATUS_LABEL: Record<string,string> = { stopped: 'On your mark', running: 'Clock running', paused: 'Held', done: 'Time' };
// Trusted DOM ports of the source component signatures; no model-generated code.
export const renderers: Record<string,(node:StatementNode,context:Context)=>HTMLElement> = {
  Text: ({props:p}) => el(p.variant==='title'?'h3':p.variant==='subtitle'?'h4':'p',String(p.text),'block block-'+String(p.variant??'body')),
  Keyword: ({props:p},c) => {const n=el('div','','block keyword'),value=el('strong',String(p.text));n.append(value);countUp(value.firstChild as Text,c);if(p.caption)n.append(el('p',String(p.caption)));return n;},
  Alert: ({props:p}) => {const n=el('aside','','block alert alert-'+String(p.tone));n.setAttribute('role','note');n.append(icon(p.tone==='info'?'info':'warning'),el('p',String(p.text)));return n;},
  List: ({props:p},c) => {const items=p.items as StatementNode[];const n=el(items.some(i=>i.props.marker==='numbered')?'ol':'ul','','block list');for(const [i,row] of items.entries()){const li=renderComponent(row,c);li.style.setProperty('--b',String(i));n.append(li);}return n;},
  ListItem: ({props:p}) => el('li',String(p.text),'marker-'+String(p.marker??'bullet')),
  FollowUps: ({props:p},c) => {const n=el('div','','block followups');for(const [i,text] of (p.prompts as string[]).entries()){const chip=withIcon(button(text,()=>c.send(text),'reply'),'next',true);chip.style.setProperty('--b',String(i));n.append(chip);}return n;},
  Metric: ({props:p},c) => {
    const n=el('div','','block metric'),value=el('strong',String(p.value));
    countUp(value.firstChild as Text,c);if(p.unit)value.append(el('span',String(p.unit),'unit'));
    n.append(el('span',String(p.label),'metric-label'),value);return n;
  },
  Effort: ({props:p}) => {
    const level=Number(p.level),label=String(p.label??'Simulated effort'),n=el('div','','block effort'),bar=el('div','','effort-bar');
    for(let i=1;i<=10;i++){const seg=el('span','',i<=level?'on':'');seg.style.setProperty('--b',String(i));bar.append(seg);}
    bar.setAttribute('role','meter');bar.setAttribute('aria-valuemin','1');bar.setAttribute('aria-valuemax','10');bar.setAttribute('aria-valuenow',String(level));bar.setAttribute('aria-label',label);
    const read=el('div','','effort-read');read.append(el('span',label,'effort-label'),el('strong',`${level}/10`));
    n.dataset.level=String(level);n.append(read,bar);return n;
  },
  Timer: ({key,props:p},c) => {
    const n=el('section','','block timer');n.setAttribute('aria-label',String(p.label));
    const head=el('header','','timer-head'),badge=el('span','','timer-badge');badge.setAttribute('aria-hidden','true');head.append(el('h3',String(p.label)),badge);
    const value=el('strong','','timer-value'),track=el('div','','timer-track'),fill=el('div','','timer-fill'),status=el('span','','timer-status');
    track.setAttribute('aria-hidden','true');track.append(fill);
    const meta=el('div','','timer-meta');meta.append(el('span',`of ${clock(Number(p.seconds))}`),el('span','Simulated · local only'));
    const row=el('div','','timer-controls');
    const start=withIcon(button('Start simulation',()=>c.timerAction(key,'start'),'primary'),'play'),pause=withIcon(button('Pause timer',()=>c.timerAction(key,'pause'),'primary'),'pause'),reset=withIcon(button('Reset timer',()=>c.timerAction(key,'reset'),'outline'),'reset'),finish=withIcon(button('Simulate finish',()=>c.timerAction(key,'finish'),'outline'),'flag');
    row.append(start,pause,reset,finish);n.append(head,value,track,meta,row,status);
    const startLabel=start.querySelector('.label')!,pauseLabel=pause.querySelector('.label')!;let lastSeconds=-1,lastStatus='';
    const update=()=>{const entry=c.timers.list().find(t=>t.id===key);if(!entry)return;const seconds=Math.ceil(entry.remaining);
      if(motion()&&lastStatus){
        // Shot-clock theatre: each of the last five running seconds thumps, and reaching zero flashes the block.
        if(entry.status==='running'&&seconds!==lastSeconds&&seconds<=5&&seconds>0)value.animate([{transform:'scale(1.08)',color:'var(--signal)'},{transform:'none'}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});
        if(entry.status==='done'&&lastStatus!=='done')n.animate([{backgroundColor:'rgba(255,91,31,.28)'},{backgroundColor:'rgba(255,91,31,0)'}],{duration:900,easing:'ease-out'});
      }
      lastSeconds=seconds;lastStatus=entry.status;n.toggleAttribute('data-final',entry.status==='running'&&seconds<=5);
      value.textContent=clock(seconds);status.textContent=entry.status;badge.textContent=STATUS_LABEL[entry.status];n.dataset.status=entry.status;
      fill.style.clipPath=`inset(0 ${(100*(1-entry.remaining/entry.seconds)).toFixed(2)}% 0 0)`;
      start.hidden=entry.status==='running'||entry.status==='paused';startLabel.textContent=entry.status==='done'?'Restart simulation':'Start simulation';pause.hidden=entry.status==='stopped'||entry.status==='done';pauseLabel.textContent=entry.status==='paused'?'Resume timer':'Pause timer';for(const b of [start,pause,reset,finish])b.disabled=c.paused;};
    c.updates.push(update);update();return n;
  },
};
export function renderComponent(node:StatementNode,context:Context):HTMLElement {
  if(!Object.hasOwn(renderers,node.name))throw new Error('No renderer for '+node.name);
  const n=renderers[node.name](node,context);n.dataset.statement=node.key;
  if(typeof node.props.color==='string' && /^#[0-9a-fA-F]{6}$/.test(node.props.color))n.style.color=node.props.color;
  return n;
}
