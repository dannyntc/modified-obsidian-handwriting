#!/usr/bin/env node
const fs = require("fs");
const vm = require("vm");

const path = "main.js";
const checkOnly = process.argv.includes("--check");
let main = fs.readFileSync(path, "utf8");

const helper = `function layoutHandwritingOverlayStack(paneRect,toolbarRect,zoomRect,corner,gap=8){let e=8,t=corner.startsWith("bottom"),n=paneRect.left+e,r=paneRect.right-e,s=corner.includes("left")?toolbarRect.left:corner.includes("center")?toolbarRect.left+(toolbarRect.width-zoomRect.width)/2:toolbarRect.right-zoomRect.width;s=Math.max(n,Math.min(s,r-zoomRect.width));let o=t?paneRect.bottom-e-zoomRect.height-gap-toolbarRect.height:Math.max(toolbarRect.top,zoomRect.top+zoomRect.height+gap),a=paneRect.top+e,l=Math.max(a,paneRect.bottom-e-toolbarRect.height);o=Math.max(a,Math.min(o,l));let c=t?o+toolbarRect.height+gap:zoomRect.top,h=paneRect.top+e,d=Math.max(h,paneRect.bottom-e-zoomRect.height);return{toolbarDy:o-toolbarRect.top,zoomDx:s-zoomRect.left,zoomDy:Math.max(h,Math.min(c,d))-zoomRect.top,side:t?"below":"above"}}\n`;

if (main.includes("layoutHandwritingOverlayStack")) {
  const start = main.indexOf("function layoutHandwritingOverlayStack");
  const end = main.indexOf("\nvar VC=160", start);
  if (start < 0 || end < 0) throw new Error("Could not locate the existing overlay helper");
  main = main.slice(0, start) + helper.trimEnd() + main.slice(end);
  new vm.Script(main);
  if (!checkOnly) fs.writeFileSync(path, main);
  console.log(checkOnly ? "" : "Refreshed adaptive selection overlay helper");
  process.exit(0);
}

function replaceOnce(needle, replacement, label) {
  const count = main.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  main = main.replace(needle, replacement);
}

replaceOnce("var VC=160,Ba=class", helper + "var VC=160,Ba=class", "overlay layout helper");

replaceOnce(
  'setInking(e){this.inking=e,this.stepAside.set(e&&td()==="auto")}penUp(){',
  'setInking(e){this.inking=e,this.stepAside.set(e&&td()==="auto")}setSelectionOverlayTransform(e=0,t=0,n=!1){let r=e===0&&t===0?"":`translate(${e}px, ${t}px)`;this.element.setCssStyles({transform:r}),this.element.toggleClass("is-selection-stack",n)}penUp(){',
  "zoom transform method",
);

replaceOnce(
  'stepAside=new Ba(()=>[this.el,this.pill]);stopModeWatch=null;corner="top-right";dodge={x:0,y:0};dragOffset={x:0,y:0};',
  'stepAside=new Ba(()=>[this.el,this.pill]);selectionOverlayOpen=!1;selectionOverlayFrame=null;selectionOverlayOffset={x:0,y:0};stopModeWatch=null;corner="top-right";dodge={x:0,y:0};dragOffset={x:0,y:0};',
  "overlay state",
);

replaceOnce(
  'this.selectionActionPop.toggleClass("is-showing",this.selectionActionOpen&&this.host.hasInkSelection()),this.refreshSelectionStyleTabs()}paintPresets',
  'this.selectionActionPop.toggleClass("is-showing",this.selectionActionOpen&&this.host.hasInkSelection()),this.refreshSelectionStyleTabs(),this.scheduleSelectionOverlayLayout()}paintPresets',
  "refresh scheduling",
);

const overlayMethods = 'selectionOverlayIsOpen(){return this.selectionActionOpen||this.selectionStyleMode}scheduleSelectionOverlayLayout(){let e=this.el.ownerDocument.defaultView??window;if(this.selectionOverlayFrame!==null||!this.viewportControls)return;this.selectionOverlayFrame=e.requestAnimationFrame(()=>{this.selectionOverlayFrame=null;let t=this.selectionOverlayIsOpen(),n=this.viewportControls;if(!t){this.selectionOverlayOpen=!1,this.selectionOverlayOffset={x:0,y:0},n.setSelectionOverlayTransform(0,0,!1),this.paintTransform();return}let r=this.el.classList.contains("is-collapsed")?this.pill:this.el,s=layoutHandwritingOverlayStack(this.pane.getBoundingClientRect(),r.getBoundingClientRect(),n.element.getBoundingClientRect(),this.corner);this.selectionOverlayOpen=!0,this.selectionOverlayOffset={x:0,y:s.toolbarDy},n.setSelectionOverlayTransform(s.zoomDx,s.zoomDy,!0),this.paintTransform()})}';
replaceOnce('refreshNoteZoomControls(){this.viewportControls?.refresh()}setCorner(e){', 'refreshNoteZoomControls(){this.viewportControls?.refresh()}'+overlayMethods+'setCorner(e){', "overlay methods");

replaceOnce(
  'paintTransform(){let e=this.dodge.x+this.dragOffset.x,t=this.dodge.y+this.dragOffset.y,n=this.drag?.moved===!0?" scale(1.04)":"",',
  'paintTransform(){let e=this.dodge.x+this.dragOffset.x+this.selectionOverlayOffset.x,t=this.dodge.y+this.dragOffset.y+this.selectionOverlayOffset.y,n=this.drag?.moved===!0?" scale(1.04)":"",',
  "toolbar transform",
);

replaceOnce(
  'this.dodge={x:0,y:0},this.paintTransform();return}let t=this.el.classList.contains("is-collapsed")?this.pill:this.el,n=nv({corner:this.corner,strip:t.getBoundingClientRect(),actions:e.getBoundingClientRect(),pane:this.pane.getBoundingClientRect(),gap:8});this.dodge={x:Math.round(n.x),y:Math.round(n.y)},this.paintTransform()}paintTransform(){',
  'this.dodge={x:0,y:0},this.paintTransform(),this.scheduleSelectionOverlayLayout();return}let t=this.el.classList.contains("is-collapsed")?this.pill:this.el,n=nv({corner:this.corner,strip:t.getBoundingClientRect(),actions:e.getBoundingClientRect(),pane:this.pane.getBoundingClientRect(),gap:8});this.dodge={x:Math.round(n.x),y:Math.round(n.y)},this.paintTransform(),this.scheduleSelectionOverlayLayout()}paintTransform(){',
  "header relayout",
);

const required = [
  "layoutHandwritingOverlayStack",
  "setSelectionOverlayTransform",
  "selectionOverlayOpen",
  "scheduleSelectionOverlayLayout",
  "setSelectionOverlayTransform",
];
for (const marker of required) {
  if (!main.includes(marker)) throw new Error(`Missing final overlay marker: ${marker}`);
}
new vm.Script(main);

if (!checkOnly) {
  fs.writeFileSync(path, main);
  console.log("Updated main.js with adaptive selection overlay layout");
}
