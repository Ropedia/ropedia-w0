// Dataset wall (#embwall) and walking grid (#egogrid), built from media/lib/manifest.json.
(function(){
const q=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

(window.XP_MANIFEST?Promise.resolve(window.XP_MANIFEST):fetch('media/lib/manifest.json').then(r=>r.json())).then(M=>{
  // Twenty datasets (humans and robots), task on hover
  (function(){const el=q('#embwall');if(!el)return;
    const previewCount=4;
    el.innerHTML=M.embodiments.map((e,i)=>`<figure class="emb-tile" tabindex="0"${i>=previewCount?' hidden data-extra':''}><div class="media"><video data-auto muted loop playsinline preload="none" data-poster="${e.src}.jpg" data-src="${e.src}.mp4" aria-label="${esc(e.name)}"></video>${/^\s*["{]/.test(e.task||'')?'':`<span class="emb-task">${esc(e.task)}</span>`}</div><figcaption>${esc(e.name)}</figcaption></figure>`).join('');
    if(M.embodiments.length>previewCount){
      const button=document.createElement('button');button.type='button';button.className='text-toggle';
      button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','embwall');
      button.textContent=`View all ${M.embodiments.length} datasets +`;
      button.addEventListener('click',()=>{
        const expanded=button.getAttribute('aria-expanded')!=='true';
        button.setAttribute('aria-expanded',String(expanded));
        el.querySelectorAll('[data-extra]').forEach(tile=>{tile.hidden=!expanded;if(!expanded)tile.querySelector('video').pause()});
        XPVideo.refresh();
        button.textContent=expanded?'Show selected datasets −':`View all ${M.embodiments.length} datasets +`;
        if(!expanded)el.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      });
      el.after(button);
    }
  })();

  // Walking and turning
  (function(){const el=q('#egogrid');if(!el)return;
    el.innerHTML=M.egomotion.map(e=>`<div class="media r43"><video data-auto muted loop playsinline preload="none" data-poster="${e.src}.jpg" data-src="${e.src}.mp4" aria-label="${esc(e.name)}"></video><span class="tag">${esc(e.name)}</span></div>`).join('');
  })();

  document.querySelectorAll('#embwall video,#egogrid video').forEach(XPVideo.register);
}).catch(()=>{
  document.querySelectorAll('#embwall,#egogrid').forEach(root=>{
    root.innerHTML='<p class="load-error">The demos could not load. Please refresh the page to try again.</p>';
  });
});
})();
