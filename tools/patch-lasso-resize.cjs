const fs = require("fs");
const vm = require("vm");

const bundlePath = "main.js";
const checkOnly = process.argv.includes("--check");
let bundle = fs.readFileSync(bundlePath, "utf8");

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  if (label === "note lasso resize behavior" && source.includes("selectionHandleAt(e,t)") && source.includes("cloneResizeStroke(e,n,r)")) return source;
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`Could not find ${label}`);
  if (checkOnly) throw new Error(`Missing ${label}`);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

bundle = replaceOnce(
  bundle,
  'lassoPts=[];lassoActive=!1;dragFrom=null;dragTotal=null;dragBox=null;dragIds=[];dragHistoryIdentity=null;eraseHistoryIdentity=null;',
  'lassoPts=[];lassoActive=!1;dragFrom=null;dragTotal=null;dragBox=null;dragIds=[];dragHistoryIdentity=null;resizeHandle=null;resizeBox=null;resizeStartBox=null;resizeOriginal=null;resizeIndices=[];resizePreview=null;resizePath=null;resizeScale=1;eraseHistoryIdentity=null;',
  "note lasso state fields"
);

bundle = replaceOnce(
  bundle,
  'selectionBounds(){let e=this.dragBox;if(e&&this.dragTotal&&this.selection.size===e.size){let{box:t}=e;return{x:t.x+this.dragTotal.dx,y:t.y+this.dragTotal.dy,width:t.width,height:t.height}}return this.selection.bounds(this.strokesHere(),()=>null,()=>null)}lassoDown(e){this.showLassoCursor(e);let t=this.camera.screenToWorld(e.x,e.y),n=this.selectionBounds();if(n&&ws(t.x,t.y,ys(n,z(zx,this.scale)))){this.dragFrom={x:t.x,y:t.y},this.dragTotal={dx:0,dy:0},this.dragBox={box:{...n},size:this.selection.size},this.dragIds=[...this.selection.strokeIds];let r=this.filePath();this.dragHistoryIdentity=r?I.captureHistoryIdentity(r):null;return}this.selection.clear(),this.lassoActive=!0,this.lassoPts=[t],this.strokesHere().length===0&&this.sayIfPageEmpty(this.filePath(),"select"),this.redrawSelectionUI()}lassoMove(e){let t=e[e.length-1];if(!t)return;if(this.dragFrom&&this.dragTotal){let r=this.filePath();if(!r||this.selection.isEmpty)return;let s=this.camera.screenToWorld(t.x,t.y),o=s.x-this.dragFrom.x,a=this.selectionBounds(),l=Math.max(s.y-this.dragFrom.y,Ux(a));this.moveLive(r,this.dragIds,o,l),this.dragTotal.dx+=o,this.dragTotal.dy+=l,this.dragFrom={x:s.x,y:this.dragFrom.y+l};let c;if(a){c=[a,{x:a.x+o,y:a.y+l,width:a.width,height:a.height}];for(let h of c)this.damage.addRect(h)}else this.damage.addAll();this.scheduleRepaint("partial"),this.repaintPath(r,c),this.redrawSelectionUI();return}if(!this.lassoActive)return;let n=z(pM,this.scale);for(let r of e){let s=this.camera.screenToWorld(r.x,r.y),o=this.lassoPts[this.lassoPts.length-1];(!o||Math.hypot(s.x-o.x,s.y-o.y)>=n)&&this.lassoPts.push(s)}this.redrawSelectionUI()}commitLiveDrag(){if(!this.dragTotal)return;let{dx:e,dy:t}=this.dragTotal,n=this.dragIds;this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.dragIds=[],this.dragHistoryIdentity=null;let r=this.filePath();r&&n.length&&(e!==0||t!==0)&&(I.save(r),this.dispatchInk({type:"move",path:r,strokeIds:n,dx:e,dy:t}),this.frontierCache.invalidate(r))}lassoUp(){if(this.dragTotal){this.commitLiveDrag(),this.redrawSelectionUI();return}if(!this.lassoActive){this.redrawSelectionUI();return}this.lassoActive=!1,this.selection.selectByLasso(this.lassoPts,this.strokesHere(),[],()=>null),this.lassoPts=[],this.redrawSelectionUI()}',
  'selectionBounds(){if(this.resizeBox&&this.resizeOriginal)return{...this.resizeBox};let e=this.dragBox;if(e&&this.dragTotal&&this.selection.size===e.size){let{box:t}=e;return{x:t.x+this.dragTotal.dx,y:t.y+this.dragTotal.dy,width:t.width,height:t.height}}return this.selection.bounds(this.strokesHere(),()=>null,()=>null)}selectionHandleAt(e,t){if(!t||t.width<=0||t.height<=0)return null;let n=z(14,this.scale),r={nw:{x:t.x,y:t.y},ne:{x:t.x+t.width,y:t.y},sw:{x:t.x,y:t.y+t.height},se:{x:t.x+t.width,y:t.y+t.height}};for(let[s,o]of Object.entries(r))if(Math.hypot(e.x-o.x,e.y-o.y)<=n)return s;return null}resizeAnchor(e,t){return{x:t.includes("w")?e.x+e.width:e.x,y:t.includes("n")?e.y+e.height:e.y}}resizeCorner(e,t){return{x:t.includes("w")?e.x:e.x+e.width,y:t.includes("n")?e.y:e.y+e.height}}resizeScaleForPoint(e,t,n){let r=this.resizeCorner(t,n),s=this.resizeAnchor(t,n),o=r.x-s.x,a=r.y-s.y,l=o*o+a*a;return l<=1e-6?1:Math.max(.05,Math.min(50,((e.x-s.x)*o+(e.y-s.y)*a)/l))}resizeBoxForScale(e,t,n){let r=this.resizeAnchor(e,n),s=e.x-r.x,o=e.y-r.y,a=e.width* t,l=e.height*t,c=r.x+s*t,h=r.y+o*t;return{x:Math.min(r.x,c),y:Math.min(r.y,h),width:a,height:l}}cloneResizeStroke(e,t,n,r){let s=Number.isFinite(e.width)?e.width*r:e.width,o=e.points.map(a=>({...a,x:n.x+(a.x-n.x)*r,y:n.y+(a.y-n.y)*r}));return{...e,points:o,width:s,bbox:dt(o,s*2)}}beginResize(e,t,n){let r=this.filePath();if(!r||this.selection.isEmpty)return!1;let s=new Set(this.selection.strokeIds),o=I.strokes(r),a=[],l=[];for(let c=0;c<o.length;c++){let h=o[c];s.has(h.id)&&(a.push({...h,points:h.points.map(d=>({...d})),bbox:{...h.bbox}}),l.push(c))}return a.length===0?!1:(this.resizeHandle=n,this.resizeStartBox={...t},this.resizeBox={...t},this.resizeOriginal=a,this.resizeIndices=l,this.resizePreview=null,this.resizePath=r,this.resizeScale=1,this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.dragIds=[],!0)}applyResizePreview(e){let t=this.resizePath,n=this.resizeStartBox,r=this.resizeHandle;if(!t||!n||!r||!this.resizeOriginal?.length)return;let s=this.camera.screenToWorld(e.x,e.y),o=this.resizeScaleForPoint(s,n,r),a=this.resizeBoxForScale(n,o,r),l=this.resizePreview??this.resizeOriginal,c=this.resizeOriginal.map(h=>this.cloneResizeStroke(h,a?this.resizeAnchor(n,r):n,o));I.takeLive(t,l.map(h=>h.id)),I.applyAddLive(t,c,this.resizeIndices),this.resizePreview=c,this.resizeBox=a,this.resizeScale=o;for(let h of B)(h===this||h.filePath()===t)&&(h.indexDirty=!0);let d=[];for(let h of l)d.push(h.bbox);for(let h of c)d.push(h.bbox);for(let h of d)this.damage.addRect(h);this.scheduleRepaint("partial"),this.repaintPath(t,d),this.redrawSelectionUI()}commitLiveResize(){let e=this.resizePath,t=this.resizeOriginal,n=this.resizePreview,r=this.resizeIndices,s=this.resizeScale,o=this.selection.size>0;this.resizeHandle=null,this.resizeBox=null,this.resizeStartBox=null,this.resizeOriginal=null,this.resizeIndices=[],this.resizePreview=null,this.resizePath=null,this.resizeScale=1;if(!e||!t||!n||!o)return;let a=Math.abs(s-1)>1e-4;if(a){I.save(e),this.dispatchInk({type:"replace",path:e,removed:t,removedAt:r,inserted:n,insertedAt:r}),this.frontierCache.invalidate(e)}this.redrawSelectionUI()}rollbackLiveResize(){let e=this.resizePath,t=this.resizeOriginal,n=this.resizePreview,r=this.resizeIndices;if(!e||!t||!n)return;I.takeLive(e,n.map(s=>s.id)),I.applyAddLive(e,t,r),this.restoredByRollback(e),this.resizeHandle=null,this.resizeBox=null,this.resizeStartBox=null,this.resizeOriginal=null,this.resizeIndices=[],this.resizePreview=null,this.resizePath=null,this.resizeScale=1}lassoDown(e){this.showLassoCursor(e);let t=this.camera.screenToWorld(e.x,e.y),n=this.selectionBounds(),r=this.selectionHandleAt(t,n);if(r&&this.beginResize(e,n,r))return;if(n&&ws(t.x,t.y,ys(n,z(zx,this.scale)))){this.dragFrom={x:t.x,y:t.y},this.dragTotal={dx:0,dy:0},this.dragBox={box:{...n},size:this.selection.size},this.dragIds=[...this.selection.strokeIds];let s=this.filePath();this.dragHistoryIdentity=s?I.captureHistoryIdentity(s):null;return}this.selection.clear(),this.lassoActive=!0,this.lassoPts=[t],this.strokesHere().length===0&&this.sayIfPageEmpty(this.filePath(),"select"),this.redrawSelectionUI()}lassoMove(e){let t=e[e.length-1];if(!t)return;if(this.resizeHandle&&this.resizePath){this.applyResizePreview(t);return}if(this.dragFrom&&this.dragTotal){let r=this.filePath();if(!r||this.selection.isEmpty)return;let s=this.camera.screenToWorld(t.x,t.y),o=s.x-this.dragFrom.x,a=this.selectionBounds(),l=Math.max(s.y-this.dragFrom.y,Ux(a));this.moveLive(r,this.dragIds,o,l),this.dragTotal.dx+=o,this.dragTotal.dy+=l,this.dragFrom={x:s.x,y:this.dragFrom.y+l};let c;if(a){c=[a,{x:a.x+o,y:a.y+l,width:a.width,height:a.height}];for(let h of c)this.damage.addRect(h)}else this.damage.addAll();this.scheduleRepaint("partial"),this.repaintPath(r,c),this.redrawSelectionUI();return}if(!this.lassoActive)return;let n=z(pM,this.scale);for(let r of e){let s=this.camera.screenToWorld(r.x,r.y),o=this.lassoPts[this.lassoPts.length-1];(!o||Math.hypot(s.x-o.x,s.y-o.y)>=n)&&this.lassoPts.push(s)}this.redrawSelectionUI()}commitLiveDrag(){if(!this.dragTotal)return;let{dx:e,dy:t}=this.dragTotal,n=this.dragIds;this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.dragIds=[],this.dragHistoryIdentity=null;let r=this.filePath();r&&n.length&&(e!==0||t!==0)&&(I.save(r),this.dispatchInk({type:"move",path:r,strokeIds:n,dx:e,dy:t}),this.frontierCache.invalidate(r))}lassoUp(){if(this.resizeHandle){this.commitLiveResize();return}if(this.dragTotal){this.commitLiveDrag(),this.redrawSelectionUI();return}if(!this.lassoActive){this.redrawSelectionUI();return}this.lassoActive=!1,this.selection.selectByLasso(this.lassoPts,this.strokesHere(),[],()=>null),this.lassoPts=[],this.redrawSelectionUI()}',
  "note lasso resize behavior"
);

bundle = replaceOnce(
  bundle,
  'rollbackLiveGesture(){let e=this.eraseHistoryIdentity,t=this.dragHistoryIdentity;this.eraseHistoryIdentity=null,this.dragHistoryIdentity=null;let n=e&&this.erased.length?I.pathForHistoryIdentity(e):null;n&&(I.takeLive(n,[...this.erasePieces]),I.applyAddLive(n,this.erased.map(o=>o.stroke),hu(this.eraseFrom,this.erased)),this.restoredByRollback(n));let r=this.dragTotal,s=t&&r&&(r.dx!==0||r.dy!==0)&&this.dragIds.length?I.pathForHistoryIdentity(t):null;s&&r&&(I.moveStrokes(s,this.dragIds,-r.dx,-r.dy),this.restoredByRollback(s)),this.dragIds=[]}',
  'rollbackLiveGesture(){this.rollbackLiveResize();let e=this.eraseHistoryIdentity,t=this.dragHistoryIdentity;this.eraseHistoryIdentity=null,this.dragHistoryIdentity=null;let n=e&&this.erased.length?I.pathForHistoryIdentity(e):null;n&&(I.takeLive(n,[...this.erasePieces]),I.applyAddLive(n,this.erased.map(o=>o.stroke),hu(this.eraseFrom,this.erased)),this.restoredByRollback(n));let r=this.dragTotal,s=t&&r&&(r.dx!==0||r.dy!==0)&&this.dragIds.length?I.pathForHistoryIdentity(t):null;s&&r&&(I.moveStrokes(s,this.dragIds,-r.dx,-r.dy),this.restoredByRollback(s)),this.dragIds=[]}',
  "resize rollback hook"
);

bundle = replaceOnce(
  bundle,
  'cloneResizeStroke(e,t,n,r){let s=Number.isFinite(e.width)?e.width*r:e.width,o=e.points.map(a=>({...a,x:n.x+(a.x-n.x)*r,y:n.y+(a.y-n.y)*r}));return{...e,points:o,width:s,bbox:dt(o,s*2)}}',
  'cloneResizeStroke(e,n,r){let s=Number.isFinite(e.width)?e.width*r:e.width,o=e.points.map(a=>({...a,x:n.x+(a.x-n.x)*r,y:n.y+(a.y-n.y)*r}));return{...e,points:o,width:s,bbox:dt(o,s*2)}}',
  "resize stroke clone signature"
);

bundle = replaceOnce(
  bundle,
  'this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.spaceLineY=null,this.spaceIds=[],',
  'this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.resizeHandle=null,this.resizeBox=null,this.resizeStartBox=null,this.resizeOriginal=null,this.resizeIndices=[],this.resizePreview=null,this.resizePath=null,this.resizeScale=1,this.spaceLineY=null,this.spaceIds=[];',
  "resize reset state"
);

bundle = replaceOnce(
  bundle,
  'drawSelectionBox(e,t,n){this.markPaint();let r=this.ctx,s=6;r.save(),r.strokeStyle=n,r.lineWidth=1.5,r.setLineDash([4,4]),r.strokeRect((t.x-e.x)*e.zoom-s,(t.y-e.y)*e.zoom-s,t.width*e.zoom+s*2,t.height*e.zoom+s*2),r.restore(),this.dirty=null}',
  'drawSelectionBox(e,t,n,r=!1){this.markPaint();let s=this.ctx,o=6;s.save(),s.strokeStyle=n,s.lineWidth=1.5,s.setLineDash([4,4]),s.strokeRect((t.x-e.x)*e.zoom-o,(t.y-e.y)*e.zoom-o,t.width*e.zoom+o*2,t.height*e.zoom+o*2);if(r){s.setLineDash([]),s.fillStyle="#fff";let a=8,l=[{x:t.x,y:t.y},{x:t.x+t.width,y:t.y},{x:t.x,y:t.y+t.height},{x:t.x+t.width,y:t.y+t.height}];for(let c of l){let h=(c.x-e.x)*e.zoom,d=(c.y-e.y)*e.zoom;s.fillRect(h-a/2,d-a/2,a,a),s.strokeRect(h-a/2,d-a/2,a,a)}}s.restore(),this.dirty=null}',
  "selection resize handles"
);

bundle = replaceOnce(
  bundle,
  'n&&this.tail.drawSelectionBox(o,n,vr),r&&this.tail.drawHead',
  'n&&this.tail.drawSelectionBox(o,n,vr,this.selection.size>0&&!this.lassoActive),r&&this.tail.drawHead',
  "selection handle rendering"
);

new vm.Script(bundle, { filename: bundlePath });
if (!checkOnly) {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with proportional note lasso resizing");
}
