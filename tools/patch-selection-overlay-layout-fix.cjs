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

replaceOnce(
  'positionSelectionOverlay(){let e=this.selectionStyleMode?this.selectionOverlayPop:this.selectionActionOpen?this.selectionActionPop:null;if(!e||!this.selectionOverlayRoot)return;let t=positionSelectionOverlay(this.pane.getBoundingClientRect(),this.el.getBoundingClientRect(),{width:e.offsetWidth,height:e.offsetHeight},this.selectionOverlayRoot.getBoundingClientRect(),this.corner);e.setCssStyles({left:`${t.left}px`,top:`${t.top}px`,right:"auto",bottom:"auto",marginTop:"0px",marginBottom:"0px"}),e.toggleClass("is-overlay-above",t.side==="above"),e.toggleClass("is-overlay-below",t.side==="below")}',
  'positionSelectionOverlay(){let e=this.selectionStyleMode?this.selectionOverlayPop:this.selectionActionOpen?this.selectionActionPop:null;if(!e||!this.selectionOverlayRoot)return;let n=this.el.classList.contains("is-collapsed")?this.pill:this.el,t=positionSelectionOverlay(this.pane.getBoundingClientRect(),n.getBoundingClientRect(),{width:e.offsetWidth,height:e.offsetHeight},this.selectionOverlayRoot.getBoundingClientRect(),this.corner);e.setCssStyles({left:`${t.left}px`,top:`${t.top}px`,right:"auto",bottom:"auto",marginTop:"0px",marginBottom:"0px"}),e.toggleClass("is-overlay-above",t.side==="above"),e.toggleClass("is-overlay-below",t.side==="below")}',
  "visible toolbar rectangle",
);

replaceOnce(
  "this.selectionOverlayFrame!==null||!this.viewportControls)return;",
  "this.selectionOverlayFrame!==null)return;",
  "optional zoom layout guard",
);

replaceOnce(
  "n.setSelectionOverlayTransform(0,0,!1),this.paintTransform();return",
  "n?.setSelectionOverlayTransform(0,0,!1),this.paintTransform();return",
  "optional zoom reset",
);

replaceOnce(
  'let r=this.el.classList.contains("is-collapsed")?this.pill:this.el,s=layoutHandwritingOverlayStack(this.pane.getBoundingClientRect(),r.getBoundingClientRect(),n.element.getBoundingClientRect(),this.corner);this.selectionOverlayOpen=!0,this.selectionOverlayOffset={x:0,y:s.toolbarDy},n.setSelectionOverlayTransform(s.zoomDx,s.zoomDy,!0),this.paintTransform(),this.positionSelectionOverlay()',
  'let r=this.el.classList.contains("is-collapsed")?this.pill:this.el;if(n){let s=layoutHandwritingOverlayStack(this.pane.getBoundingClientRect(),r.getBoundingClientRect(),n.element.getBoundingClientRect(),this.corner);this.selectionOverlayOffset={x:0,y:s.toolbarDy},n.setSelectionOverlayTransform(s.zoomDx,s.zoomDy,!0)}else this.selectionOverlayOffset={x:0,y:0};this.selectionOverlayOpen=!0,this.paintTransform(),this.positionSelectionOverlay()',
  "optional zoom stack",
);

new vm.Script(main);

if (!checkOnly) {
  fs.writeFileSync(path, main);
  console.log("Updated selection overlay layout to work without zoom controls");
}
