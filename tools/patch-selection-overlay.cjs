#!/usr/bin/env node
const fs = require("fs");
const vm = require("vm");

const path = "main.js";
const checkOnly = process.argv.includes("--check");
let main = fs.readFileSync(path, "utf8");

function replaceOnce(needle, replacement, label) {
  const count = main.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  main = main.replace(needle, replacement);
}

if (main.includes("handwriting-selection-overlay-root")) {
  new vm.Script(main);
  console.log(checkOnly ? "" : "Selection overlay root already present");
  process.exit(0);
}

const positionHelper = `function positionSelectionOverlay(paneRect,toolbarRect,popSize,rootRect,corner,gap=4){let e=8,t=corner.startsWith("bottom"),n=paneRect.left+e,r=paneRect.right-e,s=corner.includes("left")?toolbarRect.left:corner.includes("center")?toolbarRect.left+(toolbarRect.width-popSize.width)/2:toolbarRect.right-popSize.width;s=Math.max(n,Math.min(s,r-popSize.width));let o=t?toolbarRect.top-gap-popSize.height:toolbarRect.bottom+gap,a=paneRect.top+e,l=Math.max(a,paneRect.bottom-e-popSize.height);return{left:s-rootRect.left,top:Math.max(a,Math.min(o,l))-rootRect.top,side:t?"above":"below"}}\n`;
replaceOnce("\nvar VC=160,Ba=class", "\n" + positionHelper + "var VC=160,Ba=class", "overlay position helper");

replaceOnce(
  'this.el=e.createDiv({cls:"handwriting-mobile-tools"}),this.el.dataset.ignoreSwipe="true",this.selectionActionPop=this.el.createDiv({cls:"handwriting-selection-action-pop"}),',
  'this.el=e.createDiv({cls:"handwriting-mobile-tools"}),this.el.dataset.ignoreSwipe="true",this.selectionOverlayRoot=e.createDiv({cls:"handwriting-selection-overlay-root"}),this.selectionOverlayRoot.dataset.ignoreSwipe="true",this.selectionActionPop=this.selectionOverlayRoot.createDiv({cls:"handwriting-selection-action-pop handwriting-selection-overlay-pop"}),',
  "overlay root creation",
);

replaceOnce(
  'selectionActionPop;selectionStyleAction;',
  'selectionActionPop;selectionOverlayRoot;selectionOverlayPop=null;selectionOverlayOriginalParent=null;selectionOverlayOriginalNext=null;selectionStyleAction;',
  "overlay state fields",
);

replaceOnce(
  'this.el.contains(t)||this.pill.contains(t)||(this.isPreview||this.setMoreOpen(!1),this.closeInkSliders(!0))',
  'this.el.contains(t)||this.pill.contains(t)||this.selectionOverlayRoot?.contains(t)||(this.isPreview||this.setMoreOpen(!1),this.closeInkSliders(!0))',
  "overlay outside-tap ownership",
);

replaceOnce(
  'o.preventDefault(),this.selectionStyleTool=r,this.openInkSlider=r,this.sliderFromHover=!1,this.refresh()',
  'o.preventDefault(),this.selectionStyleMode&&this.enterSelectionOverlayPop(r==="pen"?this.penSlider.pop:this.hlSlider.pop),this.selectionStyleTool=r,this.openInkSlider=r,this.sliderFromHover=!1,this.refresh()',
  "overlay tool switching",
);

replaceOnce(
  'let h=this.buttons.find(d=>d.spec.commandId===a)?.el;if(h){let d=tv({strip:this.el.getBoundingClientRect(),button:h.getBoundingClientRect(),popWidth:o.pop.offsetWidth,pane:this.pane.getBoundingClientRect()});o.pop.setCssStyles({right:`${d}px`})}',
  'let h=this.buttons.find(d=>d.spec.commandId===a)?.el;if(h){if(this.selectionStyleMode&&o.pop===this.selectionOverlayPop)o.pop.setCssStyles({right:"auto"});else{let d=tv({strip:this.el.getBoundingClientRect(),button:h.getBoundingClientRect(),popWidth:o.pop.offsetWidth,pane:this.pane.getBoundingClientRect()});o.pop.setCssStyles({right:`${d}px`})}}',
  "overlay pop right positioning",
);

const overlayMethods = 'enterSelectionOverlayPop(e){if(!e||!this.selectionOverlayRoot)return;this.selectionOverlayPop===e||(this.restoreSelectionOverlayPop(),this.selectionOverlayPop=e,this.selectionOverlayOriginalParent=e.parentElement,this.selectionOverlayOriginalNext=e.nextSibling,this.selectionOverlayRoot.appendChild(e),e.addClass("handwriting-selection-overlay-pop"))}restoreSelectionOverlayPop(){let e=this.selectionOverlayPop,t=this.selectionOverlayOriginalParent;if(!e){this.selectionOverlayOriginalParent=null,this.selectionOverlayOriginalNext=null;return}t&&e.parentElement!==t&&(this.selectionOverlayOriginalNext&&this.selectionOverlayOriginalNext.parentElement===t?t.insertBefore(e,this.selectionOverlayOriginalNext):t.appendChild(e)),e.removeClass("handwriting-selection-overlay-pop"),e.removeClass("is-overlay-above"),e.removeClass("is-overlay-below"),e.setCssStyles({left:"",top:"",right:"",bottom:"",marginTop:"",marginBottom:""}),this.selectionOverlayPop=null,this.selectionOverlayOriginalParent=null,this.selectionOverlayOriginalNext=null}positionSelectionOverlay(){let e=this.selectionStyleMode?this.selectionOverlayPop:this.selectionActionOpen?this.selectionActionPop:null;if(!e||!this.selectionOverlayRoot)return;let t=positionSelectionOverlay(this.pane.getBoundingClientRect(),this.el.getBoundingClientRect(),{width:e.offsetWidth,height:e.offsetHeight},this.selectionOverlayRoot.getBoundingClientRect(),this.corner);e.setCssStyles({left:`${t.left}px`,top:`${t.top}px`,right:"auto",bottom:"auto",marginTop:"0px",marginBottom:"0px"}),e.toggleClass("is-overlay-above",t.side==="above"),e.toggleClass("is-overlay-below",t.side==="below")}';
replaceOnce('selectionOverlayIsOpen(){', overlayMethods + 'selectionOverlayIsOpen(){', "overlay lifecycle methods");

replaceOnce(
  'this.selectionOverlayOpen=!1,this.selectionOverlayOffset={x:0,y:0},n.setSelectionOverlayTransform(0,0,!1),this.paintTransform();return',
  'this.selectionOverlayOpen=!1,this.selectionOverlayOffset={x:0,y:0},this.restoreSelectionOverlayPop(),n.setSelectionOverlayTransform(0,0,!1),this.paintTransform();return',
  "overlay restore on close",
);

replaceOnce(
  'this.selectionOverlayOpen=!0,this.selectionOverlayOffset={x:0,y:s.toolbarDy},n.setSelectionOverlayTransform(s.zoomDx,s.zoomDy,!0),this.paintTransform()',
  'this.selectionOverlayOpen=!0,this.selectionOverlayOffset={x:0,y:s.toolbarDy},n.setSelectionOverlayTransform(s.zoomDx,s.zoomDy,!0),this.paintTransform(),this.positionSelectionOverlay()',
  "overlay position after stack",
);

replaceOnce(
  'this.selectionActionOpen=!1,this.selectionStyleMode=!0,this.selectionStyleTool=this.host.selectionStyleHasTool?.("pen")?"pen":"highlighter",this.openInkSlider=this.selectionStyleTool,',
  'this.selectionActionOpen=!1,this.selectionStyleMode=!0,this.selectionStyleTool=this.host.selectionStyleHasTool?.("pen")?"pen":"highlighter",this.openInkSlider=this.selectionStyleTool,this.enterSelectionOverlayPop(this.selectionStyleTool==="pen"?this.penSlider.pop:this.hlSlider.pop),',
  "overlay pop on Style open",
);

replaceOnce(
  'this.eraserPopClosed=!0,this.cancelSliderClose(),this.refresh(),!0}',
  'this.eraserPopClosed=!0,this.cancelSliderClose(),this.restoreSelectionOverlayPop(),this.refresh(),!0}',
  "overlay pop on Style close",
);

replaceOnce(
  'this.heldSlider=null,this.el.remove(),this.pill.remove(),this.pillTip.remove(),',
  'this.heldSlider=null,this.restoreSelectionOverlayPop(),this.selectionOverlayRoot?.remove(),this.el.remove(),this.pill.remove(),this.pillTip.remove(),',
  "overlay root cleanup",
);

const required = [
  "handwriting-selection-overlay-root",
  "positionSelectionOverlay",
  "selectionOverlayRoot",
  "restoreSelectionOverlayPop",
  "enterSelectionOverlayPop",
];
for (const marker of required) {
  if (!main.includes(marker)) throw new Error(`Missing final overlay marker: ${marker}`);
}
new vm.Script(main);

if (!checkOnly) {
  fs.writeFileSync(path, main);
  console.log("Updated main.js with dedicated selection overlay root");
}
