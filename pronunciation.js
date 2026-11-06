/* Local pronunciation clips, with device speech as a fallback. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WordAudio=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function createPlayer({audio,fallback=()=>false,cancelFallback=()=>{},onError=()=>{},later=setTimeout,cancel=clearTimeout}){
  if(audio?.nodeType&&typeof document!=='undefined'){audio.id='word-audio';audio.hidden=true;document.body.append(audio);}
  let manifest=null,active=null,serial=0,timer=null;
  function stop(){serial++;if(timer!==null)cancel(timer);timer=null;active=null;if(audio)audio.pause();cancelFallback();}
  function check(){
   if(!active||!audio)return;
   if(audio.currentTime>=active.end-.025){stop();return;}
   if(timer!==null)cancel(timer);
   timer=later(check,Math.max(30,Math.min(150,(active.end-audio.currentTime)/audio.playbackRate*1000)));
  }
  if(audio){audio.addEventListener('timeupdate',check);audio.addEventListener('seeked',check);audio.addEventListener('ended',stop);}
  function setManifest(data,blobUrl){
   if(!data||data.version!==1||data.file!=='audio/words.mp3'||!data.items)return false;
   manifest=data;if(audio){audio.src=typeof blobUrl==='string'&&blobUrl.startsWith('blob:')?blobUrl:data.file;audio.preload='metadata';}return true;
  }
  async function play(id,{rate=.85,automatic=false}={}){
   stop();const token=serial,cue=manifest?.items?.[id];
   if(!audio||!cue||!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.end<=cue.start){if(!fallback(id,rate))onError(automatic);return false;}
   try{
    active=cue;audio.playbackRate=rate;audio.currentTime=cue.start;
    await audio.play();if(token!==serial)return false;check();return true;
   }catch(error){
    if(token!==serial||error?.name==='AbortError')return false;
    stop();if(!fallback(id,rate))onError(automatic);return false;
   }
  }
  return {play,stop,setManifest};
 }
 return {createPlayer};
});
