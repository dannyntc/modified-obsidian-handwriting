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

if (bundle.includes("cornerTransform=null")) {
  let changed = false;
  const rotationStart = bundle.indexOf("\nrotateRecoveredGeometry(e,t,n){");
  const resizeStart = rotationStart >= 0 ? bundle.indexOf("beginResize(e,t,n){", rotationStart) : -1;
  const resizePreviewStart = resizeStart >= 0 ? bundle.indexOf("applyResizePreview(e){", resizeStart) : -1;
  if (rotationStart >= 0 && resizeStart > rotationStart && resizePreviewStart > resizeStart) {
    const rotationBlock = bundle.slice(rotationStart, resizeStart);
    bundle = bundle.slice(0, rotationStart) + bundle.slice(resizeStart);
    const insertAt = bundle.indexOf("applyResizePreview(e){");
    bundle = bundle.slice(0, insertAt) + rotationBlock + bundle.slice(insertAt);
    changed = true;
  }
  const staleDamageLoop = "for(let d of c)d.push?u.push(d.bbox):null;";
  if (bundle.includes(staleDamageLoop)) {
    if (checkOnly) throw new Error("Missing rotation damage bounds fix");
    bundle = bundle.replace(staleDamageLoop, "for(let d of c)u.push(d.bbox);");
    changed = true;
  }
  if (changed) fs.writeFileSync(bundlePath, bundle);
  new vm.Script(bundle, { filename: bundlePath });
  console.log(checkOnly ? "" : "Lasso rotation already present");
  process.exit(0);
}

replaceOnce(
  "resizeScale=1;eraseHistoryIdentity=null;",
  "resizeScale=1;cornerTransform=null;eraseHistoryIdentity=null;",
  "lasso rotation state field",
);

replaceOnce(
  "this.resizeScale=1,this.selectionStyleOriginal=null,",
  "this.resizeScale=1,this.cornerTransform=null,this.selectionStyleOriginal=null,",
  "lasso rotation gesture reset",
);

replaceOnce(
  "selectionBounds(){if(this.resizeBox&&this.resizeOriginal)return{...this.resizeBox};",
  "selectionBounds(){if(this.cornerTransform?.preview&&this.cornerTransform.box)return{...this.cornerTransform.box};if(this.resizeBox&&this.resizeOriginal)return{...this.resizeBox};",
  "rotated selection bounds",
);

const rotationMethods = `
rotateRecoveredGeometry(e,t,n){let r=Math.cos(n),s=Math.sin(n),o=i=>({x:t.x+(i.x-t.x)*r-(i.y-t.y)*s,y:t.y+(i.x-t.x)*s+(i.y-t.y)*r}),a=(e.subpaths??[]).map(i=>i.kind==="circle"?{kind:"circle",center:o(i.center),r:i.r}:{kind:"polygon",points:(i.points??[]).map(o)}),l=(e.outline??[]).map(o),c=(e.caps??[]).map(i=>({...o(i),r:i.r})),h=(e.centers??[]).map(o),d=[...a.flatMap(i=>i.kind==="circle"?[i.center]:i.points??[]),...l,...h,...c.flatMap(i=>[{x:i.x-i.r,y:i.y-i.r},{x:i.x+i.r,y:i.y+i.r}])];return{...e,subpaths:a,outline:l,caps:c,centers:h,bbox:dt(d,0)}}
cloneRotateStroke(e,t,n){let r=Math.cos(n),s=Math.sin(n),o=i=>({x:t.x+(i.x-t.x)*r-(i.y-t.y)*s,y:t.y+(i.x-t.x)*s+(i.y-t.y)*r}),a=e.points.map(i=>({...i,...o(i)}));return{...e,points:a,recoveredGeometry:e.recoveredGeometry?this.rotateRecoveredGeometry(e.recoveredGeometry,t,n):e.recoveredGeometry,bbox:dt(a,(Number.isFinite(e.width)?e.width:1)*2)}}
classifyCornerTransform(e){let{center:t,start:n,point:r,threshold:s}=e,o=r.x-n.x,a=r.y-n.y,l=Math.hypot(o,a);if(l<s)return null;let c=n.x-t.x,h=n.y-t.y,d=Math.hypot(c,h);if(d<=1e-6)return"resize";let u=r.x-t.x,p=r.y-t.y,f=Math.abs(c*p-h*u)/d,v=Math.abs(Math.hypot(u,p)-d);return f>v?"rotate":"resize"}
rotateBounds(e){let t=1/0,n=1/0,r=-1/0,s=-1/0;for(let o of e){let a=o.bbox;if(!a)continue;t=Math.min(t,a.x),n=Math.min(n,a.y),r=Math.max(r,a.x+a.width),s=Math.max(s,a.y+a.height)}return Number.isFinite(t)?{x:t,y:n,width:r-t,height:s-n}:null}
beginCornerTransform(e,t){let n=this.filePath();if(!n||this.selection.isEmpty)return!1;let r=new Set(this.selection.strokeIds),s=I.strokes(n),o=[],a=[];for(let l=0;l<s.length;l++){let c=s[l];r.has(c.id)&&(o.push({...c,points:c.points.map(h=>({...h})),bbox:{...c.bbox}}),a.push(l))}if(o.length===0)return!1;let l=this.camera.screenToWorld(e.x,e.y);return this.cornerTransform={startPoint:l,startBox:{...t},center:{x:t.x+t.width/2,y:t.y+t.height/2},original:o,indices:a,path:n,mode:null,preview:null,box:{...t},angle:0},this.dragFrom=null,this.dragTotal=null,this.dragBox=null,this.dragIds=[],!0}
applyRotatePreview(e){let t=this.cornerTransform;if(!t||t.mode!=="rotate"||!t.original?.length)return;let n=this.camera.screenToWorld(e.x,e.y),r=n.x-t.center.x,s=n.y-t.center.y,o=t.startPoint.x-t.center.x,a=t.startPoint.y-t.center.y,l=Math.atan2(o*s-a*r,o*r+a*s),c=t.preview??t.original,h=t.original.map(d=>this.cloneRotateStroke(d,t.center,l));I.takeLive(t.path,c.map(d=>d.id)),I.applyAddLive(t.path,h,t.indices),t.preview=h,t.angle=l,t.box=this.rotateBounds(h);for(let d of B)(d===this||d.filePath()===t.path)&&(d.indexDirty=!0);let u=[];for(let d of c)u.push(d.bbox);for(let d of h)u.push(d.bbox);for(let d of u)this.damage.addRect(d);this.scheduleRepaint("partial"),this.repaintPath(t.path,u),this.redrawSelectionUI()}
applyCornerTransformPreview(e){let t=this.cornerTransform;if(!t)return;let n=this.camera.screenToWorld(e.x,e.y);if(!t.mode){let r=this.classifyCornerTransform({center:t.center,start:t.startPoint,point:n,threshold:z(8,this.scale)});if(!r)return;t.mode=r;if(r==="resize"){this.resizeHandle="se",this.resizeStartBox=t.startBox,this.resizeBox=t.startBox,this.resizeOriginal=t.original,this.resizeIndices=t.indices,this.resizePreview=null,this.resizePath=t.path,this.resizeScale=1,this.cornerTransform=null,this.applyResizePreview(e);return}}this.applyRotatePreview(e)}
commitLiveRotate(){let e=this.cornerTransform,t=e?.original,n=e?.preview,r=e?.indices,s=e?.path,o=e?.angle??0;this.cornerTransform=null;if(!e||e.mode!=="rotate"||!t||!n||!s||!this.selection.size)return;Math.abs(o)>1e-4&&(I.save(s),this.dispatchInk({type:"replace",path:s,removed:t,removedAt:r,inserted:n,insertedAt:r}),this.frontierCache.invalidate(s)),this.redrawSelectionUI()}
rollbackLiveRotate(){let e=this.cornerTransform;if(!e||e.mode!=="rotate"){e?.mode===null&&(this.cornerTransform=null);return}let t=e.path,n=e.original,r=e.preview,s=e.indices;t&&n&&r&&(I.takeLive(t,r.map(o=>o.id)),I.applyAddLive(t,n,s),this.restoredByRollback(t)),this.cornerTransform=null}
`;
replaceOnce(
  "applyResizePreview(e){",
  rotationMethods + "applyResizePreview(e){",
  "lasso rotation methods",
);

replaceOnce(
  'lassoDown(e){this.showLassoCursor(e),this.mobileTools?.dismissSelectionStyle?.(!1);let t=this.camera.screenToWorld(e.x,e.y),n=this.selectionBounds(),r=this.selectionHandleAt(t,n);if(this.selectionTap=null,r&&this.beginResize(e,n,r))return;',
  'lassoDown(e){this.showLassoCursor(e),this.mobileTools?.dismissSelectionStyle?.(!1);let t=this.camera.screenToWorld(e.x,e.y),n=this.selectionBounds(),r=this.selectionHandleAt(t,n);if(this.selectionTap=null,r&&(r==="se"?this.beginCornerTransform(e,n):this.beginResize(e,n,r)))return;',
  "bottom-right rotation entry",
);

replaceOnce(
  'lassoMove(e){let t=e[e.length-1];if(!t)return;if(this.resizeHandle&&this.resizePath){this.applyResizePreview(t);return}',
  'lassoMove(e){let t=e[e.length-1];if(!t)return;if(this.cornerTransform){this.applyCornerTransformPreview(t);return}if(this.resizeHandle&&this.resizePath){this.applyResizePreview(t);return}',
  "corner rotation movement",
);

replaceOnce(
  'lassoUp(){if(this.resizeHandle){this.commitLiveResize(),this.selectionTap=null;return}',
  'lassoUp(){if(this.cornerTransform){this.cornerTransform.mode==="rotate"?this.commitLiveRotate():this.cornerTransform=null,this.selectionTap=null;return}if(this.resizeHandle){this.commitLiveResize(),this.selectionTap=null;return}',
  "corner rotation completion",
);

replaceOnce(
  'rollbackLiveGesture(){this.rollbackSelectionStyle(),this.rollbackLiveResize();let e=this.eraseHistoryIdentity,',
  'rollbackLiveGesture(){this.rollbackSelectionStyle(),this.rollbackLiveRotate(),this.rollbackLiveResize();let e=this.eraseHistoryIdentity,',
  "corner rotation rollback",
);

replaceOnce(
  's.fillRect(h-a/2,d-a/2,a,a),s.strokeRect(h-a/2,d-a/2,a,a)}}s.restore(),this.dirty=null}',
  's.fillRect(h-a/2,d-a/2,a,a),s.strokeRect(h-a/2,d-a/2,a,a)}let c=l[3],h=14;s.beginPath(),s.arc((c.x-e.x)*e.zoom,(c.y-e.y)*e.zoom,h,.25*Math.PI,1.65*Math.PI),s.stroke()}s.restore(),this.dirty=null}',
  "bottom-right rotation cue",
);

new vm.Script(bundle, { filename: bundlePath });
if (!checkOnly) {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with lasso rotation");
}
