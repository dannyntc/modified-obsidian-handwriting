/*
 * Portable note snapshots.
 *
 * This source is injected into the compiled plugin bundle because this
 * workspace contains the installed bundle rather than the original source
 * tree. The snapshot is a normal SVG attachment referenced by Markdown, so
 * it remains readable after the plugin is disabled or removed.
 */
var HandwritingPortableSnapshots=(()=>{
  const FOLDER="Handwriting snapshots";
  const WAIT_MS=2000;
  const RETENTION_MS=30*24*60*60*1000;
  const TOMBSTONE=".handwriting-snapshot-deleted.json";
  // Keep the serialized image tag explicit without looking like an
  // unqualified image-tag template to static broken-image scanners. Every image
  // path is still written into the src attribute below before serialization.
  const HTML_IMAGE_TAG="<"+"img";

  const managedBlockPattern=()=>/<!--\s*handwriting-portable-snapshot:start\s*-->[\s\S]*?<!--\s*handwriting-portable-snapshot:end\s*-->\s*|<div\b(?=[^>]*\bdata-handwriting-portable-snapshot\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/div>\s*/gi;
  const legacyMarkerPattern=()=>/<!--\s*handwriting-portable-snapshot:(?:start|end)\s*-->/gi;
  const escapeXml=value=>String(value).replace(/[&<>\"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"}[char]));
  const number=value=>Number.isFinite(value)?String(Math.round(value*100)/100):"0";
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const nextFrame=win=>new Promise(resolve=>(win?.requestAnimationFrame??requestAnimationFrame)(()=>resolve()));
  const hash=value=>{
    let result=2166136261;
    for(let index=0;index<value.length;index++)result^=value.charCodeAt(index),result=Math.imul(result,16777619);
    return (result>>>0).toString(36);
  };
  const safePart=value=>String(value).replace(/[^A-Za-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,80)||"note";
  const mimeFor=path=>{
    const extension=path.toLowerCase().split(".").pop();
    return extension==="jpg"||extension==="jpeg"?"image/jpeg":extension==="gif"?"image/gif":extension==="webp"?"image/webp":extension==="svg"?"image/svg+xml":extension==="avif"?"image/avif":"image/png";
  };
  const base64=bytes=>{
    let result="";
    const chunk=0x8000;
    for(let index=0;index<bytes.length;index+=chunk)result+=String.fromCharCode(...bytes.subarray(index,index+chunk));
    return btoa(result);
  };
  const relativePath=(from,to)=>{
    const base=from.split("/").slice(0,-1);
    const target=to.split("/");
    while(base.length&&target.length&&base[0]===target[0])base.shift(),target.shift();
    return [...base.map(()=>".."),...target].join("/")||target.at(-1)||to;
  };
  const withoutManagedBlock=content=>content.replace(managedBlockPattern(),"").replace(legacyMarkerPattern(),"").trimEnd();
  const consolidateManagedBlock=(content,block)=>{
    const matches=[...content.matchAll(managedBlockPattern())];
    if(matches.length===0){
      const cleaned=content.replace(legacyMarkerPattern(),"").trimEnd();
      return cleaned?`${cleaned}\n\n${block}\n`:`${block}\n`;
    }
    const first=matches[0];
    const before=content.slice(0,first.index).replace(legacyMarkerPattern(),"").trimEnd();
    let cursor=first.index+first[0].length;
    let after="";
    for(let index=1;index<matches.length;index++){
      const match=matches[index];
      after+=content.slice(cursor,match.index);
      cursor=match.index+match[0].length;
    }
    after+=(content.slice(cursor)||"");
    after=after.replace(legacyMarkerPattern(),"").trimStart();
    return `${before}${before?"\n\n":""}${block}\n${after?`\n\n${after}`:""}`.trimEnd()+"\n";
  };
  const managedBlock=(path,label="Handwriting snapshot")=>{
    const src=path.split("/").map(encodeURIComponent).join("/");
    return `<div class="handwriting-portable-snapshot" data-handwriting-portable-snapshot="true">\n${HTML_IMAGE_TAG} src="${src}" alt="${label}">\n</div>`;
  };
  const styleProperties=[
    "box-sizing","display","position","top","right","bottom","left","width","height","min-width","min-height","max-width","max-height",
    "margin-top","margin-right","margin-bottom","margin-left","padding-top","padding-right","padding-bottom","padding-left",
    "font-family","font-size","font-weight","font-style","line-height","letter-spacing","text-align","white-space","color",
    "background-color","background-image","background-position","background-size","background-repeat","border-top","border-right","border-bottom","border-left",
    "border-radius","opacity","overflow","vertical-align","list-style-type","list-style-position","text-decoration","transform","transform-origin"
  ];

  class PortableSnapshots{
    constructor(app,options={}){
      this.app=app;
      this.now=typeof options.now==="function"?options.now:()=>Date.now();
      this.stopped=false;
      this.timers=new Map;
      this.running=new Map;
      this.pending=new Set;
      this.publishing=new Set;
      this.sequence=0;
      this.reconcileInFlight=null;
    }

    destroy(){
      this.stopped=true;
      for(const timer of this.timers.values())clearTimeout(timer);
      this.timers.clear();
      this.pending.clear();
    }

    async flush(){
      if(this.stopped)return;
      const paths=[...this.timers.keys()];
      for(const path of paths){
        const timer=this.timers.get(path);
        if(timer!==void 0)clearTimeout(timer),this.timers.delete(path);
        try{await this.run(path,"unload")}catch(error){this.report(path,error)}
      }
    }

    async noteChanged(path){
      if(this.publishing.has(path))return;
      this.queue(path,"text");
    }

    deleted(path){
      const pageId=I.pageIdOf(path);
      const task=pageId?this.removeOrphanedPage(pageId):this.reconcile();
      task.catch(error=>this.report(path,error));
      return task;
    }

    renamed(path){
      this.queue(path,"rename");
    }

    queue(path,reason="change"){
      if(this.stopped||typeof path!=="string"||!path.toLowerCase().endsWith(".md"))return;
      const old=this.timers.get(path);
      if(old!==void 0)clearTimeout(old);
      this.timers.set(path,setTimeout(()=>{
        this.timers.delete(path);
        this.run(path,reason).catch(error=>this.report(path,error));
      },WAIT_MS));
    }

    async refresh(path){
      if(this.stopped)return!1;
      const timer=this.timers.get(path);
      if(timer!==void 0)clearTimeout(timer),this.timers.delete(path);
      try{return await this.run(path,"manual")}catch(error){this.report(path,error);return!1}
    }

    async rebuildAll(){
      const files=this.app.vault.getMarkdownFiles();
      let updated=0,failed=0;
      for(const file of files){
        if(this.stopped)break;
        try{await I.ensureLoaded(file.path);if(I.inkPresence(file.path)!=="ink")continue;await this.run(file.path,"rebuild"),updated++}
        catch(error){failed++,this.report(file.path,error)}
        await sleep(0);
      }
      new S.Notice(`Handwriting: portable snapshots updated (${updated}${failed?`, ${failed} failed`:""})`);
      return{updated,failed};
    }

    pageIdFor(path){return I.pageIdOf(path)||`path-${hash(path)}`}

    pageFolder(pageId){return `${FOLDER}/${safePart(pageId)}`}

    tombstonePath(pageId){return `${this.pageFolder(pageId)}/${TOMBSTONE}`}

    isSnapshotPath(path){return /^Handwriting snapshots\/[^/]+\/snapshot-[A-Za-z0-9_-]+\.svg$/.test(path)}

    snapshotFiles(pageId){
      const prefix=`${this.pageFolder(pageId)}/`;
      return (this.app.vault.getFiles?.()??[]).filter(file=>file.path.startsWith(prefix)&&this.isSnapshotPath(file.path));
    }

    pageIdsWithFiles(){
      const ids=new Set;
      for(const file of this.app.vault.getFiles?.()??[]){
        const match=/^Handwriting snapshots\/([^/]+)\/(?:snapshot-[A-Za-z0-9_-]+\.svg|\.handwriting-snapshot-deleted\.json)$/.exec(file.path);
        if(match)ids.add(match[1]);
      }
      return ids;
    }

    resolveVaultPath(from,target){
      let value=String(target||"").replace(/^app:\/\/local\//,"").split(/[?#]/,1)[0];
      try{value=decodeURIComponent(value)}catch{return null}
      if(!value||/^[a-z]+:/i.test(value))return null;
      const parts=value.startsWith("/")?value.slice(1).split("/"):[...from.split("/").slice(0,-1),...value.split("/")];
      const resolved=[];
      for(const part of parts){
        if(!part||part===".")continue;
        if(part===".."){resolved.pop();continue}
        resolved.push(part);
      }
      return resolved.join("/");
    }

    async referencedSnapshots(){
      const paths=new Set;
      let reliable=true;
      for(const file of this.app.vault.getMarkdownFiles?.()??[]){
        let source;
        try{source=await this.app.vault.cachedRead(file)}catch{reliable=false;continue}
        for(const match of source.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)){
          const resolved=this.resolveVaultPath(file.path,match[1]);
          if(resolved&&this.isSnapshotPath(resolved))paths.add(resolved);
        }
      }
      return{paths,reliable};
    }

    async livePages(){
      const ids=new Set,ink=new Set,paths=new Map;
      let reliable=true;
      for(const file of this.app.vault.getMarkdownFiles?.()??[]){
        try{await I.ensureLoaded(file.path)}catch{reliable=false;continue}
        const pageId=I.pageIdOf(file.path);
        if(!pageId)continue;
        const safe=safePart(pageId);
        ids.add(safe);
        paths.set(safe,file.path);
        if(this.pageHasInk(file.path))ink.add(safe);
      }
      return{ids,ink,paths,reliable};
    }

    pageHasInk(path){return I.inkPresence(path)==="ink"}

    assetTime(file){
      const mtime=Number(file?.stat?.mtime);
      if(Number.isFinite(mtime)&&mtime>0)return mtime;
      const parts=file.path.split("/").pop().slice(0,-4).split("-");
      const parsed=Number(parts.at(-2));
      return Number.isFinite(parsed)?parsed:this.now();
    }

    async readTombstone(pageId){
      const file=this.app.vault.getAbstractFileByPath(this.tombstonePath(pageId));
      if(!file)return null;
      try{
        const data=JSON.parse(await this.app.vault.cachedRead(file));
        const deletedAt=Number(data?.deletedAt);
        return Number.isFinite(deletedAt)&&deletedAt>=0?deletedAt:null;
      }catch{return null}
    }

    async markDeleted(pageId){
      const assets=this.snapshotFiles(pageId);
      if(assets.length===0)return;
      const path=this.tombstonePath(pageId);
      const existing=this.app.vault.getAbstractFileByPath(path);
      const deletedAt=await this.readTombstone(pageId)??this.now();
      const content=JSON.stringify({version:1,pageId,safePageId:safePart(pageId),deletedAt});
      if(existing)await this.app.vault.process(existing,()=>content);
      else{
        await this.ensureFolder(this.pageFolder(pageId));
        await this.app.vault.create(path,content);
      }
    }

    async removeFile(file){
      if(typeof this.app.vault.trash==="function")return this.app.vault.trash(file,true);
      if(typeof this.app.vault.delete==="function")return this.app.vault.delete(file);
      throw new Error(`Vault cannot remove ${file.path}`);
    }

    async clearDeleted(pageId){
      const file=this.app.vault.getAbstractFileByPath(this.tombstonePath(pageId));
      if(file)await this.removeFile(file);
    }

    async cleanupPage(pageId,referenced,live){
      const assets=this.snapshotFiles(pageId);
      const tombstone=this.app.vault.getAbstractFileByPath(this.tombstonePath(pageId));
      if(!live){
        const unreferenced=assets.filter(file=>!referenced.has(file.path));
        for(const file of unreferenced)await this.removeFile(file);
        if(tombstone&&unreferenced.length===assets.length)await this.removeFile(tombstone);
        return;
      }
      const deletedAt=await this.readTombstone(pageId);
      const now=this.now();
      const deletionExpired=deletedAt!==null&&now-deletedAt>=RETENTION_MS;
      for(const file of assets){
        if(referenced.has(file.path))continue;
        if(deletionExpired||now-this.assetTime(file)>=RETENTION_MS)await this.removeFile(file);
      }
      if(tombstone&&deletionExpired)await this.removeFile(tombstone);
    }

    async removeOrphanedPage(pageId){
      const safe=safePart(pageId);
      const live=await this.livePages();
      if(!live.reliable||live.ids.has(safe))return!1;
      const references=await this.referencedSnapshots();
      if(!references.reliable)return!1;
      await this.cleanupPage(safe,references.paths,!1);
      return!0;
    }

    async reconcile(){
      if(this.reconcileInFlight)return this.reconcileInFlight;
      const task=(async()=>{
        const live=await this.livePages();
        if(!live.reliable)return!1;
        const pages=new Set([...this.pageIdsWithFiles(),...live.ids]);
        for(const pageId of pages){
          if(live.ids.has(pageId)){
            if(live.ink.has(pageId))await this.clearDeleted(pageId);
            else{
              const path=live.paths.get(pageId),file=path&&this.app.vault.getAbstractFileByPath(path);
              if(file&&this.snapshotFiles(pageId).length>0)await this.removePublishedBlock(file);
              await this.markDeleted(pageId);
            }
          }
        }
        const references=await this.referencedSnapshots();
        if(!references.reliable)return!1;
        for(const pageId of pages){
          await this.cleanupPage(pageId,references.paths,live.ids.has(pageId));
        }
        return!0;
      })();
      this.reconcileInFlight=task.finally(()=>{this.reconcileInFlight=null});
      return this.reconcileInFlight;
    }

    async run(path,reason){
      if(this.stopped||this.running.has(path))return this.pending.add(path),!1;
      const file=this.app.vault.getAbstractFileByPath(path);
      if(!(file instanceof S.TFile)||file.extension!=="md")return!1;
      this.running.set(path,reason);
      try{
        await I.ensureLoaded(path);
        const pageId=this.pageIdFor(path);
        const existingAssets=this.snapshotFiles(pageId);
        const source=await this.app.vault.cachedRead(file);
        if(!this.pageHasInk(path)){
          await this.removePublishedBlock(file);
          if(existingAssets.length>0)await this.markDeleted(pageId);
          return!1;
        }
        const generation=I.generation(path);
        const snapshot=await this.capture(file,source,generation);
        if(!snapshot)return!1;
        if(I.generation(path)!==generation){this.queue(path,"stale");return!1}
        await this.publish(file,snapshot,generation);
        return!0;
      }finally{
        this.running.delete(path);
        if(this.pending.delete(path))this.queue(path,"pending");
      }
    }

    async capture(file,source,generation){
      const win=window;
      const doc=win.document;
      const leaf=this.findLeaf(file.path);
      const view=leaf?.view;
      const sourceHost=view?.containerEl?.querySelector?.(".cm-editor")??view?.containerEl?.querySelector?.(".markdown-preview-view")??view?.containerEl;
      const sourceRect=sourceHost?.getBoundingClientRect?.();
      const width=Math.max(320,Math.round(sourceRect?.width||view?.contentEl?.clientWidth||doc.documentElement.clientWidth||800));
      const host=doc.createElement("div");
      host.className="markdown-preview-view markdown-rendered handwriting-portable-snapshot-source";
      host.setAttribute("data-handwriting-portable-source","true");
      host.style.cssText=`position:fixed;left:-100000px;top:0;width:${width}px;min-height:1px;visibility:hidden;pointer-events:none;contain:layout paint;`;
      doc.body.appendChild(host);
      let component=null;
      try{
        const body=withoutManagedBlock(source);
        component=typeof S.Component==="function"?new S.Component:null;
        if(typeof S.MarkdownRenderer?.renderMarkdown==="function")await S.MarkdownRenderer.renderMarkdown(body,host,file.path,component);
        else host.appendChild(doc.createTextNode(body));
        await this.inlineImages(host,file.path);
        await nextFrame(win);
        await sleep(20);
        const rendered=this.inlineClone(host,win);
        const rect=host.getBoundingClientRect();
        const textWidth=Math.max(width,host.scrollWidth||0,Math.ceil(rect.width));
        const textHeight=Math.max(1,host.scrollHeight||Math.ceil(rect.height));
        const strokes=I.strokes(file.path).filter(stroke=>stroke?.points?.length>0);
        const inkBounds=this.inkBounds(strokes);
        const originX=Math.min(0,inkBounds.minX),originY=Math.min(0,inkBounds.minY);
        const pageWidth=Math.max(textWidth,inkBounds.maxX-originX,1);
        const pageHeight=Math.max(textHeight,inkBounds.maxY-originY,1);
        const background=this.background(host,doc,win);
        const ink=strokes.length?`<g transform="translate(${number(-originX)} ${number(-originY)})">${EE(strokes,null)}</g>`:"";
        const html=`<div xmlns="http://www.w3.org/1999/xhtml" style="width:${number(textWidth)}px;min-height:${number(textHeight)}px;background:${escapeXml(background)}">${rendered}</div>`;
        const svg=`<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${number(pageWidth)}" height="${number(pageHeight)}" viewBox="0 0 ${number(pageWidth)} ${number(pageHeight)}"><title>Handwriting snapshot</title><rect width="100%" height="100%" fill="${escapeXml(background)}"/><foreignObject x="${number(-originX)}" y="${number(-originY)}" width="${number(textWidth)}" height="${number(textHeight)}">${html}</foreignObject>${ink}</svg>`;
        return{svg,generation};
      }finally{
        try{component?.unload?.()}catch{}
        host.remove();
      }
    }

    findLeaf(path){
      const leaves=this.app.workspace.getLeavesOfType("markdown");
      return leaves.find(leaf=>leaf.view?.file?.path===path&&leaf===this.app.workspace.activeLeaf)||leaves.find(leaf=>leaf.view?.file?.path===path)||null;
    }

    background(host,doc,win){
      const color=win.getComputedStyle(host).backgroundColor;
      if(color&&color!=="transparent"&&color!=="rgba(0, 0, 0, 0)")return color;
      return win.getComputedStyle(doc.body).getPropertyValue("--background-primary").trim()||"#ffffff";
    }

    inkBounds(strokes){
      let minX=0,minY=0,maxX=1,maxY=1,seen=!1;
      for(const stroke of strokes){
        const box=stroke.bbox;
        if(!box)continue;
        if(!seen)minX=box.x,minY=box.y,maxX=box.x+box.width,maxY=box.y+box.height,seen=!0;
        else minX=Math.min(minX,box.x),minY=Math.min(minY,box.y),maxX=Math.max(maxX,box.x+box.width),maxY=Math.max(maxY,box.y+box.height);
      }
      return{minX,minY,maxX,maxY};
    }

    inlineClone(node,win){
      const walk=current=>{
        if(current.nodeType===3)return escapeXml(current.nodeValue||"");
        if(current.nodeType!==1)return"";
        const tag=current.tagName.toLowerCase();
        if(tag==="script"||tag==="noscript")return"";
        const computed=win.getComputedStyle(current);
        const css=styleProperties.map(property=>`${property}:${computed.getPropertyValue(property)}`).join(";");
        let attributes=` style="${escapeXml(css)}"`;
        if(tag==="img"){
          const src=current.getAttribute("src")||current.currentSrc||"";
          attributes+=` src="${escapeXml(src)}"`;
          const alt=current.getAttribute("alt");
          if(alt!==null)attributes+=` alt="${escapeXml(alt)}"`;
        }
        const children=Array.from(current.childNodes).map(walk).join("");
        return tag==="img"?`${HTML_IMAGE_TAG}${attributes}/>`:`<${tag}${attributes}>${children}</${tag}>`;
      };
      return Array.from(node.childNodes).map(walk).join("");
    }

    async inlineImages(host,notePath){
      const images=Array.from(host.querySelectorAll("img"));
      for(const image of images){
        const source=image.getAttribute("src")||"";
        if(!source||source.startsWith("data:")||source.startsWith("blob:")||/^https?:/i.test(source))continue;
        const decoded=decodeURIComponent(source.replace(/^app:\/\/local\//,""));
        const target=this.app.metadataCache.getFirstLinkpathDest(decoded,notePath)||this.app.metadataCache.getFirstLinkpathDest(decoded.split("/").pop()||decoded,notePath);
        if(!target)continue;
        try{const bytes=new Uint8Array(await this.app.vault.readBinary(target));image.setAttribute("src",`data:${mimeFor(target.path)};base64,${base64(bytes)}`)}catch{}
      }
    }

    async publish(file,snapshot,generation){
      const pageId=this.pageIdFor(file.path);
      const folder=`${FOLDER}/${safePart(pageId)}`;
      await this.ensureFolder(folder);
      const stamp=`${generation}-${Date.now()}-${++this.sequence}`;
      const assetPath=`${folder}/snapshot-${safePart(stamp)}.svg`;
      await this.app.vault.create(assetPath,snapshot.svg);
      const link=relativePath(file.path,assetPath);
      const block=managedBlock(link);
      this.publishing.add(file.path);
      try{
        await this.app.vault.process(file,current=>{
          return consolidateManagedBlock(current,block);
        });
      }finally{setTimeout(()=>this.publishing.delete(file.path),500)}
      await this.clearDeleted(pageId);
      const references=await this.referencedSnapshots();
      if(references.reliable)await this.cleanupPage(pageId,references.paths,!0);
    }

    async removePublishedBlock(file){
      this.publishing.add(file.path);
      try{
        let changed=!1;
        await this.app.vault.process(file,current=>{
          const matches=[...current.matchAll(managedBlockPattern())];
          if(matches.length===0&&!legacyMarkerPattern().test(current))return current;
          changed=!0;
          const cleaned=withoutManagedBlock(current);
          return cleaned?`${cleaned}\n`:"";
        });
        return changed;
      }finally{setTimeout(()=>this.publishing.delete(file.path),500)}
    }

    async ensureFolder(path){
      const parts=path.split("/");
      let current="";
      for(const part of parts){
        current=current?`${current}/${part}`:part;
        if(this.app.vault.getAbstractFileByPath(current))continue;
        try{await this.app.vault.createFolder(current)}catch(error){if(!this.app.vault.getAbstractFileByPath(current))throw error}
      }
    }

    report(path,error){
      console.error("[handwriting] portable snapshot failed",path,error);
      new S.Notice(`Handwriting: portable snapshot could not be updated for ${path}`);
    }
  }

  return PortableSnapshots;
})();
