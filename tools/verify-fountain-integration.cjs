const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const source = fs.readFileSync("tools/fountain-ink-source.js", "utf8").trim();
const activeSource = fs.readFileSync("tools/active-svg-source.js", "utf8").trim();
const main = fs.readFileSync("main.js", "utf8");

if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error(`invalid manifest version: ${manifest.version}`);
if (!main.includes("/* BEGIN HANDWRITING FOUNTAIN INK */") || !main.includes("/* END HANDWRITING FOUNTAIN INK */")) {
  throw new Error("fountain source markers are missing");
}
if (!main.includes(source)) throw new Error("main.js does not contain the current fountain source");
if (!main.includes('const VERSION_V2 = "fountain-v2"')) throw new Error("main.js does not contain fountain-v2");
if (!main.includes('j.inkStyle=this.settings.fountainProfile==="v1"?"fountain-v1":"fountain-v2"')) {
  throw new Error("fountain profile setting is not mapped to the runtime style");
}
if (!main.includes('this.activeStyle.inkStyle=HandwritingFountainInk.isFountain(j)&&s==="pen"&&t.pointerType==="pen"?j.inkStyle:void 0')) {
  throw new Error("primary pen path does not select the configured fountain profile");
}
if (!main.includes('this.strokeStyle.inkStyle=u==="pen"&&!this.mouseStroke&&HandwritingFountainInk.isFountain(j)?j.inkStyle:void 0')) {
  throw new Error("PDF pen path does not select the configured fountain profile");
}
if (!main.includes("/* BEGIN HANDWRITING ACTIVE SVG */") || !main.includes("/* END HANDWRITING ACTIVE SVG */")) {
  throw new Error("active SVG source markers are missing");
}
if (!main.includes(activeSource)) throw new Error("main.js does not contain the current active SVG source");

for (const fragment of [
  "if(HandwritingFountainInk.isFountain(t))return HandwritingFountainInk.drawCanvas",
  "if(HandwritingFountainInk.isFountain(i))return HandwritingFountainInk.path",
  "if(HandwritingFountainInk.isFountain(i))return HandwritingFountainInk.pdfGeometry",
  "fountainState=HandwritingFountainInk.isFountain",
  "HandwritingFountainInk.append(this.fountainState,n)",
  "pathFromRibbon",
  "fountainState;fountainLastPoint;beginStroke",
  "o=this.fountainLastPoint,a=o?[o,...s]:s",
  "this.fountainLastPoint=s[s.length-1]",
  "HandwritingFountainInk.finish(this.fountainState)",
  "pathFromState",
  "getPreviewStroke",
  "getPreviewRevision",
  "!this.activeSvgStroke?.report?.().active&&this.tail.drawHead",
  "!this.activeSvgStroke?.report?.().active&&d&&this.tail.draw",
  "HandwritingFountainInk.isFountain(e)",
  'penStyle:e?.penStyle==="classic"?"classic":"fountain"',
]) {
  if (!main.includes(fragment)) throw new Error(`bundle integration is missing: ${fragment}`);
}

for (const fragment of [
  "activeSvgStroke",
  "startActiveSvgStroke",
  "scheduleActiveSvgStroke",
  "clearActiveSvgStroke",
  "HandwritingActiveSvgStroke.create",
  "this.scheduleActiveSvgStroke?.()",
  "this.handoffActiveSvgStroke?.(r?.[0])",
  "pathFromStroke:e=>HandwritingFountainInk.path(e,4)",
  "adoptPath:(e,t,n)=>this.committedSvgRenderer?.adoptTransient?.(e,t,n)??!1",
  'this.settledSvgGeometryCache=null,(!this.pinchPreview&&!this.activeSvgStroke?.report?.().active)&&this.exitSettledSvgPresentation?.("resize")',
  'this.committedBacking=d,this.updateCommittedSvgViewport?.(),this.activeSvgStroke?.report?.().active&&this.updateSettledSvgPresentation?.("active-resize")',
  "wetTileCanvas",
  "this.activeWet===this.wet",
]) {
  if (!main.includes(fragment)) throw new Error(`active SVG integration is missing: ${fragment}`);
}

if (!main.includes("HandwritingFountainInk.createState(t,4)")) {
  throw new Error("live fountain geometry does not use the settled render scale");
}

for (const method of [
  "canUseActiveSvgStroke(){",
  "startActiveSvgStroke(){",
  "scheduleActiveSvgStroke(){",
  "clearActiveSvgStroke(){",
]) {
  const count = main.split(method).length - 1;
  if (count !== 1) throw new Error(`active SVG method was duplicated: ${method} (${count})`);
}

console.log("PASS: fountain bundle, live renderer, exports, and setting integration");
