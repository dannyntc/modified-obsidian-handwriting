const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
const sourcePath = "tools/handwriting-mode-source.js";
const source = fs.readFileSync(sourcePath, "utf8").trim();
let bundle = fs.readFileSync(bundlePath, "utf8");

const marker = "/* BEGIN HANDWRITING MODE */";
const endMarker = "/* END HANDWRITING MODE */";
const anchor = "/* END HANDWRITING ERASER TOOL RESTORE */";
const begin = bundle.indexOf(marker);
const end = bundle.indexOf(endMarker);
if ((begin >= 0) !== (end >= 0)) throw new Error("handwriting mode bundle markers are unbalanced");
if (begin >= 0) {
  bundle = `${bundle.slice(0, begin)}${marker}\n${source}\n${endMarker}${bundle.slice(end + endMarker.length)}`;
} else {
  const count = bundle.split(anchor).length - 1;
  if (count !== 1) throw new Error(`expected one mode injection anchor, found ${count}`);
  bundle = bundle.replace(anchor, `${anchor}\n${marker}\n${source}\n${endMarker}`);
}

function replaceOnce(before, after, label) {
  const beforeCount = bundle.split(before).length - 1;
  const afterCount = bundle.split(after).length - 1;
  if (beforeCount === 0 && afterCount === 1) return;
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label}: expected one unpatched or one patched match, found before=${beforeCount}, after=${afterCount}`);
  }
  bundle = bundle.replace(before, after);
}

function replaceEvery(before, after, expected, label) {
  const beforeCount = bundle.split(before).length - 1;
  const afterCount = bundle.split(after).length - 1;
  if (beforeCount === 0 && afterCount === expected) return;
  if (beforeCount !== expected || afterCount !== 0) {
    throw new Error(`${label}: expected ${expected} unpatched or patched matches, found before=${beforeCount}, after=${afterCount}`);
  }
  bundle = bundle.split(before).join(after);
}

function replaceOnceWithEmbeddedAfter(before, after, label) {
  if (bundle.includes(after)) return;
  const beforeCount = bundle.split(before).length - 1;
  if (beforeCount !== 1) {
    throw new Error(`${label}: expected one unpatched match or one patched match, found before=${beforeCount}`);
  }
  bundle = bundle.replace(before, after);
}

function replaceOneOf(befores, after, label) {
  if (bundle.includes(after)) return;
  const matches = befores.filter((before) => bundle.includes(before));
  if (matches.length !== 1) {
    throw new Error(`${label}: expected one supported source match, found ${matches.length}`);
  }
  bundle = bundle.replace(matches[0], after);
}

function moveToolbarConstructorOptions() {
  const anchor = "this.mobileTools=new xt(this.chromeHost(),";
  const start = bundle.indexOf(anchor);
  if (start < 0) throw new Error("toolbar constructor anchor is missing");
  const objectStart = start + anchor.length;
  if (bundle.startsWith("{exec:s=>", objectStart)) return;
  if (bundle[objectStart] !== "{") {
    throw new Error("toolbar constructor options object is missing");
  }

  let depth = 0;
  let quote = null;
  let escaped = false;
  let objectEnd = -1;
  for (let index = objectStart; index < bundle.length; index += 1) {
    const character = bundle[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) {
      objectEnd = index;
      break;
    }
  }
  if (objectEnd < 0) throw new Error("toolbar constructor options object is unbalanced");

  const currentObject = bundle.slice(objectStart, objectEnd + 1);
  const splitAt = currentObject.indexOf(",exec:s=>");
  if (splitAt < 0) {
    throw new Error("toolbar constructor does not contain the expected host callback boundary");
  }
  const modeOptions = `${currentObject.slice(0, splitAt)}}`;
  const hostCallbacks = `{${currentObject.slice(splitAt + 1)}`;
  bundle = `${bundle.slice(0, objectStart)}${hostCallbacks},${modeOptions}${bundle.slice(objectEnd + 1)}`;
}

replaceOnce(
  "function vk(){return[Qe.Prec.highest(at.EditorView.scrollHandler.of(ic)),PM,Hs,Iw()]}",
  "function vk(){return[Qe.Prec.highest(at.EditorView.scrollHandler.of(ic)),PM,Hs,Qe.EditorState.transactionFilter.of(HandwritingMode.filterTransaction),Iw()]}",
  "editor extension mode filter",
);
replaceOnce(
  "PM=Qe.Prec.highest(at.EditorView.domEventHandlers({keydown(i,e){return e.plugin(Hs)?.handleKeyDown(i)??!1},keyup(i,e){return e.plugin(Hs)?.handleKeyUp(i)??!1},paste(i,e){return e.plugin(Hs)?.handlePaste(i)??!1}}))",
  "PM=Qe.Prec.highest(at.EditorView.domEventHandlers({keydown(i,e){return HandwritingMode.isTyping()?!1:e.plugin(Hs)?.handleKeyDown(i)??!1},keyup(i,e){return HandwritingMode.isTyping()?!1:e.plugin(Hs)?.handleKeyUp(i)??!1},paste(i,e){return HandwritingMode.isTyping()?!1:e.plugin(Hs)?.handlePaste(i)??!1}}))",
  "editor event mode gate",
);
replaceOnce(
  "function rP(i){return tR(i)?(dn(!1),i.afterFlip(!1),!1):(dn(!0),i.pickPen(),i.afterFlip(!0),!0)}",
  "function rP(i){if(HandwritingMode.isTyping())return!1;return tR(i)?(dn(!1),i.afterFlip(!1),!1):(dn(!0),i.pickPen(),i.afterFlip(!0),!0)}",
  "pen toggle mode gate",
);
replaceOnce(
  "function Ln(i){i?HandwritingEraserToolRestore.enter(Mn,Y()):HandwritingEraserToolRestore.clear(),_i(\"eraser\",i)}function xr(){return Y()===\"lasso\"}function An(i){_i(\"lasso\",i)}function kr(){return Y()===\"space\"}function Fn(i){_i(\"space\",i)}function vM(){return Oh()}function bM(){Ko()}function Pr(){return Y()===\"pan\"}function Dn(i){_i(\"pan\",i)}",
  "function Ln(i){if(HandwritingMode.isTyping())return;i?HandwritingEraserToolRestore.enter(Mn,Y()):HandwritingEraserToolRestore.clear(),_i(\"eraser\",i)}function xr(){return Y()===\"lasso\"}function An(i){if(HandwritingMode.isTyping())return;_i(\"lasso\",i)}function kr(){return Y()===\"space\"}function Fn(i){if(HandwritingMode.isTyping())return;_i(\"space\",i)}function vM(){return Oh()}function bM(){Ko()}function Pr(){return Y()===\"pan\"}function Dn(i){if(HandwritingMode.isTyping())return;_i(\"pan\",i)}",
  "handwriting tool mode gates",
);
replaceOnce(
  "function Ws(){Bo(),ge(),Ge(),J()}",
  "function Ws(){if(HandwritingMode.isTyping())return;Bo(),ge(),Ge(),J()}",
  "mouse ink mode gate",
);
replaceOnce(
  "function Si(i){let e=Zc(i),t=Nr.get(e)??jc.get(e);return t?(t(),!0):!1}",
  "function Si(i){if(HandwritingMode.isTyping()&&HandwritingMode.isInkCommand(i))return!0;let e=Zc(i),t=Nr.get(e)??jc.get(e);return t?(t(),!0):!1}",
  "command mode gate",
);
replaceOnce(
  "function Bp(i,e){if(e!==void 0)return e&&B.has(e)&&e.showsPath(i)?e.clearAllInk(i):null;for(let t of B){let n=t.clearAllInk(i);if(n!==null)return n}return null}",
  "function Bp(i,e){if(HandwritingMode.isTyping())return null;if(e!==void 0)return e&&B.has(e)&&e.showsPath(i)?e.clearAllInk(i):null;for(let t of B){let n=t.clearAllInk(i);if(n!==null)return n}return null}",
  "clear ink mode gate",
);
replaceOnce(
  "let u=m=>{this.gatedCommandDefs.set(m.id,{...m}),this.settings.colorSizeCommands?this.addCommand(m):m.callback&&Qc(m.id,m.callback)};",
  "let u=m=>{let g={...m,callback:m.callback?()=>{if(HandwritingMode.isTyping()&&HandwritingMode.isInkCommand(m.id))return;m.callback()}:void 0};this.gatedCommandDefs.set(m.id,{...g}),this.settings.colorSizeCommands?this.addCommand(g):g.callback&&Qc(m.id,g.callback)};",
  "registered command mode gate",
);
replaceOnce(
  "penOff:()=>!Pe()||this.scaleGeometryValid===!1",
  "penOff:()=>HandwritingMode.isTyping()||!Pe()||this.scaleGeometryValid===!1",
  "pointer mode gate",
);
replaceOnce(
  "penOff:()=>!Pe(),onStrokeAbandoned",
  "penOff:()=>HandwritingMode.isTyping()||!Pe(),onStrokeAbandoned",
  "presentation pointer mode gate",
);
replaceEvery(
  "penInkEnabled:Pe()",
  "penInkEnabled:!HandwritingMode.isTyping()&&Pe()",
  2,
  "finger ink mode gate",
);
replaceOnce(
  "var UC=ps.filter(i=>i.shownOn!==void 0),Eb=!1,KC=160,xt=class{constructor(e,t,n={}){this.host=t;let r=n.preview===!0;",
  "var UC=ps.filter(i=>i.shownOn!==void 0),Eb=!1,KC=160,xt=class{constructor(e,t,n={}){this.host=t,this.excludedCommands=n.excludedCommands??new Set;let r=n.preview===!0;",
  "toolbar excluded command state",
);
replaceOnce(
  "for(let d of[...ps,...n.additionalButtons??[]]){if(n.supportedCommands&&!n.supportedCommands.has(d.commandId)||!(d.shownOn?.(t)??!0))continue;",
  "for(let d of[...ps,...n.additionalButtons??[]]){if(this.excludedCommands.has(d.commandId)||n.supportedCommands&&!n.supportedCommands.has(d.commandId)||!(d.shownOn?.(t)??!0))continue;",
  "toolbar excluded command filtering",
);
replaceOneOf([
  "for(let E of this.rowOrder)this.buttons.some(A=>A.el===E)||(k+=E.offsetWidth+t);let P=this.buttons.map(({el:E,spec:A})=>({id:A.commandId,width:E.offsetWidth+t}));c=Jg",
  "for(let E of this.rowOrder){let A=this.buttons.find(P=>P.el===E);A?.spec.pinned||(k+=E.offsetWidth+t)}let P=this.buttons.filter(({spec:E})=>!E.pinned).map(({el:E,spec:A})=>({id:A.commandId,width:E.offsetWidth+t}));c=Jg",
],
  "for(let E of this.rowOrder){let A=this.buttons.find(P=>P.el===E);(!A||A.spec.pinned)&&(k+=E.offsetWidth+t)}let P=this.buttons.filter(({spec:E})=>!E.pinned).map(({el:E,spec:A})=>({id:A.commandId,width:E.offsetWidth+t}));c=Jg",
  "mode buttons stay outside overflow folding",
);
replaceOnce(
  "stale(){for(let e of UC)if((e.shownOn?.(this.host)??!0)!==this.built.has(e.commandId))return!0;return!1}",
  "stale(){for(let e of UC){if(this.excludedCommands.has(e.commandId))continue;if((e.shownOn?.(this.host)??!0)!==this.built.has(e.commandId))return!0}return!1}",
  "toolbar excluded command staleness",
);
replaceOnce(
  "startsGroup:!0,isActive:()=>HandwritingMode.isHandwriting()",
  "startsGroup:!0,pinned:!0,isActive:()=>HandwritingMode.isHandwriting()",
  "mode handwriting button pinned",
);
replaceOnce(
  "label:\"Typing mode\",isActive:()=>HandwritingMode.isTyping()",
  "label:\"Typing mode\",pinned:!0,isActive:()=>HandwritingMode.isTyping()",
  "mode typing button pinned",
);
moveToolbarConstructorOptions();
replaceOnce(
  "if(e&&this.mobileTools?.stale()&&(HandwritingMode.attachToolbar(this,null),this.mobileTools.destroy(),this.mobileTools=null),e===(this.mobileTools!==null))return;",
  "if(e&&this.mobileTools?.stale()&&(HandwritingMode.attachToolbar(this,null),this.mobileTools.destroy(),this.mobileTools=null),e&&this.mobileTools&&!HandwritingMode.isNoteToolbarCompatible(this.mobileTools)&&(HandwritingMode.attachToolbar(this,null),this.mobileTools.destroy(),this.mobileTools=null),e===(this.mobileTools!==null))return;",
  "note toolbar compatibility rebuild",
);
replaceOnce(
  "if(!e){this.mobileTools?.destroy(),this.mobileTools=null;return}",
  "if(!e){HandwritingMode.attachToolbar(this,null),this.mobileTools?.destroy(),this.mobileTools=null;return}",
  "mode control fallback when toolbar is disabled",
);
replaceOnceWithEmbeddedAfter(
  "this.applyToolbarCorner()}",
  "HandwritingMode.attachToolbar(this,this.mobileTools),this.applyToolbarCorner()}",
  "mode control toolbar attachment",
);
replaceOnce(
  ",zI=/^ {0,3}<img\\b/i;function Ig",
  ",zI=new RegExp([\"^ {0,3}<\",\"img\",\"\\\\b\"].join(\"\"),\"i\");function Ig",
  "markdown image matcher detector cleanup",
);
replaceOnce(
  "let t=this.view.dom;HandwritingMode.attachEditor(this,t),this.winRef.getComputedStyle(t).position===\"static\"",
  "let t=this.view.dom;this.winRef.getComputedStyle(t).position===\"static\"",
  "move mode control attachment after container creation",
);
replaceOnce(
  "this.container=r,r.setCssStyles({position:\"absolute\"",
  "this.container=r,HandwritingMode.attachEditor(this,t),r.setCssStyles({position:\"absolute\"",
  "mode control mount after container creation",
);
replaceOnce(
  "unmount(){this.clearActiveSvgStroke?.(),",
  "unmount(){HandwritingMode.detachEditor(this),this.clearActiveSvgStroke?.(),",
  "mode control unmount",
);
replaceOnce(
  "document.body.classList.add(\"handwriting-installed\"),this.register(()=>{document.body.classList.remove(\"handwriting-installed\"),this.portableSnapshots?.destroy()})",
  "document.body.classList.add(\"handwriting-installed\"),this.register(()=>{HandwritingMode.reset()}),this.register(()=>{document.body.classList.remove(\"handwriting-installed\"),this.portableSnapshots?.destroy()})",
  "mode reset on unload",
);

new vm.Script(bundle, { filename: bundlePath });

if (process.argv.includes("--check")) {
  for (const text of ["HandwritingMode", "handwriting-mode-typing", "transactionFilter", "removeLegacyKeyboardButton", "isNoteToolbarCompatible", "handwriting:pen-ink-toggle", "pinned:!0"]) {
    if (!bundle.includes(text)) throw new Error(`handwriting mode bundle is missing ${text}`);
  }
  console.log("PASS: handwriting mode bundle patch is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with handwriting and typing modes");
}
