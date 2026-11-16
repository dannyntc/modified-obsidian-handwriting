const fs = require("fs");
const vm = require("vm");

const bundlePath = "main.js";
const checkOnly = process.argv.includes("--check");
let bundle = fs.readFileSync(bundlePath, "utf8");

function replaceOnce(before, after, label) {
  const count = bundle.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  if (checkOnly) throw new Error(`Missing ${label}`);
  bundle = bundle.replace(before, after);
}

function replaceSpan(startMarker, endMarker, replacement, label) {
  const start = bundle.indexOf(startMarker);
  const end = bundle.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not locate ${label}`);
  if (checkOnly) throw new Error(`Missing ${label}`);
  bundle = bundle.slice(0, start) + replacement + bundle.slice(end);
}

if (bundle.includes("selectionFrame=null")) {
  new vm.Script(bundle, { filename: bundlePath });
  console.log(checkOnly ? "" : "Selection frame already present");
  process.exit(0);
}

const frameHelpers = `
function selectionFrameFromBox(e,t=0){return e?{center:{x:e.x+e.width/2,y:e.y+e.height/2},width:Math.max(0,e.width),height:Math.max(0,e.height),angle:Number.isFinite(t)?t:0}:null}
function selectionFrameCorners(e){let t=Number.isFinite(e.angle)?e.angle:0,n=Math.cos(t),r=Math.sin(t),s=e.width/2,o=e.height/2,a=i=>({x:e.center.x+i.x*n-i.y*r,y:e.center.y+i.x*r+i.y*n});return{nw:a({x:-s,y:-o}),ne:a({x:s,y:-o}),se:a({x:s,y:o}),sw:a({x:-s,y:o})}}
function selectionFrameBounds(e){let t=selectionFrameCorners(e),n=Object.values(t),r=Math.min(...n.map(s=>s.x)),o=Math.min(...n.map(s=>s.y)),a=Math.max(...n.map(s=>s.x)),l=Math.max(...n.map(s=>s.y));return{x:r,y:o,width:a-r,height:l-o}}
function selectionFrameContains(e,t,n=0){let r=Number.isFinite(e.angle)?e.angle:0,o=Math.cos(r),a=Math.sin(r),l=t.x-e.center.x,c=t.y-e.center.y,h=l*o+c*a,d=-l*a+c*o;return Math.abs(h)<=e.width/2+n&&Math.abs(d)<=e.height/2+n}
`;
replaceOnce("\nvar VC=160,Ba=class", "\n" + frameHelpers + "var VC=160,Ba=class", "selection frame helpers");

replaceOnce(
  "selectionTap=null;lassoPts=[];lassoActive=!1;dragFrom=null;dragTotal=null;dragBox=null;dragIds=[];dragHistoryIdentity=null;resizeHandle=null;resizeBox=null;resizeStartBox=null;resizeOriginal=null;",
  "selectionTap=null;selectionFrame=null;lassoPts=[];lassoActive=!1;dragFrom=null;dragTotal=null;dragBox=null;dragIds=[];dragHistoryIdentity=null;resizeHandle=null;resizeBox=null;resizeStartBox=null;resizeStartFrame=null;resizeFrame=null;resizeOriginal=null;",
  "selection frame state fields",
);

replaceOnce(
  "this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.resizeHandle=null,this.resizeBox=null,this.resizeStartBox=null,this.resizeOriginal=null,",
  "this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.resizeHandle=null,this.resizeBox=null,this.resizeStartBox=null,this.resizeStartFrame=null,this.resizeFrame=null,this.resizeOriginal=null,",
  "selection frame resize reset fields",
);

replaceOnce(
  "this.selection.clear(),this.lassoPts=[],",
  "this.selection.clear(),this.selectionFrame=null,this.lassoPts=[],",
  "selection frame gesture reset",
);

replaceOnce(
  "selectionBounds(){",
  'selectionFrameFromBounds(e,t=0){return selectionFrameFromBox(e,t)}selectionFrameForOverlay(e){return this.cornerTransform?.frame??this.resizeFrame??this.selectionFrame??this.selectionFrameFromBounds(e)}selectionBounds(){if(this.selection.isEmpty){this.selectionFrame=null;return null}if(this.cornerTransform?.frame)return selectionFrameBounds(this.cornerTransform.frame);if(this.resizeFrame)return selectionFrameBounds(this.resizeFrame);if(this.selectionFrame)return selectionFrameBounds(this.selectionFrame);',
  "selection frame methods",
);

replaceOnce(
  "selectionHandleAt(e,t){if(!t||t.width<=0||t.height<=0)return null;let n=z(14,this.scale),r={nw:{x:t.x,y:t.y},ne:{x:t.x+t.width,y:t.y},sw:{x:t.x,y:t.y+t.height},se:{x:t.x+t.width,y:t.y+t.height}};for(let[s,o]of Object.entries(r))if(Math.hypot(e.x-o.x,e.y-o.y)<=n)return s;return null}",
  "selectionHandleAt(e,t){if(!t||t.width<=0||t.height<=0)return null;let n=z(14,this.scale),r=selectionFrameCorners(t);for(let[s,o]of Object.entries(r))if(Math.hypot(e.x-o.x,e.y-o.y)<=n)return s;return null}",
  "rotated selection handle hit testing",
);

replaceSpan(
  "resizeAnchor(e,t){",
  "cloneResizeStroke(e,n,r){",
  "resizeAnchor(e,t){let n=selectionFrameCorners(e),r={nw:\"se\",ne:\"sw\",sw:\"ne\",se:\"nw\"}[t];return n[r]}resizeCorner(e,t){return selectionFrameCorners(e)[t]}resizeScaleForPoint(e,t,n){let r=this.resizeCorner(t,n),s=this.resizeAnchor(t,n),o=r.x-s.x,a=r.y-s.y,l=o*o+a*a;return l<=1e-6?1:Math.max(.05,Math.min(50,((e.x-s.x)*o+(e.y-s.y)*a)/l))}resizeBoxForScale(e,t,n){let r=this.resizeAnchor(e,n),s=e.center.x-r.x,o=e.center.y-r.y,a=e.width*t,l=e.height*t;return{center:{x:r.x+s*t,y:r.y+o*t},width:a,height:l,angle:e.angle}}",
  "frame-aware resize geometry",
);

replaceSpan(
  "beginResize(e,t,n){",
  "cloneSelectionStyleStroke(e,t,n,r){",
  'beginResize(e,t,n){let r=this.filePath();if(!r||this.selection.isEmpty)return!1;let s=new Set(this.selection.strokeIds),o=I.strokes(r),a=[],l=[];for(let c=0;c<o.length;c++){let h=o[c];s.has(h.id)&&(a.push({...h,points:h.points.map(d=>({...d})),bbox:{...h.bbox}}),l.push(c))}return a.length===0?!1:(this.resizeHandle=n,this.resizeStartFrame={...t,center:{...t.center}},this.resizeFrame={...t,center:{...t.center}},this.resizeStartBox=selectionFrameBounds(t),this.resizeBox=selectionFrameBounds(t),this.resizeOriginal=a,this.resizeIndices=l,this.resizePreview=null,this.resizePath=r,this.resizeScale=1,this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.dragIds=[],!0)}',
  "frame-aware resize start",
);

replaceSpan(
  "applyResizePreview(e){",
  "commitLiveResize(){",
  'applyResizePreview(e){let t=this.resizePath,n=this.resizeStartFrame,r=this.resizeHandle;if(!t||!n||!r||!this.resizeOriginal?.length)return;let s=this.camera.screenToWorld(e.x,e.y),o=this.resizeScaleForPoint(s,n,r),a=this.resizeBoxForScale(n,o,r),l=this.resizePreview??this.resizeOriginal,c=this.resizeOriginal.map(h=>this.cloneResizeStroke(h,this.resizeAnchor(n,r),o));I.takeLive(t,l.map(h=>h.id)),I.applyAddLive(t,c,this.resizeIndices),this.resizePreview=c,this.resizeFrame=a,this.resizeBox=selectionFrameBounds(a),this.resizeScale=o;for(let h of B)(h===this||h.filePath()===t)&&(h.indexDirty=!0);let d=[];for(let h of l)d.push(h.bbox);for(let h of c)d.push(h.bbox);for(let h of d)this.damage.addRect(h);this.scheduleRepaint("partial"),this.repaintPath(t,d),this.redrawSelectionUI()}',
  "frame-aware resize preview",
);

replaceSpan(
  "commitLiveResize(){",
  "rollbackLiveResize(){",
  'commitLiveResize(){let e=this.resizePath,t=this.resizeOriginal,n=this.resizePreview,r=this.resizeIndices,s=this.resizeScale,o=this.resizeFrame,a=this.selection.size>0;this.resizeHandle=null,this.resizeBox=null,this.resizeStartBox=null,this.resizeStartFrame=null,this.resizeFrame=null,this.resizeOriginal=null,this.resizeIndices=[],this.resizePreview=null,this.resizePath=null,this.resizeScale=1,o&&a&&(this.selectionFrame=o);if(!e||!t||!n||!a)return;let l=Math.abs(s-1)>1e-4;l&&(I.save(e),this.dispatchInk({type:"replace",path:e,removed:t,removedAt:r,inserted:n,insertedAt:r}),this.frontierCache.invalidate(e)),this.redrawSelectionUI()}',
  "frame-aware resize commit",
);

replaceSpan(
  "rollbackLiveResize(){",
  "lassoDown(e){",
  'rollbackLiveResize(){let e=this.resizePath,t=this.resizeOriginal,n=this.resizePreview,r=this.resizeIndices;if(!e||!t||!n)return;I.takeLive(e,n.map(s=>s.id)),I.applyAddLive(e,t,r),this.restoredByRollback(e),this.resizeHandle=null,this.resizeBox=null,this.resizeStartBox=null,this.resizeStartFrame=null,this.resizeFrame=null,this.resizeOriginal=null,this.resizeIndices=[],this.resizePreview=null,this.resizePath=null,this.resizeScale=1}',
  "frame-aware resize rollback",
);

replaceSpan(
  "beginCornerTransform(e,t){",
  "applyRotatePreview(e){",
  'beginCornerTransform(e,t){let n=this.filePath();if(!n||this.selection.isEmpty)return!1;let r=new Set(this.selection.strokeIds),s=I.strokes(n),o=[],a=[];for(let l=0;l<s.length;l++){let c=s[l];r.has(c.id)&&(o.push({...c,points:c.points.map(h=>({...h})),bbox:{...c.bbox}}),a.push(l))}if(o.length===0)return!1;let l=this.camera.screenToWorld(e.x,e.y);return this.cornerTransform={startPoint:l,startFrame:{...t,center:{...t.center}},center:{...t.center},original:o,indices:a,path:n,mode:null,preview:null,frame:null,box:selectionFrameBounds(t),angle:0},this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.dragIds=[],!0}',
  "oriented rotation start frame",
);

replaceSpan(
  "applyRotatePreview(e){",
  "applyCornerTransformPreview(e){",
  'applyRotatePreview(e){let t=this.cornerTransform;if(!t||t.mode!=="rotate"||!t.original?.length)return;let n=this.camera.screenToWorld(e.x,e.y),r=n.x-t.center.x,s=n.y-t.center.y,o=t.startPoint.x-t.center.x,a=t.startPoint.y-t.center.y,l=Math.atan2(o*s-a*r,o*r+a*s),c=t.angle??0;if(t.preview){while(l-c>Math.PI)l-=Math.PI*2;while(l-c<-Math.PI)l+=Math.PI*2}let h=t.preview??t.original,d=t.original.map(u=>this.cloneRotateStroke(u,t.center,l));I.takeLive(t.path,h.map(u=>u.id)),I.applyAddLive(t.path,d,t.indices),t.preview=d,t.angle=l,t.frame={...t.startFrame,center:{...t.startFrame.center},angle:t.startFrame.angle+l},t.box=selectionFrameBounds(t.frame);for(let u of B)(u===this||u.filePath()===t.path)&&(u.indexDirty=!0);let f=[];for(let u of h)f.push(u.bbox);for(let u of d)f.push(u.bbox);for(let u of f)this.damage.addRect(u);this.scheduleRepaint("partial"),this.repaintPath(t.path,f),this.redrawSelectionUI()}',
  "oriented rotation preview frame",
);

replaceOnce(
  'this.resizeHandle="se",this.resizeStartBox=t.startBox,this.resizeBox=t.startBox,this.resizeOriginal=t.original,this.resizeIndices=t.indices,this.resizePreview=null,this.resizePath=t.path,this.resizeScale=1,this.cornerTransform=null,this.applyResizePreview(e);return',
  'this.resizeHandle="se",this.resizeStartFrame=t.startFrame,this.resizeFrame={...t.startFrame,center:{...t.startFrame.center}},this.resizeStartBox=selectionFrameBounds(t.startFrame),this.resizeBox=selectionFrameBounds(t.startFrame),this.resizeOriginal=t.original,this.resizeIndices=t.indices,this.resizePreview=null,this.resizePath=t.path,this.resizeScale=1,this.cornerTransform=null,this.applyResizePreview(e);return',
  "oriented corner resize handoff",
);

replaceSpan(
  "commitLiveRotate(){",
  "rollbackLiveRotate(){",
  'commitLiveRotate(){let e=this.cornerTransform,t=e?.original,n=e?.preview,r=e?.indices,s=e?.path,o=e?.angle??0,a=e?.frame;this.cornerTransform=null;a&&e?.mode==="rotate"&&(this.selectionFrame=a);if(!e||e.mode!=="rotate"||!t||!n||!s||!this.selection.size)return;Math.abs(o)>1e-4&&(I.save(s),this.dispatchInk({type:"replace",path:s,removed:t,removedAt:r,inserted:n,insertedAt:r}),this.frontierCache.invalidate(s)),this.redrawSelectionUI()}',
  "oriented rotation commit frame",
);

replaceOnce(
  'let t=this.camera.screenToWorld(e.x,e.y),n=this.selectionBounds(),r=this.selectionHandleAt(t,n);if(this.selectionTap=null,r&&(r==="se"?this.beginCornerTransform(e,n):this.beginResize(e,n,r)))return;if(n&&ws(t.x,t.y,ys(n,z(zx,this.scale)))){',
  'let t=this.camera.screenToWorld(e.x,e.y),n=this.selectionBounds(),a=this.selectionFrameForOverlay(n),r=this.selectionHandleAt(t,a);if(this.selectionTap=null,r&&(r==="se"?this.beginCornerTransform(e,a):this.beginResize(e,a,r)))return;if(a&&selectionFrameContains(a,t,z(zx,this.scale))){',
  "oriented lasso hit testing",
);

replaceOnce(
  'this.selectionTap={x:t.x,y:t.y,moved:!1},this.dragFrom={x:t.x,y:t.y},this.dragTotal={dx:0,dy:0},this.dragBox={box:{...n},size:this.selection.size},',
  'this.selectionFrame=a,this.selectionTap={x:t.x,y:t.y,moved:!1},this.dragFrom={x:t.x,y:t.y},this.dragTotal={dx:0,dy:0},this.dragBox={box:{...n},size:this.selection.size},',
  "selection frame move start",
);

replaceOnce(
  'this.selection.clear(),this.lassoActive=!0,this.lassoPts=[t],',
  'this.selection.clear(),this.selectionFrame=null,this.lassoActive=!0,this.lassoPts=[t],',
  "selection frame lasso reset",
);

replaceOnce(
  'this.dragFrom={x:s.x,y:this.dragFrom.y+l};let c;if(a){',
  'this.dragFrom={x:s.x,y:this.dragFrom.y+l},this.selectionFrame&& (this.selectionFrame={...this.selectionFrame,center:{x:this.selectionFrame.center.x+o,y:this.selectionFrame.center.y+l}});let c;if(a){',
  "selection frame move preview",
);

replaceOnce(
  'this.selection.selectByLasso(this.lassoPts,this.strokesHere(),[],()=>null),this.lassoPts=[],this.redrawSelectionUI()',
  'this.selection.selectByLasso(this.lassoPts,this.strokesHere(),[],()=>null);let e=this.selection.bounds(this.strokesHere(),()=>null,()=>null);this.selectionFrame=e?selectionFrameFromBox(e):null,this.lassoPts=[],this.redrawSelectionUI()',
  "selection frame lasso completion",
);

replaceOnce(
  'this.selection.selectExactly(t.map(u=>u.id)),this.redrawSelectionUI()',
  'this.selection.selectExactly(t.map(u=>u.id)),this.selectionFrame=selectionFrameFromBox(this.selection.bounds(this.strokesHere(),()=>null,()=>null)),this.redrawSelectionUI()',
  "selection frame paste selection",
);

replaceOnce(
  'let t=this.spacePreview,n=this.selectionBounds(),r=this.builder?this.activeWet.head():void 0,s=this.lassoActive&&this.lassoPts.length>1||t!==null&&t.doc===this.view.state.doc||n!==null;',
  'let t=this.spacePreview,n=this.selectionBounds(),i=this.selectionFrameForOverlay(n),r=this.builder?this.activeWet.head():void 0,s=this.lassoActive&&this.lassoPts.length>1||t!==null&&t.doc===this.view.state.doc||n!==null;',
  "selection frame redraw state",
);

replaceOnce(
  'n&&this.tail.drawSelectionBox(o,n,vr,this.selection.size>0&&!this.lassoActive)',
  'i&&this.tail.drawSelectionBox(o,i,vr,this.selection.size>0&&!this.lassoActive)',
  "rotated selection overlay draw call",
);

replaceSpan(
  "drawSelectionBox(e,t,n,r=!1){",
  "drawSpaceDivider(e,t,n,r){",
  'drawSelectionBox(e,t,n,r=!1){this.markPaint();let s=this.ctx,o=6,a=Number.isFinite(t.angle)?t.angle:0,c=t.center??{x:t.x+t.width/2,y:t.y+t.height/2},h=t.width,d=t.height;s.save(),s.strokeStyle=n,s.lineWidth=1.5,s.translate((c.x-e.x)*e.zoom,(c.y-e.y)*e.zoom),s.rotate(a),s.setLineDash([4,4]),s.strokeRect(-h*e.zoom/2-o,-d*e.zoom/2-o,h*e.zoom+o*2,d*e.zoom+o*2);if(r){s.setLineDash([]),s.fillStyle="#fff";let u=8,p=[{x:-h/2,y:-d/2},{x:h/2,y:-d/2},{x:h/2,y:d/2},{x:-h/2,y:d/2}];for(let f of p){let v=f.x*e.zoom,m=f.y*e.zoom;s.fillRect(v-u/2,m-u/2,u,u),s.strokeRect(v-u/2,m-u/2,u,u)}let f=p[2],v=14;s.beginPath(),s.arc(f.x*e.zoom,f.y*e.zoom,v,.25*Math.PI,1.65*Math.PI),s.stroke()}s.restore(),this.dirty=null}',
  "rotated selection overlay renderer",
);

try {
  new vm.Script(bundle, { filename: bundlePath });
} catch (error) {
  console.error(`${error.name}: ${error.message}`);
  process.exit(1);
}
if (!checkOnly) {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with oriented lasso selection frame");
}
