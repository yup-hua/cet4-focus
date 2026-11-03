/* Ten-word groups, repeated retrieval rounds, and resumable browser-local sessions. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WordRounds=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
  function shuffle(items,random=Math.random){const a=items.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.max(0,Math.min(.999999,random()))*(i+1));[a[i],a[j]]=[a[j],a[i]];}if(a.length>1&&a.every((item,i)=>item.id===items[i].id))a.push(a.shift());return a;}
  function start(items,{rounds=3,size=10,mode='quiz',date}={}){
    const groups=[];for(let i=0;i<items.length;i+=size)groups.push(items.slice(i,i+size).map(x=>({id:x.id,kind:x.kind})));
    return {version:1,date,groups,groupIndex:0,round:1,rounds:[3,5].includes(rounds)?rounds:3,queue:groups[0]?.slice()||[],index:0,mode,done:0,correct:0,repeats:{},roundDone:0,roundCorrect:0,answered:false,checkpoint:null,finished:!groups.length};
  }
  function settle(input){
    let s={...input,checkpoint:null};
    while(!s.finished&&s.index>=s.queue.length){
      if(s.groups[s.groupIndex]?.length){
        if(s.round<s.rounds)return {...s,checkpoint:'round'};
        if(s.groupIndex<s.groups.length-1)return {...s,checkpoint:'group'};
        return {...s,finished:true};
      }
      if(s.groupIndex>=s.groups.length-1)return {...s,finished:true};
      s={...s,groupIndex:s.groupIndex+1,round:1,index:0,queue:s.groups[s.groupIndex+1].slice(),repeats:{},roundDone:0,roundCorrect:0,answered:false};
    }
    return s;
  }
  function record(session,rating,correct){
    if(!session||session.finished||session.checkpoint||session.answered)return session;
    const item=session.queue[session.index];if(!item)return session;
    const s={...session,queue:session.queue.slice(),repeats:{...session.repeats},done:session.done+1,correct:session.correct+(correct?1:0),roundDone:session.roundDone+1,roundCorrect:session.roundCorrect+(correct?1:0),answered:true};
    if(rating==='again'&&(s.repeats[item.id]||0)<2){s.repeats[item.id]=(s.repeats[item.id]||0)+1;s.queue.push({...item});}
    return s;
  }
  function next(session){if(!session||!session.answered||session.finished||session.checkpoint)return session;return settle({...session,index:session.index+1,answered:false});}
  function continueRound(session,random=Math.random){
    if(!session?.checkpoint)return session;
    const nextGroup=session.checkpoint==='group',groupIndex=session.groupIndex+(nextGroup?1:0);
    const queue=shuffle(session.groups[groupIndex],random);
    if(!nextGroup&&queue.length>1){const seen=new Set(),previous=session.queue.filter(x=>!seen.has(x.id)&&seen.add(x.id));if(queue.every((x,i)=>x.id===previous[i]?.id))queue.push(queue.shift());}
    return settle({...session,groupIndex,round:nextGroup?1:session.round+1,index:0,queue,repeats:{},roundDone:0,roundCorrect:0,answered:false,checkpoint:null});
  }
  function skip(session,id){
    if(!session||session.finished||session.checkpoint||session.answered)return session;
    const groups=session.groups.map(g=>g.filter(item=>item.id!==id));
    const queue=session.queue.filter((item,i)=>i<=session.index||item.id!==id);
    return settle({...session,groups,queue,index:session.index+1,answered:false});
  }
  function snapshot(session){
    if(!session||session.finished)return null;
    const {version,date,groups,groupIndex,round,rounds,queue,index,mode,done,correct,repeats,roundDone,roundCorrect,answered}=session;
    return {version,date,groups,groupIndex,round,rounds,queue,index,mode,done,correct,repeats,roundDone,roundCorrect,answered};
  }
  function restore(raw,words,today){
    if(!raw||raw.version!==1||raw.date!==today||![3,5].includes(raw.rounds)||!['card','quiz','spell'].includes(raw.mode))return null;
    const allowed=new Set(words.map(w=>w.id));
    const valid=item=>item&&allowed.has(item.id)&&['new','review'].includes(item.kind);
    if(!Array.isArray(raw.groups)||!raw.groups.length||raw.groups.length>words.length||!raw.groups.every(g=>Array.isArray(g)&&g.length<=10&&g.every(valid)))return null;
    const ids=raw.groups.flat().map(x=>x.id);if(new Set(ids).size!==ids.length)return null;
    if(!integer(raw.groupIndex,0,raw.groups.length-1)||!integer(raw.round,1,raw.rounds)||!Array.isArray(raw.queue)||raw.queue.length>40||!raw.queue.every(valid)||!integer(raw.index,0,raw.queue.length))return null;
    const current=new Set(raw.groups[raw.groupIndex].map(x=>x.id));
    if(raw.queue.slice(raw.index).some(x=>!current.has(x.id)))return null;
    if(!integer(raw.done,0,100000)||!integer(raw.correct,0,raw.done)||!integer(raw.roundDone,0,1000)||!integer(raw.roundCorrect,0,raw.roundDone))return null;
    const repeats={};for(const [id,count]of Object.entries(raw.repeats||{}))if(current.has(id)&&integer(count,0,2))repeats[id]=count;
    let s={version:1,date:today,groups:raw.groups.map(g=>g.map(x=>({...x}))),groupIndex:raw.groupIndex,round:raw.round,rounds:raw.rounds,queue:raw.queue.map(x=>({...x})),index:raw.index,mode:raw.mode,done:raw.done,correct:raw.correct,repeats,roundDone:raw.roundDone,roundCorrect:raw.roundCorrect,answered:raw.answered===true,checkpoint:null,finished:false};
    // An answer was already scored before refreshing; proceed without counting it twice.
    s=s.answered?next(s):settle(s);return s.finished?null:s;
  }
  return {start,record,next,continueRound,skip,snapshot,restore};
});
