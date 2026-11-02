const fs = require("fs");
const vm = require("vm");

const bundlePath = "main.js";
const checkOnly = process.argv.includes("--check");
let bundle = fs.readFileSync(bundlePath, "utf8");

function replaceOnce(source, before, after, label) {
  if (source.includes(after)) return source;
  const index = source.indexOf(before);
  if (index < 0) throw new Error("Could not find " + label);
  if (checkOnly) throw new Error("Missing " + label);
  return source.slice(0, index) + after + source.slice(index + before.length);
}

function removeOnce(source, value, label) {
  const index = source.indexOf(value);
  if (index < 0) return source;
  if (checkOnly) throw new Error("Obsolete " + label + " remains");
  return source.slice(0, index) + source.slice(index + value.length);
}

function replaceSpan(source, startNeedle, endNeedle, replacement, label, finalNeedle) {
  if (finalNeedle && source.includes(finalNeedle)) return source;
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (start < 0 || end < 0) throw new Error("Could not find " + label);
  if (checkOnly) throw new Error("Missing " + label);
  return source.slice(0, start) + replacement + source.slice(end);
}

// Remove the previous toolbar-command/standalone-slider implementation.
bundle = removeOnce(
  bundle,
  ',{icon:"sliders-horizontal",glyph:"St",label:"Style selection",commandId:"handwriting:style-selected-ink",isEnabled:i=>i.hasInkSelection()}',
  "legacy selection style toolbar button",
);
bundle = removeOnce(
  bundle,
  'if(d.commandId==="handwriting:style-selected-ink"){this.openInkSlider=this.openInkSlider==="selection"?null:"selection",this.sliderFromHover=!1,this.setMoreOpen(!1),this.refresh();return}',
  "legacy selection style command branch",
);
bundle = replaceOnce(
  bundle,
  'this.slider=l("Eraser size","3","64","1",(d,u)=>this.host.setEraserRadiusPx(d,u)),this.selectionSlider=l("Selection thickness","50","200","5",(d,u)=>this.host.setSelectionThicknessScale(d/100,u));',
  'this.slider=l("Eraser size","3","64","1",(d,u)=>this.host.setEraserRadiusPx(d,u));',
  "legacy selection thickness slider",
);
bundle = removeOnce(
  bundle,
  ',this.selectionSlider=l("Selection thickness","50","200","5",(d,u)=>this.host.setSelectionThicknessScale(d/100,u)),',
  "legacy selection thickness slider",
);
bundle = removeOnce(bundle, 'this.selectionSlider.pop,', "legacy selection slider popover list");
bundle = removeOnce(bundle, 'selectionSlider;', "legacy selection slider field");
bundle = removeOnce(
  bundle,
  ',t(this.selectionSlider,"handwriting:style-selected-ink",s==="selection"&&this.host.hasInkSelection(),100)',
  "legacy selection slider refresh",
);
bundle = removeOnce(bundle, 'setSelectionThicknessScale(e,t=!1){if(!this.selectionStylePath&&!this.beginSelectionStyle())return;this.applySelectionStylePreview(e),t&&this.commitSelectionStyle()}', "legacy selection scale callback");

const selectionTabsMethod = 'selectionStyleTabsFor(e){let t=e.createDiv({cls:"handwriting-selection-style-tabs"}),n={};for(let r of["pen","highlighter"]){let s=t.createEl("button",{cls:"handwriting-selection-style-tab",text:r==="pen"?"Pen":"Highlighter",attr:{type:"button","aria-label":r==="pen"?"Pen selection style":"Highlighter selection style"}});s.addEventListener("pointerdown",o=>o.preventDefault()),s.addEventListener("click",o=>{o.preventDefault(),this.selectionStyleTool=r,this.openInkSlider=r,this.sliderFromHover=!1,this.refresh()}),n[r]=s}return e.insertBefore(t,e.firstChild),{pop:e,wrap:t,buttons:n}}';
bundle = replaceOnce(
  bundle,
  'this.el=e.createDiv({cls:"handwriting-mobile-tools"}),this.el.dataset.ignoreSwipe="true",this.grip=',
  'this.el=e.createDiv({cls:"handwriting-mobile-tools"}),this.el.dataset.ignoreSwipe="true",this.selectionActionPop=this.el.createDiv({cls:"handwriting-selection-action-pop"}),this.selectionStyleAction=this.selectionActionPop.createEl("button",{cls:"handwriting-selection-action",text:"Style",attr:{"aria-label":"Style selected handwriting",type:"button"}}),this.selectionStyleAction.addEventListener("pointerdown",d=>d.preventDefault()),this.selectionStyleAction.addEventListener("click",d=>{d.preventDefault(),this.openSelectionStyle()}),this.grip=',
  "selection Style action popover",
);
bundle = replaceOnce(
  bundle,
  'this.penSlider=l("Pen size","3","7","1",(d,u)=>this.host.setInkSizeMult("pen",Cb(d,j.baseWidth),u),"pen"),this.hlSlider=l("Highlighter size",String(tr(.25,oe.baseWidth)),String(Math.ceil(tr(1.8,oe.baseWidth))),"1",(d,u)=>this.host.setInkSizeMult("highlighter",Cb(d,oe.baseWidth),u),"highlighter");',
  'this.penSlider=l("Pen size","3","7","1",(d,u)=>this.selectionStyleMode?this.host.setSelectionStyleWidth("pen",d,u):this.host.setInkSizeMult("pen",Cb(d,j.baseWidth),u),"pen"),this.hlSlider=l("Highlighter size",String(tr(.25,oe.baseWidth)),String(Math.ceil(tr(1.8,oe.baseWidth))),"1",(d,u)=>this.selectionStyleMode?this.host.setSelectionStyleWidth("highlighter",d,u):this.host.setInkSizeMult("highlighter",Cb(d,oe.baseWidth),u),"highlighter"),this.selectionPenTabs=this.selectionStyleTabsFor(this.penSlider.pop),this.selectionHlTabs=this.selectionStyleTabsFor(this.hlSlider.pop);',
  "selection-aware handwriting sliders",
);
bundle = replaceOnce(
  bundle,
  'host;el;buttons=[];built=new Set;moreRow;',
  'host;el;buttons=[];built=new Set;selectionActionPop;selectionStyleAction;selectionActionOpen=!1;selectionStyleMode=!1;selectionStyleTool=null;selectionPenTabs;selectionHlTabs;moreRow;',
  "selection style toolbar state",
);
bundle = replaceOnce(
  bundle,
  'hasOpenPop(){return this.openInkSlider!==null||this.eraserPopOpen()}outsideTap=e=>{let t=e.target;t&&(this.el.contains(t)||this.pill.contains(t)||(this.isPreview||this.setMoreOpen(!1),this.closeInkSliders()))}',
  'hasOpenPop(){return this.openInkSlider!==null||this.eraserPopOpen()||this.selectionActionOpen}outsideTap=e=>{let t=e.target;t&&(this.el.contains(t)||this.pill.contains(t)||(this.isPreview||this.setMoreOpen(!1),this.closeInkSliders(!0)))}',
  "selection popover outside dismissal",
);
bundle = replaceOnce(
  bundle,
  't!=="ignore"&&(this.setMoreOpen(!1),this.closeInkSliders(),t==="close-consume"&&(e.preventDefault(),e.stopPropagation()))',
  't!=="ignore"&&(this.setMoreOpen(!1),this.closeInkSliders(!1),t==="close-consume"&&(e.preventDefault(),e.stopPropagation()))',
  "selection popover escape cancellation",
);
bundle = replaceOnce(
  bundle,
  'viewportControls=null;isPreview;',
  "viewportControls=null;" + selectionTabsMethod + "isPreview;",
  "selection style tab builder",
);

const refreshTabsMethod = 'refreshSelectionStyleTabs(){for(let e of[this.selectionPenTabs,this.selectionHlTabs]){if(!e)continue;e.wrap.toggleClass("is-showing",this.selectionStyleMode);for(let t of["pen","highlighter"]){let n=e.buttons[t],r=this.host.selectionStyleHasTool?.(t)??!1;n.toggleClass("is-current",this.selectionStyleTool===t),n.toggleClass("is-hidden",!r),n.disabled=!this.selectionStyleMode||!r,n.setAttribute("aria-pressed",this.selectionStyleTool===t?"true":"false")}}}';
bundle = replaceOnce(
  bundle,
  'refreshQueued=!1;refresh(){',
  refreshTabsMethod + 'refreshQueued=!1;refresh(){',
  "selection style tab refresh",
);
bundle = replaceOnce(
  bundle,
  'let s=this.host.eraserOn()?null:this.openInkSlider;t(this.penSlider,"handwriting:inline-tool-pen",s==="pen"&&this.host.activeTool()==="pen",tr(this.host.inkSizeMult("pen"),j.baseWidth)),t(this.hlSlider,"handwriting:inline-tool-highlighter",s==="highlighter"&&this.host.activeTool()==="highlighter",tr(this.host.inkSizeMult("highlighter"),oe.baseWidth))}',
  'let s=this.host.eraserOn()?null:this.openInkSlider;t(this.penSlider,"handwriting:inline-tool-pen",this.selectionStyleMode?s==="pen"&&this.host.selectionStyleHasTool?.("pen"):s==="pen"&&this.host.activeTool()==="pen",this.selectionStyleMode?this.host.selectionStyleSizePx("pen"):tr(this.host.inkSizeMult("pen"),j.baseWidth)),t(this.hlSlider,"handwriting:inline-tool-highlighter",this.selectionStyleMode?s==="highlighter"&&this.host.selectionStyleHasTool?.("highlighter"):s==="highlighter"&&this.host.activeTool()==="highlighter",this.selectionStyleMode?this.host.selectionStyleSizePx("highlighter"):tr(this.host.inkSizeMult("highlighter"),oe.baseWidth)),this.selectionActionPop.toggleClass("is-showing",this.selectionActionOpen&&this.host.hasInkSelection()),this.refreshSelectionStyleTabs()}',
  "selection style slider refresh",
);
bundle = replaceOnce(
  bundle,
  'let r=this.host.presetsFor(n),s=Bf(r,this.host.toolColor(n),this.host.inkSizeMult(n));',
  'let r=this.host.presetsFor(n),s=Bf(r,this.selectionStyleMode?this.host.selectionStyleColor(n):this.host.toolColor(n),this.selectionStyleMode?this.host.selectionStyleSizeMult(n):this.host.inkSizeMult(n));',
  "selection style preset state",
);
bundle = replaceOnce(
  bundle,
  'this.host.applyPreset(n,a.index),this.closeInkSliders()',
  'this.selectionStyleMode?(this.host.applySelectionStylePreset(n,a.index),this.refresh()):(this.host.applyPreset(n,a.index),this.closeInkSliders())',
  "selection style preset application",
);
bundle = replaceOnce(
  bundle,
  'let r=this.host.toolColor(n);for(let s of this.host.paletteFor(n))',
  'let r=this.selectionStyleMode?this.host.selectionStyleColor(n):this.host.toolColor(n);for(let s of this.host.paletteFor(n))',
  "selection style palette state",
);
bundle = replaceOnce(
  bundle,
  'this.host.pickColor(s.name,s.hex),this.refresh()',
  'this.selectionStyleMode?(this.host.setSelectionStyleColor(n,s.hex,!1),this.refresh()):(this.host.pickColor(s.name,s.hex),this.refresh())',
  "selection style palette application",
);

const selectionPopoverMethods = 'openSelectionActions(){if(!(this.host.supportsSelectionStyle?.()??!1)||!this.host.hasInkSelection())return;this.setCollapsed(!1),this.closeInkSliders(!0),this.selectionActionOpen=!0,this.refresh()}openSelectionStyle(){if(!(this.host.supportsSelectionStyle?.()??!1)||!this.host.hasInkSelection()||!(this.host.beginSelectionStyle?.()??!1))return;this.setCollapsed(!1),this.selectionActionOpen=!1,this.selectionStyleMode=!0,this.selectionStyleTool=this.host.selectionStyleHasTool?.("pen")?"pen":"highlighter",this.openInkSlider=this.selectionStyleTool,this.sliderFromHover=!1,this.setMoreOpen(!1),this.refresh()}closeSelectionActions(){return this.selectionActionOpen?(this.selectionActionOpen=!1,this.refresh(),!0):!1}closeInkSliders(e=!0){let t=this.hasOpenPop()||this.selectionStyleMode||this.selectionActionOpen;if(!t)return!1;this.selectionStyleMode&&this.host.finishSelectionStyle?.(e),this.selectionStyleMode=!1,this.selectionStyleTool=null,this.selectionActionOpen=!1,this.openInkSlider=null,this.eraserPopClosed=!0,this.cancelSliderClose(),this.refresh(),!0}';
if (!bundle.includes('openSelectionActions(){')) {
  bundle = replaceOnce(
    bundle,
    'openSelectionStyle(){this.openInkSlider="selection",this.sliderFromHover=!1,this.setMoreOpen(!1),this.refresh()}closeInkSliders(){return this.hasOpenPop()?(this.openInkSlider=null,this.eraserPopClosed=!0,this.cancelSliderClose(),this.refresh(),!0):!1}',
    selectionPopoverMethods,
    "selection action/style methods",
  );
}
bundle = replaceOnce(
  bundle,
  'closeSelectionActions(){return this.selectionActionOpen?(this.selectionActionOpen=!1,this.refresh(),!0):!1}closeInkSliders(e=!0){',
  'closeSelectionActions(){return this.selectionActionOpen?(this.selectionActionOpen=!1,this.refresh(),!0):!1}dismissSelectionStyle(e=!1){return this.selectionStyleMode?this.closeInkSliders(e):this.closeSelectionActions()}closeInkSliders(e=!0){',
  "selection style dismissal method",
);
bundle = replaceOnce(
  bundle,
  'openSelectionActions(){if(!(this.host.supportsSelectionStyle?.()??!1)||!this.host.hasInkSelection())return;this.closeInkSliders(!0),',
  'openSelectionActions(){if(!(this.host.supportsSelectionStyle?.()??!1)||!this.host.hasInkSelection())return;this.setCollapsed(!1),this.closeInkSliders(!0),',
  "selection action expands toolbar",
);
bundle = replaceOnce(
  bundle,
  'openSelectionStyle(){if(!(this.host.supportsSelectionStyle?.()??!1)||!this.host.hasInkSelection()||!(this.host.beginSelectionStyle?.()??!1))return;this.selectionActionOpen=!1,',
  'openSelectionStyle(){if(!(this.host.supportsSelectionStyle?.()??!1)||!this.host.hasInkSelection()||!(this.host.beginSelectionStyle?.()??!1))return;this.setCollapsed(!1),this.selectionActionOpen=!1,',
  "selection style expands toolbar",
);
bundle = replaceOnce(
  bundle,
  'this.openInkSlider=null,e=!0',
  'this.closeInkSliders(!0),e=!0',
  "selection style hover close",
);
bundle = replaceOnce(
  bundle,
  'destroy(){this.stopModeWatch?.(),this.stopModeWatch=null,this.cancelSliderClose()',
  'destroy(){this.closeInkSliders(!0),this.stopModeWatch?.(),this.stopModeWatch=null,this.cancelSliderClose()',
  "selection style destroy commit",
);

// Replace the old proportional-only helper with a tool-aware style session.
const selectionStyleMethods = 'cloneSelectionStyleStroke(e,t,n,r){let s=e.tool,o=Number.isFinite(e.width)&&Number.isFinite(t[s])&&Number.isFinite(n[s])&&n[s]>0?Math.max(.05,e.width*t[s]/n[s]):e.width,a=typeof r[s]==="string"?r[s]:e.color;return{...e,width:o,color:a,bbox:dt(e.points,o*2)}}selectionStyleMedianWidth(e,t){let n=e.filter(s=>s.tool===t&&Number.isFinite(s.width)).map(s=>s.width).sort((s,o)=>s-o);return n.length===0?(t==="pen"?j.baseWidth:oe.baseWidth):n.length%2?n[(n.length-1)/2]:(n[n.length/2-1]+n[n.length/2])/2}selectionStyleColorFor(e,t){return e.find(n=>n.tool===t&&typeof n.color==="string")?.color??te(t)}selectionStyleHasTool(e,t){return e.some(n=>n.tool===t)}selectionStyleWidthClamp(e,t){let n=t==="pen"?3:Math.round(tr(.25,oe.baseWidth)),r=t==="pen"?7:Math.ceil(tr(1.8,oe.baseWidth)),s=Math.round(Number(e));return Number.isFinite(s)?Math.max(n,Math.min(r,s)):n}beginSelectionStyle(){let e=this.filePath();if(!e||this.selection.isEmpty)return!1;let t=new Set(this.selection.strokeIds),n=I.strokes(e),r=[],s=[];for(let o=0;o<n.length;o++){let a=n[o];t.has(a.id)&&(r.push({...a,points:a.points.map(l=>({...l})),bbox:{...a.bbox}}),s.push(o))}if(r.length===0)return!1;let o={pen:this.selectionStyleHasTool(r,"pen")?this.selectionStyleMedianWidth(r,"pen"):null,highlighter:this.selectionStyleHasTool(r,"highlighter")?this.selectionStyleMedianWidth(r,"highlighter"):null},a={pen:o.pen===null?null:this.selectionStyleWidthClamp(o.pen,"pen"),highlighter:o.highlighter===null?null:this.selectionStyleWidthClamp(o.highlighter,"highlighter")};return this.selectionStyleOriginal=r,this.selectionStyleIndices=s,this.selectionStylePreview=null,this.selectionStylePath=e,this.selectionStyleOriginalWidths=o,this.selectionStyleTargets=a,this.selectionStyleColors={pen:this.selectionStyleColorFor(r,"pen"),highlighter:this.selectionStyleColorFor(r,"highlighter")},!0}applySelectionStylePreview(){let e=this.selectionStylePath,t=this.selectionStyleOriginal,n=this.selectionStyleIndices;if(!e||!t?.length)return;let r=this.selectionStylePreview??t,s=t.map(o=>this.cloneSelectionStyleStroke(o,this.selectionStyleTargets,this.selectionStyleOriginalWidths,this.selectionStyleColors));I.takeLive(e,r.map(o=>o.id)),I.applyAddLive(e,s,n),this.selectionStylePreview=s;for(let o of B)(o===this||o.filePath()===e)&&(o.indexDirty=!0);let a=[];for(let o of r)a.push(o.bbox);for(let o of s)a.push(o.bbox);for(let o of a)this.damage.addRect(o);this.scheduleRepaint("partial"),this.repaintPath(e,a),this.redrawSelectionUI()}clearSelectionStyleState(){this.selectionStyleOriginal=null,this.selectionStyleIndices=[],this.selectionStylePreview=null,this.selectionStylePath=null,this.selectionStyleOriginalWidths={pen:null,highlighter:null},this.selectionStyleTargets={pen:null,highlighter:null},this.selectionStyleColors={pen:null,highlighter:null}}commitSelectionStyle(){let e=this.selectionStylePath,t=this.selectionStyleOriginal,n=this.selectionStylePreview,r=this.selectionStyleIndices;this.clearSelectionStyleState();if(!e||!t||!n)return;let s=n.some((o,a)=>Math.abs(o.width-t[a].width)>1e-4||o.color!==t[a].color);if(!s){I.takeLive(e,n.map(o=>o.id)),I.applyAddLive(e,t,r),this.restoredByRollback(e);return}I.save(e),this.dispatchInk({type:"replace",path:e,removed:t,removedAt:r,inserted:n,insertedAt:r}),this.frontierCache.invalidate(e),this.redrawSelectionUI()}rollbackSelectionStyle(){let e=this.selectionStylePath,t=this.selectionStyleOriginal,n=this.selectionStylePreview,r=this.selectionStyleIndices;this.clearSelectionStyleState();if(!e||!t||!n)return;I.takeLive(e,n.map(s=>s.id)),I.applyAddLive(e,t,r),this.restoredByRollback(e)}finishSelectionStyle(e=!0){e?this.commitSelectionStyle():this.rollbackSelectionStyle()}selectionStyleSizePx(e){return this.selectionStyleTargets?.[e]??0}selectionStyleSizeMult(e){let t=this.selectionStyleSizePx(e);return Number.isFinite(t)?Cb(t,e==="pen"?j.baseWidth:oe.baseWidth):ue(e)}selectionStyleColor(e){return this.selectionStyleColors?.[e]??te(e)}setSelectionStyleWidth(e,t,n=!1){if(!this.selectionStylePath&&!this.beginSelectionStyle())return;this.selectionStyleTargets[e]=this.selectionStyleWidthClamp(t,e),this.applySelectionStylePreview(),n&&this.redrawSelectionUI()}setSelectionStyleColor(e,t,n=!1){if(!this.selectionStylePath&&!this.beginSelectionStyle()||typeof t!=="string")return;this.selectionStyleColors[e]=t,this.applySelectionStylePreview(),n&&this.redrawSelectionUI()}applySelectionStylePreset(e,t){if(!this.selectionStylePath&&!this.beginSelectionStyle())return;let n=Nt(e)[t];n&&(this.setSelectionStyleWidth(e,tr(n.size,e==="pen"?j.baseWidth:oe.baseWidth)),this.setSelectionStyleColor(e,n.hex),this.mobileTools?.refresh())}';
bundle = replaceSpan(bundle, 'cloneSelectionStyleStroke(e,t){', 'applyResizePreview(e)', selectionStyleMethods, "selection style model methods", 'cloneSelectionStyleStroke(e,t,n,r){');

bundle = replaceOnce(
  bundle,
  'selectionStyleOriginal=null;selectionStyleIndices=[];selectionStylePreview=null;selectionStylePath=null;selectionStyleScale=1;lassoPts=[];',
  'selectionStyleOriginal=null;selectionStyleIndices=[];selectionStylePreview=null;selectionStylePath=null;selectionStyleOriginalWidths={pen:null,highlighter:null};selectionStyleTargets={pen:null,highlighter:null};selectionStyleColors={pen:null,highlighter:null};selectionTap=null;lassoPts=[];',
  "selection style session fields",
);
bundle = replaceOnce(
  bundle,
  'this.resizeScale=1,this.selectionStyleOriginal=null,this.selectionStyleIndices=[],this.selectionStylePreview=null,this.selectionStylePath=null,this.selectionStyleScale=1,this.spaceLineY=null,this.spaceIds=[];',
  'this.resizeScale=1,this.selectionStyleOriginal=null,this.selectionStyleIndices=[],this.selectionStylePreview=null,this.selectionStylePath=null,this.selectionStyleOriginalWidths={pen:null,highlighter:null},this.selectionStyleTargets={pen:null,highlighter:null},this.selectionStyleColors={pen:null,highlighter:null},this.selectionTap=null,this.spaceLineY=null,this.spaceIds=[];',
  "selection style gesture reset",
);
bundle = replaceOnce(
  bundle,
  'rollbackLiveGesture(){this.rollbackLiveResize();let e=this.eraseHistoryIdentity,t=this.dragHistoryIdentity;',
  'rollbackLiveGesture(){this.rollbackSelectionStyle(),this.rollbackLiveResize();let e=this.eraseHistoryIdentity,t=this.dragHistoryIdentity;',
  "selection style gesture rollback",
);

const lassoDown = 'lassoDown(e){this.showLassoCursor(e),this.mobileTools?.dismissSelectionStyle?.(!1);let t=this.camera.screenToWorld(e.x,e.y),n=this.selectionBounds(),r=this.selectionHandleAt(t,n);if(this.selectionTap=null,r&&this.beginResize(e,n,r))return;if(n&&ws(t.x,t.y,ys(n,z(zx,this.scale)))){this.selectionTap={x:t.x,y:t.y,moved:!1},this.dragFrom={x:t.x,y:t.y},this.dragTotal={dx:0,dy:0},this.dragBox={box:{...n},size:this.selection.size},this.dragIds=[...this.selection.strokeIds];let s=this.filePath();this.dragHistoryIdentity=s?I.captureHistoryIdentity(s):null;return}this.selection.clear(),this.lassoActive=!0,this.lassoPts=[t],this.strokesHere().length===0&&this.sayIfPageEmpty(this.filePath(),"select"),this.redrawSelectionUI()}';
bundle = replaceSpan(bundle, 'lassoDown(e){', 'lassoMove(e){', lassoDown, "lasso tap hit test", 'lassoDown(e){this.showLassoCursor(e),this.mobileTools?.dismissSelectionStyle?.(!1)');

const lassoMove = 'lassoMove(e){let t=e[e.length-1];if(!t)return;if(this.resizeHandle&&this.resizePath){this.applyResizePreview(t);return}if(this.dragFrom&&this.dragTotal){let r=this.filePath();if(!r||this.selection.isEmpty)return;let s=this.camera.screenToWorld(t.x,t.y);if(this.selectionTap&&!this.selectionTap.moved){if(Math.hypot(s.x-this.selectionTap.x,s.y-this.selectionTap.y)<z(8,this.scale))return;this.selectionTap.moved=!0}let o=s.x-this.dragFrom.x,a=this.selectionBounds(),l=Math.max(s.y-this.dragFrom.y,Ux(a));this.moveLive(r,this.dragIds,o,l),this.dragTotal.dx+=o,this.dragTotal.dy+=l,this.dragFrom={x:s.x,y:this.dragFrom.y+l};let c;if(a){c=[a,{x:a.x+o,y:a.y+l,width:a.width,height:a.height}];for(let h of c)this.damage.addRect(h)}else this.damage.addAll();this.scheduleRepaint("partial"),this.repaintPath(r,c),this.redrawSelectionUI();return}if(!this.lassoActive)return;let n=z(pM,this.scale);for(let r of e){let s=this.camera.screenToWorld(r.x,r.y),o=this.lassoPts[this.lassoPts.length-1];(!o||Math.hypot(s.x-o.x,s.y-o.y)>=n)&&this.lassoPts.push(s)}this.redrawSelectionUI()}';
bundle = replaceSpan(bundle, 'lassoMove(e){', 'commitLiveDrag(){', lassoMove, "lasso movement threshold", 'lassoMove(e){let t=e[e.length-1];if(!t)return;if(this.resizeHandle&&this.resizePath){this.applyResizePreview(t);return}if(this.dragFrom&&this.dragTotal){let r=this.filePath();if(!r||this.selection.isEmpty)return;let s=this.camera.screenToWorld(t.x,t.y);if(this.selectionTap&&!this.selectionTap.moved){');

bundle = replaceOnce(
  bundle,
  'lassoUp(){if(this.resizeHandle){this.commitLiveResize();return}if(this.dragTotal){let e=this.dragTotal.dx,t=this.dragTotal.dy,n=this.selection.size>0;this.commitLiveDrag(),e===0&&t===0&&n&&this.mobileTools?.openSelectionStyle(),this.redrawSelectionUI();return}',
  'lassoUp(){if(this.resizeHandle){this.commitLiveResize(),this.selectionTap=null;return}if(this.dragTotal){let e=this.dragTotal.dx,t=this.dragTotal.dy,n=this.selection.size>0,a=!!this.selectionTap&&!this.selectionTap.moved;this.commitLiveDrag(),this.selectionTap=null,e===0&&t===0&&n&&a&&this.mobileTools?.openSelectionActions(),this.redrawSelectionUI();return}',
  "lasso contextual style action",
);
bundle = replaceOnce(bundle, 'if(t.pointerType!=="touch"&&!r&&!this.selection.isEmpty)', 'if(!r&&!this.selection.isEmpty)', "touch selected-ink hit test");
bundle = replaceOnce(
  bundle,
  'hasInkSelection:()=>!this.selection.isEmpty,setSelectionThicknessScale:(s,o)=>this.setSelectionThicknessScale(s,o),mouseInkOn:()=>me(),',
  'hasInkSelection:()=>!this.selection.isEmpty,supportsSelectionStyle:()=>!0,beginSelectionStyle:()=>this.beginSelectionStyle(),finishSelectionStyle:s=>s?this.commitSelectionStyle():this.rollbackSelectionStyle(),selectionStyleHasTool:s=>this.selectionStyleHasTool(this.selectionStyleOriginal??this.strokesHere(),s),selectionStyleSizePx:s=>this.selectionStyleSizePx(s),selectionStyleSizeMult:s=>this.selectionStyleSizeMult(s),selectionStyleColor:s=>this.selectionStyleColor(s),setSelectionStyleWidth:(s,o,a)=>this.setSelectionStyleWidth(s,o,a),setSelectionStyleColor:(s,o,a)=>this.setSelectionStyleColor(s,o,a),applySelectionStylePreset:(s,o)=>this.applySelectionStylePreset(s,o),mouseInkOn:()=>me(),',
  "selection style host callbacks",
);

const finalMarkers = [
  'handwriting-selection-action-pop',
  'openSelectionActions(){',
  'selectionStyleMode',
  'selectionStyleOriginalWidths',
  'cloneSelectionStyleStroke(e,t,n,r){',
  'setSelectionStyleWidth(e,t,n=!1)',
  'setSelectionStyleColor(e,t,n=!1)',
  'selectionTap',
  'this.mobileTools?.openSelectionActions()',
];
for (const marker of finalMarkers) {
  if (!bundle.includes(marker)) throw new Error("Missing final selection-style marker: " + marker);
}
for (const obsolete of [
  'handwriting:style-selected-ink',
  'label:"Style selection"',
  'selectionSlider',
  'Selection thickness',
  'selectionStyleScale',
  'setSelectionThicknessScale',
  'this.mobileTools?.openSelectionStyle()',
]) {
  if (bundle.includes(obsolete)) throw new Error("Obsolete selection-style marker remains: " + obsolete);
}

try {
  new vm.Script(bundle, { filename: bundlePath });
} catch (error) {
  console.error(error.name + ": " + error.message);
  throw error;
}
if (!checkOnly) {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with contextual lasso handwriting styling");
}
