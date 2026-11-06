/* Source-linked past papers. No copied test text or synthetic exam audio. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PastPapers=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const h=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safe=url=>{try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='cet4.koolearn.com'||u.hostname.endsWith('.koocdn.com'))?u.href:'';}catch{return '';}};
 function items(data,year='all'){return (Array.isArray(data?.items)?data.items:[]).filter(i=>year==='all'||String(i.year)===String(year));}
 function render(data,kind,year='all'){
  const list=items(data,year),listening=kind==='listening',years=[...new Set(items(data).map(i=>i.year))].sort((a,b)=>b-a);
  return `<div class="exam-intro"><h2>用历年原卷，练真实语境。</h2><p>${listening?'原站听力录音可在这里播放，题目和答案请打开配套原卷。':'打开原卷查看阅读题，再回来源页核对答案。试卷可能为 PDF 或长图，可放大阅读。'}</p><p class="tiny">来源：新东方在线整理 · 外站内容需要联网 · 本站不对原卷自动判分</p></div><div class="listening-filters" role="group" aria-label="真题年份筛选">${[['all','全部年份'],...years.map(y=>[String(y),String(y)+' 年'])].map(([id,label])=>`<button data-action="exam-year" data-year="${id}" aria-pressed="${String(year)===id}" class="${String(year)===id?'active':''}">${label}<span>${items(data,id).length}</span></button>`).join('')}</div><div class="lesson-grid">${list.map(i=>`<article class="lesson-tile exam-tile"><div class="lesson-tile-body"><div class="lesson-tags"><span class="format-tag">历年真题</span><span>${h(i.source)}</span></div><h2>${i.year} 年 ${i.month} 月 · 第 ${i.set} 套</h2><p>${listening?'原音与配套试卷':'阅读原卷与答案来源'}</p>${listening&&safe(i.audioUrl)?`<audio controls preload="none" aria-label="${i.year}年${i.month}月第${i.set}套听力原音" src="${h(safe(i.audioUrl))}"></audio><p class="tiny">${i.audioSharedWith?'本套与第 2 套共用原站音频。':'原站提供的听力音频。'}</p><a class="text-button" target="_blank" rel="noopener noreferrer" href="${h(safe(i.audioUrl))}">播放有问题？直接打开原音 ↗</a>`:''}<div class="exam-links"><a class="secondary" target="_blank" rel="noopener noreferrer" href="${h(safe(i.paperUrl))}">${listening?'打开配套原卷':'打开阅读原卷'} ↗</a><a class="text-button" target="_blank" rel="noopener noreferrer" href="${h(safe(i.sourceUrl))}">原站与答案 ↗</a></div></div></article>`).join('')}</div>`;
 }
 return {items,render,safe};
});
