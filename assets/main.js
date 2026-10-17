const $=s=>document.querySelector(s);
const tok=v=>getComputedStyle(document.documentElement).getPropertyValue(v).trim();

// Progressive MP4 playback starts as soon as the browser has a few frames.
// Auto uses the web preview; HD preserves the original video and sound.
(function(){const v=$('#film'),p=$('#filmPlay'),sound=$('#filmSound');
  const ip='<svg viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5v11l9-5.5z"/></svg>',ipa='<svg viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="3.5" height="12" rx="1"/><rect x="8.5" y="1" width="3.5" height="12" rx="1"/></svg>';
  const on='<svg viewBox="0 0 14 14" fill="currentColor"><path d="M1 5h3l4-3v10L4 9H1z"/><path d="M10 4.5a3.5 3.5 0 0 1 0 5M11.5 3a5.5 5.5 0 0 1 0 8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',off=sound.innerHTML;
  let mode='teaser';const LEN={teaser:29.87,full:115.7};
  XPVideo.setSource(v,'media/teaser.mp4');
  p.onclick=()=>v.paused?XPVideo.play(v):XPVideo.pause(v);
  sound.onclick=()=>{v.muted=!v.muted;sound.innerHTML=v.muted?off:on;sound.setAttribute('aria-label',v.muted?'Unmute':'Mute');if(!v.muted&&v.paused)XPVideo.play(v)};
  const button=()=>{p.innerHTML=v.paused?ip:ipa;p.setAttribute('aria-label',v.paused?'Play':'Pause')};
  v.addEventListener('play',button);v.addEventListener('pause',button);button();
  const seek=$('#filmSeek'),time=$('#filmTime');
  const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const show=()=>{const d=v.duration||LEN[mode],t=XPVideo.time(v);seek.value=Math.round(t/d*1000);seek.style.setProperty('--p',(t/d*100)+'%');time.textContent=`${fmt(t)} / ${fmt(d)}`};
  v.addEventListener('timeupdate',show);v.addEventListener('loadedmetadata',show);
  seek.addEventListener('input',()=>{XPVideo.seek(v,seek.value/1000*(v.duration||LEN[mode]));show()});
  const pick=[...document.querySelectorAll('#filmPick button')];
  pick.forEach(b=>b.addEventListener('click',()=>{if(b.dataset.film===mode)return;
    pick.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));mode=b.dataset.film;
    XPVideo.poster(v,mode==='teaser'?'assets/teaser-poster.jpg':'assets/film-poster.jpg');
    v.setAttribute('aria-label',mode==='teaser'?'Xperience-0 highlights':'Xperience-0 video');
    XPVideo.setSource(v,mode==='teaser'?'media/teaser.mp4':'media/film-hd.mp4');show();
  }));
})();

function vid(src,label,cls=''){
  return `<div class="media ${cls}"><video data-auto muted loop playsinline preload="none" data-poster="media/${src}.jpg" data-src="media/${src}.mp4" aria-label="${label||'clip'}"></video>${label?`<span class="tag">${label}</span>`:''}</div>`;
}
$('#longgrid').innerHTML=['Put a drink in the fridge','Collect the garbage','Arrange the fruit bucket','Sweep the bed','Collect toys from the bed','Collect fruit from the closet','Take from the upper fridge','Pick up the bok choy'].map((l,i)=>vid('long_'+i,l,'r43')).join('');
const longTiles=[...$('#longgrid').children];
const longVideos=()=>longTiles.filter(tile=>!tile.hidden).map(tile=>tile.querySelector('video'));
longTiles.forEach((tile,i)=>tile.hidden=i>=4);
document.querySelectorAll('#longgrid video').forEach(XPVideo.register);
document.querySelectorAll('#longPages button').forEach((button,page)=>button.addEventListener('click',()=>{
  if(button.getAttribute('aria-pressed')==='true')return;
  const held=longVideos().every(v=>v.dataset.held);
  document.querySelectorAll('#longPages button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  longTiles.forEach((tile,i)=>tile.hidden=Math.floor(i/4)!==page);
  $('#longgrid').scrollLeft=0;
  longVideos().forEach(v=>held?XPVideo.pause(v):XPVideo.play(v));
  longVideos()[0].dispatchEvent(new Event('timeupdate'));
  XPVideo.refresh();
}));
// Live sessions, grouped by what the model renders on the screen: a robot's view or a person's (full 1080p recordings, all at 1×).
{const L={Robot:[0,1,2],Human:[3,5,6]},v=$('#wallMain');let kind='Robot';
  const seg=(el,items,on)=>{el.innerHTML=items.map((t,i)=>`<button type="button" aria-pressed="${i===0}">${t}</button>`).join('');
    [...el.children].forEach((b,i)=>b.addEventListener('click',()=>{[...el.children].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));on(i)}))};
  const load=k=>{const f=L[kind][k];XPVideo.poster(v,`media/live_${f}.jpg`);XPVideo.setSource(v,`media/live_${f}.mp4`);v.setAttribute('aria-label',`Live VR session: ${kind.toLowerCase()} view ${k+1}`);XPVideo.play(v)};
  const sessions=()=>seg($('#liveSeg'),L[kind].map((_,k)=>`Session ${k+1}`),load);
  seg($('#liveKind'),Object.keys(L),i=>{kind=Object.keys(L)[i];sessions();load(0)});sessions();}
// Real-robot runs: pick a task; the synchronised external and robot views play side by side.
// Each task is [button label, clip number in media/rr*].
{const T=[['Teddy into basket',1],['Orange onto tray',3],['Snack into basket',2],['Octopus into basket',0],['Cloth into basket',4],['Cloth into bag',5]],ext=$('#rrExt'),ego=$('#rrEgo');
  $('#rrTask').innerHTML=T.map(([t],i)=>`<button type="button" aria-pressed="${i===0}">${t}</button>`).join('');
  [...$('#rrTask').children].forEach((b,i)=>b.addEventListener('click',()=>{[...$('#rrTask').children].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    const [t,k]=T[i];
    for(const [v,s] of [[ext,'ext'],[ego,'ego']]){XPVideo.poster(v,`media/rr${k}_${s}.jpg`);XPVideo.setSource(v,`media/rr${k}_${s}.mp4`);XPVideo.play(v)}
    $('#rrExtTag').textContent=`${t} · External`;$('#rrPlay').textContent='❚❚';$('#rrPlay').setAttribute('aria-label','Pause')}));
  scrubber(()=>[ext,ego],$('#rrRange'),$('#rrPlay'),$('#rrLbl'),f=>{const d=ext.duration||0;return `${(f*d).toFixed(1)} s / ${d.toFixed(1)} s`});}

// Shared timelines update on media events instead of running idle animation loops.
function scrubber(videos,range,btn,lbl,fmt){
  const update=()=>{const v=videos()[0];if(!v)return;
    const f=v.duration?XPVideo.time(v)/v.duration:0;
    range.value=Math.round(f*1000);range.style.setProperty('--p',(f*100)+'%');lbl.textContent=fmt(f);
    btn.textContent=v.paused?'▶':'❚❚';btn.setAttribute('aria-label',v.paused?'Play':'Pause');
  };
  const host=range.closest('.experiment,figure');
  ['timeupdate','loadedmetadata','play','pause','emptied'].forEach(event=>host.addEventListener(event,update,true));
  range.addEventListener('input',()=>{const f=range.value/1000,vs=videos(),D=vs[0]?.duration;
    vs.forEach(v=>{XPVideo.pause(v);if(D||v.duration)XPVideo.seek(v,(f*(D||v.duration)*.999)%(v.duration||Infinity))});
    range.style.setProperty('--p',(f*100)+'%');lbl.textContent=fmt(f);
  });
  btn.addEventListener('click',()=>{const vs=videos(),resume=vs[0]?.paused,t=vs[0]?XPVideo.time(vs[0]):0;
    vs.forEach(v=>{if(resume){XPVideo.seek(v,t%(v.duration||Infinity));XPVideo.play(v)}else XPVideo.pause(v)});
  });
  update();
}
scrubber(longVideos,$('#longRange'),$('#longPlay'),$('#longLbl'),f=>`${(f*32).toFixed(1)} s / 32.0 s`);
// Join the shared timeline only when the target frames are buffered. Seeking ahead of
// a newly started tile's download would create another network stall.
{const lv=[...document.querySelectorAll('#longgrid video')];let leader=null;
  const sync=v=>{
    const shown=longVideos();
    if(!shown.includes(v)||v.paused||v.seeking||v.readyState<3)return;
    if(!shown.includes(leader)||leader.paused||leader.seeking||leader.readyState<3)leader=shown.find(o=>!o.paused&&!o.seeking&&o.readyState>=3);
    if(!leader||leader===v||Math.abs(leader.currentTime-v.currentTime)<=.4)return;
    const t=leader.currentTime;
    for(let k=0;k<v.buffered.length;k++)if(v.buffered.start(k)<=t&&v.buffered.end(k)>=Math.min(t+.3,v.duration)){XPVideo.seek(v,t);break}
  };
  lv.forEach(v=>['playing','progress'].forEach(event=>v.addEventListener(event,()=>sync(v))));}

// Long-horizon drag the hand: wrist tracks (15 fps) index the plain rollout and the condition panels.
(function(){
  const TASKS=[['fruit','Arrange the fruit bucket'],['toys','Collect toys from the bed'],['fridge','Put a drink in the fridge']];
  const view=$('#ldView'),act=$('#ldAct'),out=$('#ldOut'),a=act.getContext('2d'),o=out.getContext('2d'),S=act.width/640;
  const vO=$('#ldV'),vC=$('#ldC'),range=$('#ldRange'),btn=$('#ldPlay'),coach=$('#ldCoach'),lime='#c3f293',night='#101114';
  const cam=$('#ldCam').getContext('2d'),pose=$('#ldPose').getContext('2d');
  let D=null,first=new Image(),i=0,hand='right',seekBusy=false,want=null,playing=false;
  let selected='fruit',onScreen=false,loaded=false,controller=null,raf=0;
  const t=()=>D?Math.min(D.n-1,i):0;
  function drawAct(){
    if(!D)return;a.fillStyle=night;a.fillRect(0,0,act.width,act.height);
    if(first.complete&&first.naturalWidth){a.globalAlpha=.42;a.drawImage(first,0,0,act.width,act.height);a.globalAlpha=1}
    a.lineCap='round';a.lineJoin='round';
    for(const [h,tr] of Object.entries(D.tracks)){
      const P=tr.path,V=tr.visible,col=h==='right'?lime:'#8fe3ff';
      a.setLineDash([3,10]);a.strokeStyle=col;a.globalAlpha=h===hand?.32:.16;a.lineWidth=2;a.beginPath();
      P.forEach(([x,y],k)=>{if(!V[k]){a.moveTo(x*S,y*S);return}k&&V[k-1]?a.lineTo(x*S,y*S):a.moveTo(x*S,y*S)});a.stroke();
      a.setLineDash([]);a.globalAlpha=h===hand?1:.4;a.lineWidth=5;a.beginPath();
      const from=Math.max(0,t()-45);for(let k=from;k<=t();k++){const [x,y]=P[k];if(!V[k]){a.moveTo(x*S,y*S);continue}k>from&&V[k-1]?a.lineTo(x*S,y*S):a.moveTo(x*S,y*S)}a.stroke();
      const [hx,hy]=P[t()];const vis=V[t()];a.globalAlpha=vis?1:.35;
      a.beginPath();a.arc(hx*S,hy*S,24,0,7);a.fillStyle=h===hand?'rgba(195,242,147,.25)':'rgba(143,227,255,.2)';a.fill();
      a.beginPath();a.arc(hx*S,hy*S,13,0,7);a.fillStyle=col;a.fill();a.lineWidth=4;a.strokeStyle=night;a.stroke();a.globalAlpha=1;
      if(h===hand){coach.style.left=(hx/640*100)+'%';coach.style.top=(hy/480*100)+'%'}
    }
    // the two conditions, cropped from the overlay render, in their own panels below the action
    if(vC.readyState>=2){cam.drawImage(vC,0,0,220,150,0,0,440,300);pose.drawImage(vC,220,0,220,150,0,0,440,300)}
    range.value=t();range.style.setProperty('--p',(t()/Math.max(1,D.n-1)*100)+'%');$('#ldLbl').textContent=`${(t()/D.fps).toFixed(1)} s / ${((D.n-1)/D.fps).toFixed(1)} s`;
  }
  function drawOut(){if(vO.readyState>=2)o.drawImage(vO,0,0,out.width,out.height)}
  function seek(k){if(!loaded)return;want=k;if(seekBusy)return;seekBusy=true;const go=want;want=null;const tt=(go+.5)/D.fps;
    let n=0;const done=()=>{if(++n<2)return;drawOut();drawAct();seekBusy=false;if(want!==null)seek(want)};
    [vO,vC].forEach(v=>{if(Math.abs(v.currentTime-tt)<.001){done();return}v.addEventListener('seeked',done,{once:true,signal:controller.signal});v.currentTime=tt});
  }
  const stop=()=>{playing=false;cancelAnimationFrame(raf);vO.pause();vC.pause();btn.textContent='▶';btn.setAttribute('aria-label','Play')};
  function set(k){if(!D||!loaded)return;i=Math.max(0,Math.min(D.n-1,k));drawAct();seek(i)}
  function release(){stop();controller?.abort();controller=null;loaded=false;seekBusy=false;want=null;
    btn.disabled=range.disabled=true;
    [vO,vC].forEach(v=>{v.removeAttribute('src');v.preload='none';v.load()});
  }
  async function load(name,resume=false){
    release();selected=name;if(!onScreen||document.hidden)return;
    const current=new AbortController();controller=current;const {signal}=current;
    try{
      const d=window.XP_LD?.[name]||await fetch(`media/ld_${name}.json`,{signal}).then(r=>{if(!r.ok)throw new Error('Track unavailable');return r.json()});
      if(signal.aborted)return;D=d;hand='right';range.max=D.n-1;
      first=new Image();first.onload=()=>{if(!signal.aborted)drawAct()};first.src=`media/ld_${name}_first.jpg`;
      if(!resume)i=Math.round(D.n*.18);drawAct();
      await Promise.all([[vO,`media/ld_${name}.mp4`],[vC,`media/ld_${name}_cond.mp4`]].map(([v,src])=>new Promise((resolve,reject)=>{
        v.addEventListener('loadeddata',resolve,{once:true,signal});
        v.addEventListener('error',()=>reject(new Error('Video unavailable')),{once:true,signal});
        signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});
        v.preload='auto';v.src=src;
      })));
      if(signal.aborted)return;loaded=true;btn.disabled=range.disabled=false;set(i);
    }catch(error){if(signal.aborted)return;release();$('#ldLbl').textContent='Video could not load. Choose a task to retry.'}
  }
  const pt=e=>{const r=view.getBoundingClientRect();return[(e.clientX-r.left)/r.width*640,(e.clientY-r.top)/r.height*480]};
  function nearest([x,y],h,win){const tr=D.tracks[h];let best=-1,bd=1e12;const scan=(p,q)=>{for(let k=Math.max(0,p);k<=Math.min(D.n-1,q);k++){if(!tr.visible[k])continue;const d=(tr.path[k][0]-x)**2+(tr.path[k][1]-y)**2;if(d<bd){bd=d;best=k}}};
    if(win){scan(i-win,i+win);if(bd<=50*50)return[best,bd]}scan(0,D.n-1);return[best,bd]}
  view.addEventListener('pointerdown',e=>{if(!loaded)return;stop();coach.style.opacity=0;view.setPointerCapture(e.pointerId);
    const p=pt(e);let pick=hand,bd=1e12;for(const h of Object.keys(D.tracks)){const [x,y]=D.tracks[h].path[t()];const d=(x-p[0])**2+(y-p[1])**2;if(d<bd){bd=d;pick=h}}hand=pick;
    const [k]=nearest(p,hand,25);if(k>=0)set(k);e.preventDefault()});
  view.addEventListener('pointermove',e=>{if(loaded&&view.hasPointerCapture(e.pointerId)){const [k]=nearest(pt(e),hand,25);if(k>=0&&k!==i)set(k)}});
  view.tabIndex=0;view.addEventListener('keydown',e=>{if(!loaded)return;const s=e.shiftKey?15:1;if(e.key==='ArrowRight'||e.key==='ArrowUp')set(i+s);else if(e.key==='ArrowLeft'||e.key==='ArrowDown')set(i-s);else return;stop();coach.style.opacity=0;e.preventDefault()});
  range.addEventListener('input',()=>{stop();coach.style.opacity=0;set(+range.value)});
  btn.addEventListener('click',()=>{if(!loaded)return;if(playing){stop();return}coach.style.opacity=0;if(i>=D.n-2)set(0);
    playing=true;btn.textContent='❚❚';btn.setAttribute('aria-label','Pause');
    Promise.all([vO.play(),vC.play()]).then(()=>{if(playing)raf=requestAnimationFrame(loop)}).catch(stop);
  });
  function loop(){if(!playing||!loaded)return;i=Math.min(D.n-1,Math.floor(vO.currentTime*D.fps));
    if(Math.abs(vC.currentTime-vO.currentTime)>.1&&!vC.seeking)vC.currentTime=vO.currentTime;
    drawOut();drawAct();if(vO.ended||i>=D.n-1)stop();else raf=requestAnimationFrame(loop);
  }
  const seg=$('#ldTask');seg.innerHTML=TASKS.map(([k,l],j)=>`<button type="button" aria-pressed="${j===0}">${l}</button>`).join('');
  [...seg.children].forEach((b,j)=>b.addEventListener('click',()=>{[...seg.children].forEach(x=>x.setAttribute('aria-pressed',x===b));load(TASKS[j][0])}));
  btn.disabled=range.disabled=true;
  const activate=()=>{if(onScreen&&!document.hidden){if(!controller)load(selected,!!D)}else release()};
  new IntersectionObserver(es=>{onScreen=es[0].isIntersecting;activate()}).observe($('#rollout'));
  document.addEventListener('visibilitychange',activate);

})();

// Compare strips: each clip already holds ground truth | Xperience-0 | Cosmos 3-Nano | Cosmos 3-Super side by side; show it whole and label each panel.
// Two kinds of clip, each with its own caption: ω-HOME, a benchmark no model was trained on (all zero-shot); and held-out clips from eight
// robot datasets, with Cosmos 3 fine-tuned on the same robot mixture that Xperience-0 sees in mid-training (neither is trained on these clips).
(function(){
  const COLS=['Ground truth','Xperience-0','Cosmos 3-Nano','Cosmos 3-Super'];
  const CAP={omega:'<b>Zero-shot</b> on ω-HOME, which no model was trained on. Input skeleton drawn over each generated video; PSNR (dB) per clip.',
             xemb:'Held-out clip. Xperience-0 saw this robot\'s data in <b>mid-training</b>; Cosmos 3 was <b>fine-tuned</b> on it. Input skeleton drawn over each generated video; PSNR (dB) per clip.'};
  // Pick a dataset, then one of its tasks (ω-HOME has eight; each other robot dataset has one).
  const om=(name,f,p)=>({name,f,p,kind:'omega',w:1938,h:328,gap:6}),xe=(name,f,p)=>({name,f,p,kind:'xemb',w:1280,h:240,gap:0});
  const D=[['ω-HOME',[om('Arrange the fruit bucket','cmp_0',[19.5,14.2,14.7]),om('Collect toys from the bed','cmp_2',[20.0,16.7,15.7]),om('Take from the upper fridge','cmp_3',[19.8,16.4,16.5]),
      om('Push the chair','cmp_5',[21.6,14.1,14.8]),om('Push the chair with both hands','cmp_6',[18.7,12.8,12.6]),om('Put the apple in the fruit basket','cmp_7',[21.5,15.9,16.3]),
      om('Sort fruit from office supplies','cmp_8',[23.9,17.5,16.4]),om('Brush the toilet','cmp_4',[15.5,14.1,14.5])]],
    ['Fourier',[xe('Put the tape in the bag','cmp_x0',[20.2,15.6,15.5])]],['GR-1',[xe('Put the pear on the lower shelf','cmp_x4',[21.1,15.9,15.9])]],
    ['AgiBot',[xe('Grab the desk fan','cmp_x1',[28.6,22.6,21.4])]],['Baihu',[xe('Put the hot dog in the bowl','cmp_x5',[26.2,22.0,21.8])]],
    ['Dexora',[xe('Line up the fruit','cmp_x6',[22.8,15.8,16.2])]],['RH20T',[xe('Turn the steering wheel','cmp_x7',[33.2,23.3,22.5])]],
    ['DROID',[xe('Close the door','cmp_x2',[31.2,23.2,22.7])]],['Ψ0',[xe('Push the cart','cmp_x3',[21.3,16.1,17.3])]]];
  const v=$('#cmpVideo'),box=$('#cmp .cmpstrip'),lab=$('#cmpLabels'),med=$('#cmp .cmp-media');let ds=0,scene=0;const cur=()=>D[ds][1][scene];
  const seg=(el,items,on)=>{el.innerHTML=items.map((t,i)=>`<button type="button" aria-pressed="${i===0}">${t}</button>`).join('');
    [...el.children].forEach((b,i)=>b.addEventListener('click',()=>{[...el.children].forEach(x=>x.setAttribute('aria-pressed',x===b));on(i)}))};
  const tasks=()=>seg($('#cmpScene'),D[ds][1].map(c=>c.name),i=>load(i));
  seg($('#cmpGroup'),D.map(d=>d[0]),i=>{ds=i;tasks();load(0)});tasks();
  function caption(){$('#cmpCap').innerHTML=CAP[cur().kind]}
  function show(){const c=cur();med.style.aspectRatio=`${c.w}/${c.h}`;lab.style.gridTemplateColumns=`repeat(${COLS.length},minmax(0,1fr))`;lab.style.columnGap=`${c.gap/c.w*100}%`;
    lab.innerHTML=COLS.map((n,i)=>`<span class="${i===1?'ours':''}">${n}${i?`<b>${c.p[i-1].toFixed(1)} dB</b>`:''}</span>`).join('');caption()}
  function load(i){scene=i;const f=cur().f;XPVideo.poster(v,`media/${f}.jpg`);XPVideo.setSource(v,`media/${f}.mp4`);show()}
  box.style.setProperty('--strip-min','720px');load(0);
})();

// Adapting to a new robot: one clip per task, ground truth then Xperience-0 at three post-training budgets.
{const T=['Collect toys from the bed','Wipe the table','Arrange the fruit bucket','Put the towel in the washing machine'],v=$('#adVideo'),lab=$('#adLabels');
  lab.style.gridTemplateColumns='repeat(4,minmax(0,1fr))';
  lab.innerHTML=['Ground truth','Xperience-0 · zero-shot','Xperience-0 · few-shot','Xperience-0 · 1-epoch'].map((n,i)=>`<span class="${i?'ours':''}">${n}</span>`).join('');
  $('#adTask').innerHTML=T.map((t,i)=>`<button type="button" aria-pressed="${i===0}">${t}</button>`).join('');
  [...$('#adTask').children].forEach((b,i)=>b.addEventListener('click',()=>{[...$('#adTask').children].forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
    XPVideo.poster(v,`media/lib/adp${i}.jpg`);XPVideo.setSource(v,`media/lib/adp${i}.mp4`);XPVideo.play(v)}));}

// Charts
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs,parent,text){const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(text!=null)n.textContent=text;parent&&parent.appendChild(n);return n}
const DD={b:['In-lab','EgoDex','DreamDojo-HV'],c:['--g1','--g2','--bar-soft','--bar-strong'],v:{'100%':[[21.114,21.413,21.738,23.217],[20.411,20.525,21.23,22.731],[18.813,18.924,19.814,21.086]],'10%':[[19.238,19.348,21.021,23.151],[19.091,19.057,20.776,22.485],[17.21,17.511,19.29,20.929]],'1%':[[18.84,18.983,20.854,23.028],[18.584,18.07,20.569,22.354],[16.996,16.643,19.045,20.788]]}};
function drawDD(b){const s=$('#dd-svg');s.innerHTML='';const y0=258,y1=26,lo=16,hi=24,sy=v=>y0-(v-lo)/(hi-lo)*(y0-y1);
  for(let v=lo;v<=hi;v+=2){el('line',{x1:40,x2:950,y1:sy(v),y2:sy(v),stroke:tok(v===lo?'--g2':'--line')},s);el('text',{x:32,y:sy(v)+4,'text-anchor':'end',class:'d'},s,v)}
  DD.b.forEach((name,j)=>{const x0=70+j*300,vals=DD.v[b][j];vals.forEach((v,k)=>{const x=x0+k*62;el('rect',{x,y:sy(v),width:46,height:y0-sy(v),rx:3,fill:tok(DD.c[k]),stroke:k===2?tok('--lime'):'none'},s);el('text',{x:x+23,y:sy(v)-8,'text-anchor':'middle',class:k===3?'a':'v','font-size':12},s,v.toFixed(2))});
    el('text',{x:x0+116,y:y0+26,'text-anchor':'middle',class:'v','font-size':14},s,name);el('text',{x:x0+116,y:y0+46,'text-anchor':'middle',class:'a','font-size':12.5},s,`+${(vals[3]-Math.max(vals[0],vals[1])).toFixed(2)} dB vs best DreamDojo`)})}
document.querySelectorAll('#dd .seg button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#dd .seg button').forEach(x=>x.setAttribute('aria-pressed',x===btn));drawDD(btn.dataset.b)}));
let ddB='1%';const drawDD0=drawDD;drawDD=b=>{ddB=b;drawDD0(b)};drawDD('1%');
// Scaling trends at the four pre-training checkpoints (hours of human video, log axis), with a power-law fit y = a·D^b
// computed from the plotted points (it matches the fits reported in the paper's Figs. 6–8).
const HOURS=[180,990,2520,9990];
function powerFit(ys){const X=HOURS.map(Math.log),Y=ys.map(Math.log),n=X.length,mx=X.reduce((a,b)=>a+b)/n,my=Y.reduce((a,b)=>a+b)/n;
  const b=X.reduce((s,x,i)=>s+(x-mx)*(Y[i]-my),0)/X.reduce((s,x)=>s+(x-mx)**2,0),a=Math.exp(my-b*mx),ybar=ys.reduce((p,q)=>p+q)/n;
  const r2=1-ys.reduce((s,y,i)=>s+(y-a*HOURS[i]**b)**2,0)/ys.reduce((s,y)=>s+(y-ybar)**2,0);return{a,b,r2}}
const phoneCharts=matchMedia('(max-width: 640px)');   // the same breakpoint where site.css puts the scaling charts two to a row
function drawScaling(id,vals,lo,hi,ticks,fmt,name){const s=$(id);s.innerHTML='';
  // Phones show the charts two to a row, so each is drawn compact on a smaller canvas: larger type, start and end values only, a shorter axis title.
  const c=phoneCharts.matches;s.setAttribute('viewBox',c?'0 0 200 176':'0 0 300 196');
  const x0=c?46:44,x1=c?190:280,y0=c?118:146,y1=c?20:22,L0=Math.log10(150),L1=Math.log10(12000),
    lx=h=>x0+(Math.log10(h)-L0)/(L1-L0)*(x1-x0),sy=v=>y0-(v-lo)/(hi-lo)*(y0-y1),rise=vals[3]>vals[0],col=tok('--bar-strong'),f=powerFit(vals);
  (c&&ticks.length>3?ticks.filter((t,i)=>i%2===0):ticks).forEach(t=>{el('line',{x1:x0-(c?4:8),x2:x1+(c?4:8),y1:sy(t),y2:sy(t),stroke:tok('--line')},s);el('text',{x:x0-(c?8:14),y:sy(t)+(c?5:4),'text-anchor':'end',class:'d','font-size':c?14:11},s,fmt.tick?fmt.tick(t):t)});
  HOURS.forEach((h,i)=>{el('line',{x1:lx(h),x2:lx(h),y1:y1-6,y2:y0+(c?6:10),stroke:tok('--line'),'stroke-dasharray':'2 3'},s);el('text',{x:lx(h),y:y0+(c?24:27),'text-anchor':'middle',class:'d','font-size':c?13:10.5},s,['180','990','2.5k','10k'][i])});
  el('line',{x1:x0-(c?4:8),x2:x1+(c?4:8),y1:y0+(c?6:10),y2:y0+(c?6:10),stroke:tok('--g2')},s);
  el('text',{x:(x0+x1)/2,y:y0+(c?46:46),'text-anchor':'middle',class:'d','font-size':c?12.5:10.5},s,c?'human hours (log)':'pre-training human hours (log scale)');
  // dashed fit across the axis, clipped to the plot
  const fx=[];for(let k=0;k<=24;k++){const h=10**(L0+(L1-L0)*k/24),v=f.a*h**f.b;if(v>=lo&&v<=hi)fx.push(`${lx(h)},${sy(v)}`)}
  el('polyline',{points:fx.join(' '),fill:'none',stroke:tok('--g2'),'stroke-width':1.3,'stroke-dasharray':'5 4'},s);
  const pts=HOURS.map((h,i)=>`${lx(h)},${sy(vals[i])}`).join(' ');
  el('polyline',{points:pts,fill:'none',stroke:tok('--lime'),'stroke-width':c?6:7,'stroke-linejoin':'round','stroke-linecap':'round'},s);
  el('polyline',{points:pts,fill:'none',stroke:col,'stroke-width':c?2.2:2.5,'stroke-linejoin':'round','stroke-linecap':'round'},s);
  HOURS.forEach((h,i)=>{const last=i===3,x=lx(h),y=sy(vals[i]);
    el('circle',{cx:x,cy:y,r:last?(c?4.5:5.5):(c?3:3.5),fill:col,stroke:tok('--card'),'stroke-width':1.5},s);
    if(c){if(i===0)el('text',{x:x+6,y:rise?y+20:y-9,'text-anchor':'start',class:'v','font-size':15},s,fmt(vals[i]));
      else if(last)el('text',{x:x+6,y:y-11,'text-anchor':'end',class:'v','font-size':17,style:`fill:${col};font-weight:700`},s,fmt(vals[i]));return}
    el('text',Object.assign(i===0?{x:x+7,y:rise?y+15:y-8,'text-anchor':'start'}:{x,y:rise?y-(last?11:9):y+(last?21:17),'text-anchor':'middle'},{class:'v','font-size':last?13:11},last?{style:`fill:${col};font-weight:700`}:{}),s,fmt(vals[i]))});
}
function drawCharts(){drawDD(ddB);drawScalingAll();drawPolicy()}
function drawScalingAll(){
drawScaling('#sc2',[2.21,1.91,1.83,1.79],1.7,2.3,[1.8,2.0,2.2],Object.assign(v=>v.toFixed(2),{tick:t=>t.toFixed(1)}),'ATE');
drawScaling('#sc3',[82.0,82.6,82.9,83.6],81.6,84.2,[82,83,84],v=>v.toFixed(1),'PCK');
drawScaling('#sc0',[19.81,21.01,21.40,21.74],19.3,22.3,[20,21,22],v=>v.toFixed(2),'PSNR');
drawScaling('#sc1',[.427,.388,.374,.365],.35,.445,[.36,.38,.40,.42,.44],v=>v.toFixed(3),'LPIPS')}
function drawPolicy(){const s=$('#ev');s.innerHTML='';$('#pl').innerHTML='';const P=[['RoboTwin 2.0 · π0.5 · r = 0.984',[[5.2,15],[20.2,30],[71.9,58],[78.1,75],[92.9,85]]],['Unitree G1 · Ψ0 · r = 0.996',[[11.9,7],[35.1,27],[47.9,45],[89.9,100,'Teleop']]]];   // G1: three Ψ0 checkpoints plus a teleoperation reference (paper Fig. 9b)
  P.forEach(([name,pts],i)=>{const x0=40+i*250,w=200,y0=250,h=200,sx=v=>x0+v/100*w,sy=v=>y0-v/100*h;
    [0,50,100].forEach(t=>{el('line',{x1:x0,x2:x0+w,y1:sy(t),y2:sy(t),stroke:tok(t?'--line':'--g2')},s);el('text',{x:x0-8,y:sy(t)+4,'text-anchor':'end',class:'d'},s,t);el('text',{x:sx(t),y:y0+18,'text-anchor':'middle',class:'d'},s,t)});
    el('line',{x1:x0,y1:y0,x2:x0+w,y2:y0-h,stroke:tok('--g2'),'stroke-dasharray':'6 5','stroke-width':1.5},s);pts.forEach(([x,y,ref])=>{if(ref){el('circle',{cx:sx(x),cy:sy(y),r:5.5,fill:'none',stroke:tok('--g2'),'stroke-width':2,'stroke-dasharray':'2.5 2'},s);el('text',{x:sx(x)-11,y:sy(y)+4,'text-anchor':'end',class:'d','font-size':11},s,`${ref} (reference)`)}else el('circle',{cx:sx(x),cy:sy(y),r:5.5,fill:tok('--lime'),stroke:tok('--bar-strong'),'stroke-width':2},s)});
    el('text',{x:x0,y:y0-h-14,class:'v','font-size':13},s,name);el('text',{x:x0+w/2,y:y0+36,'text-anchor':'middle',class:'d'},s,'predicted');el('text',{x:x0-30,y:y0-h/2,'text-anchor':'middle',class:'d',transform:`rotate(-90 ${x0-30} ${y0-h/2})`},s,'real')});
  const q=$('#pl'),B=[['RoboTwin 2.0',[15,30,58,75,85],53,92],['Unitree G1',[7,27,45],26,55]];
  B.forEach(([name,pols,rand,plan],i)=>{const x0=40+i*250,w=210,y0=250,h=200,sy=v=>y0-v/100*h,bars=[...pols.map((v,k)=>[String(k+1),v,'--g1']),['Rand',rand,'--g2'],['Plan',plan,'--bar-strong']],bw=w/bars.length;
    [0,50,100].forEach(t=>{el('line',{x1:x0,x2:x0+w,y1:sy(t),y2:sy(t),stroke:tok(t?'--line':'--g2')},q);el('text',{x:x0-8,y:sy(t)+4,'text-anchor':'end',class:'d'},q,t+'%')});
    bars.forEach(([l,v,c],k)=>{const x=x0+k*bw+bw*.17,last=k===bars.length-1;el('rect',{x,y:sy(v),width:bw*.66,height:y0-sy(v),rx:2,fill:tok(c)},q);el('text',{x:x+bw*.33,y:sy(v)-6,'text-anchor':'middle',class:last?'a':'v','font-size':11.5},q,v);el('text',{x:x+bw*.33,y:y0+16,'text-anchor':'middle',class:last?'a':'d','font-size':10.5},q,l)});
    el('text',{x:x0+(pols.length*bw)/2,y:y0+32,'text-anchor':'middle',class:'d','font-size':10},q,'checkpoint');el('text',{x:x0,y:y0-h-14,class:'v','font-size':13},q,`${name} · +${plan-Math.max(...pols)} pp over best`)})}
drawCharts();
// Redraw when the layout crosses into or out of the compact phone form (the media query's change event, with resize as a fallback).
{let was=phoneCharts.matches;const sync=()=>{if(phoneCharts.matches!==was){was=phoneCharts.matches;drawScalingAll()}};phoneCharts.addEventListener('change',sync);addEventListener('resize',sync)}
// Copy button for the BibTeX block (#bib, #copyBib); does nothing until the entry commented out in index.html is restored.
$('#copyBib')?.addEventListener('click',e=>{const b=e.currentTarget,t=$('#bib').textContent;navigator.clipboard.writeText(t).then(()=>{b.textContent='✓'},()=>{const r=document.createRange();r.selectNodeContents($('#bib'));const s=getSelection();s.removeAllRanges();s.addRange(r);b.textContent='⌘C'});setTimeout(()=>b.textContent='⧉',1800)});

// Follow the reading position, including jumps that skip an observer's narrow band.
(function(){
  const entries=[...document.querySelectorAll('.chapter-nav .toc a[href^="#"]')].map(link=>({link,heading:document.querySelector(link.getAttribute('href'))})).filter(e=>e.heading);
  const label=$('#tocCurrent'),toggle=$('#tocToggle'),list=$('#tocList');
  let active=null,queued=false;
  function update(){
    queued=false;let current=null;const edge=Math.max(140,innerHeight*.25);
    for(const entry of entries){if(entry.heading.getBoundingClientRect().top<=edge)current=entry;else break}
    if(innerHeight+scrollY>=document.documentElement.scrollHeight-4)current=entries.at(-1);
    if(current===active)return;active=current;
    label.textContent=current?(current.link.querySelector('.t')||current.link).textContent.trim():'Contents';
    entries.forEach(({link})=>{const on=link===current?.link;link.classList.toggle('on',on);if(on)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current')});
    // the section that owns the current entry, so the top bar (main sections only) stays marked inside subsections
    const k=entries.indexOf(current);let parent=null;for(let i=k;i>=0;i--)if(!entries[i].link.classList.contains('sub')){parent=entries[i].link;break}
    entries.forEach(({link})=>link.classList.toggle('in',link===parent));
  }
  // Wide screens show the contents as a rail beside the article; narrow ones open it from the header.
  const nav=$('.chapter-nav'),isOpen=()=>nav.classList.contains('open');
  const setOpen=open=>{nav.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open))};
  toggle.addEventListener('click',()=>setOpen(!isOpen()));
  list.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false)});
  document.addEventListener('click',e=>{if(!e.target.closest('.chapter-nav,#tocToggle'))setOpen(false)});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){setOpen(false);toggle.focus()}});
  const schedule=()=>{if(!queued){queued=true;requestAnimationFrame(update)}};
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);addEventListener('load',schedule);update();
})();


// Full screen for the research film: the player with its own controls where supported, the native player on iPhone,
// and, where a page blocks full screen (an embed without permission), the player filling the window instead.
(function(){
  const b=$('#filmFull'),pl=b.closest('.player'),v=$('#film');
  const icon=d=>`<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  const enter=icon('M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9'),exit=icon('M5 1.5V5H1.5M12.5 5H9V1.5M9 12.5V9h3.5M1.5 9H5v3.5');
  const current=()=>document.fullscreenElement||document.webkitFullscreenElement;
  const theater=on=>{pl.classList.toggle('is-theater',on);document.documentElement.classList.toggle('no-scroll',on);XPVideo.refresh();sync()};
  function toggle(){
    if(pl.classList.contains('is-theater')){theater(false);return}
    if(current()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return}
    if(pl.requestFullscreen)pl.requestFullscreen().catch(()=>theater(true));
    else if(pl.webkitRequestFullscreen)pl.webkitRequestFullscreen();
    else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();
    else theater(true);
  }
  function sync(){const on=current()===pl||pl.classList.contains('is-theater');b.innerHTML=on?exit:enter;b.setAttribute('aria-label',on?'Exit full screen':'Enter full screen')}
  b.addEventListener('click',toggle);v.addEventListener('dblclick',toggle);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pl.classList.contains('is-theater'))theater(false)});
  document.addEventListener('fullscreenchange',sync);document.addEventListener('webkitfullscreenchange',sync);
})();

// Carousel: labelled buttons pick one slide at a time; the shared loader cancels hidden slides.
// Each switch restarts the slide's videos; with auto-loop on, the carousel moves on once the slide's longest video has played through.
document.querySelectorAll('.carousel').forEach(car=>{
  const slides=[...car.querySelectorAll('.car-slide')],caps=[...(car.closest('figure')||car).querySelectorAll('.car-cap > span')],dots=[...car.querySelectorAll('.car-top .seg button')],loop=car.querySelector('.car-loop input');
  const lead=s=>[...s.querySelectorAll('video')].reduce((a,v)=>!a||(v.duration||0)>(a.duration||0)?v:a,null);
  let i=0;
  const show=n=>{
    i=(n+slides.length)%slides.length;
    slides.forEach((s,k)=>s.hidden=k!==i);
    caps.forEach((c,k)=>{c.classList.toggle('off',k!==i);c.setAttribute('aria-hidden',String(k!==i))});
    dots.forEach((d,k)=>d.setAttribute('aria-pressed',String(k===i)));
    slides[i].querySelectorAll('video').forEach(v=>{delete v.dataset.held;if(v.readyState&&v.currentTime>0)v.dataset.restart='1';XPVideo.seek(v,0)});XPVideo.refresh();
    const b=car.querySelector('.scrub .icon');if(b){b.textContent='❚❚';b.setAttribute('aria-label','Pause')}
    const r=car.querySelector('.scrub input'),l=car.querySelector('.scrub .lbl'),d=(lead(slides[i])||{}).duration;
    if(r)r.value=0;if(l)l.textContent=d?`0.0 s / ${d.toFixed(1)} s`:'0.0 s';
  };
  // A looping video never fires "ended": it seeks back to the start, so a jump from the last quarter back to the first marks one full pass.
  // Seeks made by show() itself are flagged and ignored.
  slides.forEach((s,k)=>s.querySelectorAll('video').forEach(v=>{let last=0;
    const wrapped=t=>!v.dataset.restart&&!v.dataset.held&&last>v.duration*.75&&t<v.duration*.25;
    const step=()=>{const t=v.currentTime;if(k===i&&loop&&loop.checked&&v===lead(s)&&wrapped(t))show(i+1);last=t};
    v.addEventListener('timeupdate',step);v.addEventListener('seeking',step);
    v.addEventListener('seeked',()=>{delete v.dataset.restart;last=v.currentTime})}));
  dots.forEach((d,k)=>d.addEventListener('click',()=>show(k)));
  show(0);
});

// Data carousel: one timeline for the videos on the visible slide.
const dataVids=()=>[...document.querySelectorAll('#dataCarousel .car-slide:not([hidden]) video')].sort((a,b)=>(b.duration||0)-(a.duration||0));   // longest first: it sets the timeline
scrubber(dataVids,$('#dataRange'),$('#dataPlay'),$('#dataLbl'),f=>{const d=(dataVids()[0]||{}).duration||0;return `${(f*d).toFixed(1)} s / ${d.toFixed(1)} s`});

// Every video tile gets a full-screen button (top right) and its own timeline along the bottom edge: a thin line that opens
// into play / seek / time on hover. Tiles whose figure already has a shared scrub row show their own timeline only in full screen.
// Tiles explore.js builds later (after its manifest loads) are picked up as they appear.
const fsIcon=d=>`<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const FS_ENTER=fsIcon('M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9'),FS_EXIT=fsIcon('M5 1.5V5H1.5M12.5 5H9V1.5M9 12.5V9h3.5M1.5 9H5v3.5');
const fsCurrent=()=>document.fullscreenElement||document.webkitFullscreenElement;
const fsButtons=[];
// Full screen for any block; the button tracks its own state. v (optional) falls back to the iPhone's native player.
// Where the page may not go full screen (some embeds ignore or refuse the request), the block fills the window instead.
function fullscreenButton(btn,host,v){
  const theater=on=>{host.classList.toggle('is-theater',on);document.documentElement.classList.toggle('no-scroll',on);if(on&&v)XPVideo.play(v);XPVideo.refresh();fsSync()};
  const toggle=()=>{
    if(host.classList.contains('is-theater')){theater(false);return}
    if(fsCurrent()){(document.exitFullscreen||document.webkitExitFullscreen).call(document);return}
    if(host.requestFullscreen)host.requestFullscreen().then(()=>{
      if(fsCurrent()!==host){theater(true);return}
      if(v)XPVideo.play(v);XPVideo.refresh();
    }).catch(()=>theater(true));
    else if(host.webkitRequestFullscreen)host.webkitRequestFullscreen();
    else if(v&&v.webkitEnterFullscreen)v.webkitEnterFullscreen();
    else theater(true);
  };
  btn.innerHTML=FS_ENTER;btn.setAttribute('aria-label','Enter full screen');btn.addEventListener('click',toggle);fsButtons.push([host,btn]);return toggle;
}
const fsSync=()=>fsButtons.forEach(([h,b])=>{if(fsCurrent()===h)h.classList.remove('is-theater');
  const on=fsCurrent()===h||h.classList.contains('is-theater');b.innerHTML=on?FS_EXIT:FS_ENTER;b.setAttribute('aria-label',on?'Exit full screen':'Enter full screen')});
document.addEventListener('fullscreenchange',fsSync);document.addEventListener('webkitfullscreenchange',fsSync);
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const t=document.querySelector('.mx.is-theater,.cmpstrip.is-theater,.pp.is-theater');
  if(t){t.classList.remove('is-theater');document.documentElement.classList.remove('no-scroll');XPVideo.refresh();fsSync()}});
const clock=t=>t<60?`${t.toFixed(1)} s`:`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function enhanceMedia(m){
  const v=m.querySelector('video');if(m.classList.contains('mx')||!v||v.classList.contains('hidden-src'))return;
  const host=m.closest('.cmpstrip')||m;   // the comparison strip goes full screen with its method labels
  const fig=m.closest('figure');if(fig&&fig.querySelector('.scrub'))m.classList.add('has-scrub');
  m.classList.add('mx');
  m.insertAdjacentHTML('beforeend',`<button class="mx-fs" type="button"></button><span class="mx-line"></span><div class="mx-bar"><button class="mx-play" type="button" aria-label="Pause">❚❚</button><input type="range" min="0" max="1000" value="0" aria-label="Video time"><span class="mx-t"></span></div>`);
  XPVideo.register(v);
  const line=m.querySelector('.mx-line'),play=m.querySelector('.mx-play'),r=m.querySelector('.mx-bar input'),t=m.querySelector('.mx-t');
  const show=()=>{const d=v.duration||0,f=d?v.currentTime/d:0,p=(f*100).toFixed(2)+'%';
    r.value=Math.round(f*1000);r.style.setProperty('--p',p);line.style.setProperty('--p',p);t.textContent=d?`${clock(v.currentTime)} / ${clock(d)}`:''};
  const btn=()=>{m.classList.toggle('is-paused',v.paused);play.textContent=v.paused?'▶':'❚❚';play.setAttribute('aria-label',v.paused?'Play':'Pause')};
  v.addEventListener('timeupdate',show);v.addEventListener('loadedmetadata',show);v.addEventListener('play',btn);v.addEventListener('pause',btn);btn();
  r.addEventListener('input',()=>{XPVideo.pause(v);if(v.duration)XPVideo.seek(v,r.value/1000*v.duration*.999);show()});
  play.addEventListener('click',()=>{if(v.paused)XPVideo.play(v);else XPVideo.pause(v)});
  v.addEventListener('dblclick',fullscreenButton(m.querySelector('.mx-fs'),host,v));
}
document.querySelectorAll('.media').forEach(enhanceMedia);
new MutationObserver(ms=>ms.forEach(x=>x.addedNodes.forEach(n=>{if(n.nodeType!==1)return;
  if(n.matches('.media'))enhanceMedia(n);n.querySelectorAll('.media').forEach(enhanceMedia)}))).observe(document.body,{childList:true,subtree:true});

// Tabbed subsections: the seg row picks which panel shows.
document.querySelectorAll('.tabset').forEach(ts=>{
  const bs=[...ts.querySelector(':scope > .ctrls .seg').children],ps=[...ts.querySelectorAll(':scope > .tab-panel')];
  bs.forEach((b,i)=>b.addEventListener('click',()=>{bs.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));ps.forEach((p,k)=>p.classList.toggle('off',k!==i));
    XPVideo.refresh();window.dispatchEvent(new Event('resize'))}));
});
// Auto-loop for the picker figures: when switched on, the figure moves to the next option each time its video has played
// through once (the next task, then the next dataset or embodiment). A looping video never fires "ended", so a jump from
// the last quarter back to the first counts as one pass; seeks the viewer makes (timelines, option buttons) are ignored.
function autoLoop(fig,video,segs){
  const lab=document.createElement('label');lab.className='car-loop auto-loop';
  lab.innerHTML='<span>Auto-loop</span><input type="checkbox" role="switch"><i aria-hidden="true"></i>';
  fig.insertBefore(lab,fig.firstChild);const box=lab.querySelector('input');
  let last=0,quiet=0;const hush=()=>{quiet=performance.now()+1200;last=0};
  fig.addEventListener('pointerdown',hush,true);fig.addEventListener('input',e=>{if(e.target!==box)hush()},true);fig.addEventListener('keydown',hush,true);
  const next=()=>{const rows=segs.map(id=>[...$(id).children]),cur=rows.map(r=>Math.max(0,r.findIndex(b=>b.getAttribute('aria-pressed')==='true')));
    for(let k=rows.length-1;k>=0;k--){if(cur[k]<rows[k].length-1||k===0){rows[k][(cur[k]+1)%rows[k].length].click();break}}
    quiet=performance.now()+1200;last=0};
  const step=()=>{const v=video(),t=v.currentTime,d=v.duration;if(!d)return;
    if(box.checked&&performance.now()>quiet&&last>d*.75&&t<d*.25)next();last=t};
  const watch=v=>{v.addEventListener('timeupdate',step);v.addEventListener('ended',()=>{if(box.checked)next()});v.addEventListener('loadstart',()=>{last=0})};
  watch(video());
}
autoLoop($('#cmp'),()=>$('#cmpVideo'),['#cmpGroup','#cmpScene']);
autoLoop($('#adapt2'),()=>$('#adVideo'),['#adTask']);
autoLoop($('#wall'),()=>$('#wallMain'),['#liveKind','#liveSeg']);
autoLoop($('#rr'),()=>$('#rrExt'),['#rrTask']);

// White or black background; the choice is remembered and the charts redraw in the new colours.
(function(){
  const root=document.documentElement,btns=[...document.querySelectorAll('.theme-switch button')];
  const sync=()=>{const t=root.dataset.theme==='dark'?'dark':'light';btns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.set===t)))};
  btns.forEach(b=>b.addEventListener('click',()=>{
    if(b.dataset.set==='dark')root.dataset.theme='dark';else delete root.dataset.theme;
    try{localStorage.setItem('xp0-theme',b.dataset.set)}catch(e){}
    sync();drawCharts();
  }));
  sync();
})();
// Reading progress: a thin accent line along the top edge.
(function(){const bar=$('#progress');if(!bar)return;let queued=false;
  const set=()=>{queued=false;const h=document.documentElement.scrollHeight-innerHeight;bar.style.width=(h>0?Math.min(100,scrollY/h*100):0)+'%'};
  addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(set)}},{passive:true});addEventListener('resize',set);set();
})();
