/* Original reading/listening practice, independent of the word scheduler. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WordPractice=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function lessons(data,kind){return ['listening','reading'].includes(kind)&&Array.isArray(data?.[kind])?data[kind]:[];}
  function grade(lesson,answers){
    if(!lesson||!Array.isArray(lesson.questions)||!Array.isArray(answers))throw new Error('Invalid exercise');
    if(answers.length!==lesson.questions.length||answers.some(v=>!Number.isInteger(v)||v<0||v>3))throw new Error('请先完成全部题目');
    const results=lesson.questions.map((q,i)=>({id:q.id,correct:answers[i]===q.answer,selected:answers[i],answer:q.answer}));
    return {score:results.filter(x=>x.correct).length,total:results.length,results};
  }
  function record(lesson,kind,answers,previous,now=new Date()){
    const result=grade(lesson,answers);
    return {kind,answers:answers.slice(),score:result.score,total:result.total,completedAt:now.toISOString(),attempts:(previous?.attempts||0)+1};
  }
  function renderCatalog(data,kind,records={}){
    const list=lessons(data,kind),isListening=kind==='listening',done=list.filter(l=>records[l.id]).length;
    return `<div class="exercise-overview"><span><b>${list.length}</b> 篇原创练习</span><span><b>${done}</b> 篇已完成</span><span>${isListening?'先听，再读懂细节':'从段落中找到答案'}</span></div><div class="lesson-grid">${list.map((lesson,i)=>{
      const r=records[lesson.id];
      return `<article class="lesson-tile"><div class="lesson-number ${isListening?'audio-tile':''}">${isListening?'◖))':'Aa'}<small>${String(i+1).padStart(2,'0')}</small></div><div class="lesson-tile-body"><div class="lesson-tags"><span>${h(lesson.topic)}</span><span>${h(lesson.difficulty)}</span>${r?`<span class="completed-tag">已完成 ${r.score}/${r.total}</span>`:''}</div><h2>${h(lesson.title)}</h2><p>${h(lesson.subtitle)}</p><div class="lesson-meta">${lesson.questions.length} 道题 · ${isListening?h(lesson.durationHint||'约 1 分钟'):lesson.body.trim().split(/\s+/).length+' 词'}</div><button class="lesson-start" data-action="open-exercise" data-kind="${kind}" data-id="${h(lesson.id)}">${r?'查看上次结果':'开始练习'} <span>↗</span></button></div></article>`;
    }).join('')}</div><div class="note-row"><i>ⓘ</i><span>${isListening?'音频为英语合成语音，可调整速度和反复播放。':'文章与题目为原创训练内容。'}提交后提供答案、中文解析和原文定位。</span></div>`;
  }
  function renderLesson(lesson,kind,attempt,rate=1){
    const isListening=kind==='listening',submitted=attempt.submitted,answers=attempt.answers;
    const answerCount=answers.filter(v=>Number.isInteger(v)).length;
    let score='';if(submitted){const g=grade(lesson,answers);score=`<section class="exercise-result"><div><span class="eyebrow">YOUR PRACTICE RESULT</span><h2>本次答对 <strong>${g.score} / ${g.total}</strong></h2><p>${g.score===g.total?'全部答对，看看解析巩固思路。':'回到原文找依据，再听或再读一遍。'}</p></div><button class="secondary" data-action="retry-exercise">再做一次 ↻</button></section>`;}
    const paragraphs=lesson.body.split(/\n\s*\n/).filter(Boolean).map(p=>`<p>${h(p)}</p>`).join('');
    const passage=isListening?`<section class="audio-panel"><div class="audio-panel-top"><span class="audio-symbol">◖))</span><div><strong>先听一遍，再选答案</strong><p>可反复播放 · 英语合成语音</p></div><label class="audio-speed">倍速 <select id="listening-speed" aria-label="听力播放速度">${[.75,1,1.25,1.5].map(v=>`<option value="${v}" ${v===rate?'selected':''}>${v}×</option>`).join('')}</select></label></div><audio id="listening-audio" controls preload="metadata" data-rate="${rate}" src="audio/${h(lesson.id)}.mp3">当前浏览器不支持音频播放，请使用系统浏览器。</audio><p id="audio-error" class="audio-error" hidden>音频暂未加载，请检查网络，或<a href="audio/${h(lesson.id)}.mp3" target="_blank" rel="noopener">直接打开音频</a>。</p><details class="transcript" ${submitted?'open':''}><summary>查看听力原文 <span>建议先完成作答</span></summary><div class="english-passage">${paragraphs}</div></details></section>`:`<section class="reading-panel"><div class="passage-label">READ THE PASSAGE · ${lesson.body.trim().split(/\s+/).length} WORDS</div><div class="english-passage">${paragraphs}</div></section>`;
    const questions=lesson.questions.map((q,i)=>`<fieldset class="comprehension-question" id="question-${i}"><legend><span>${i+1}</span>${h(q.prompt)}</legend><div class="comprehension-options">${q.options.map((option,j)=>`<label class="comprehension-option ${submitted?(j===q.answer?'answer-correct':j===answers[i]?'answer-wrong':''):''}"><input type="radio" name="exercise-${h(q.id)}" value="${j}" data-question="${i}" ${answers[i]===j?'checked':''} ${submitted?'disabled':''}><span class="answer-letter">${'ABCD'[j]}</span><span>${h(option)}</span>${submitted&&j===q.answer?'<b class="correct-mark">✓</b>':''}</label>`).join('')}</div>${submitted?`<div class="question-explanation"><b>${answers[i]===q.answer?'✓ 回答正确':'正确答案：'+'ABCD'[q.answer]}</b><p>${h(q.explanation)}</p><blockquote>${h(q.quote)}</blockquote></div>`:''}</fieldset>`).join('');
    return `<div class="exercise-shell"><div class="study-top"><button data-action="nav" data-page="${kind}">← 返回${isListening?'听力':'阅读'}列表</button><span>原创练习 · ${h(lesson.difficulty)}</span></div><div class="exercise-heading"><span class="eyebrow">${isListening?'LISTEN FOR MEANING.':'READ BETWEEN THE LINES.'}</span><h1>${h(lesson.title)}</h1><p>${h(lesson.subtitle)}</p></div>${score}<div class="comprehension-layout"><div class="passage-column">${passage}<details class="vocabulary-notes"><summary>本篇重点词汇 <span>${lesson.vocabulary.length} 词</span></summary>${lesson.vocabulary.map(w=>`<div><b>${h(w.word)}</b><span>${h(w.meaning)}</span></div>`).join('')}</details></div><section class="questions-column"><h2>根据${isListening?'听到':'读到'}的内容作答</h2>${questions}<div class="exercise-submit"><span id="answered-count">已选 ${answerCount} / ${lesson.questions.length} 题</span><button class="primary" data-action="${submitted?'next-exercise':'submit-exercise'}">${submitted?'下一篇练习':'提交答案，看解析'} →</button></div></section></div></div>`;
  }
  return {lessons,grade,record,renderCatalog,renderLesson};
});
