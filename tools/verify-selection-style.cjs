const fs = require("fs");
const vm = require("vm");

const main = fs.readFileSync("main.js", "utf8");

for (const marker of [
  'handwriting-selection-action-pop',
  'openSelectionActions(){',
  'openSelectionStyle(){',
  'selectionStyleMode',
  'selectionStyleTabsFor(e)',
  'selectionStyleSizePx(e)',
  'setSelectionStyleWidth(e,t,n=!1)',
  'setSelectionStyleColor(e,t,n=!1)',
  'selectionStyleOriginal',
  'selectionTap',
  'this.mobileTools?.openSelectionActions()',
  'selectionStyleOriginalWidths',
  'selectionStyleWidthClamp(e,t)',
  'this.dispatchInk({type:"replace",path:e,removed:t,removedAt:r,inserted:n,insertedAt:r})',
  'l("Pen size","3","7","1"',
  'String(tr(.25,oe.baseWidth))',
  'String(Math.ceil(tr(1.8,oe.baseWidth)))',
]) {
  if (!main.includes(marker)) throw new Error(`Missing selection-style marker: ${marker}`);
}

for (const forbidden of [
  'handwriting:style-selected-ink',
  'label:"Style selection"',
  'selectionSlider',
  'Selection thickness',
  '"50","200"',
  'this.mobileTools?.openSelectionStyle()',
]) {
  if (main.includes(forbidden)) throw new Error(`Obsolete selection-style marker remains: ${forbidden}`);
}

if (!main.includes('if(!r&&!this.selection.isEmpty)')) {
  throw new Error("Touch taps are still excluded from the selected-ink hit test");
}
if (!main.includes('this.selectionTap&&!this.selectionTap.moved')) {
  throw new Error("Selection taps are not separated from selection moves");
}
if (!main.includes('e===0&&t===0&&n&&a&&this.mobileTools?.openSelectionActions()')) {
  throw new Error("A stationary tap does not open the selection action popover");
}
if (!main.includes('this.selectionStyleMode?this.host.setSelectionStyleWidth')) {
  throw new Error("Pen size changes are not routed to the selected-ink session");
}
if (!main.includes('this.selectionStyleMode?(this.host.setSelectionStyleColor')) {
  throw new Error("Palette changes are not routed to the selected-ink session");
}
if (!main.includes('Math.abs(o.width-t[a].width)>1e-4||o.color!==t[a].color')) {
  throw new Error("Selection style commits do not detect width and color changes");
}

const bboxFor = (points, padding) => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    x: Math.min(...xs) - padding,
    y: Math.min(...ys) - padding,
    width: Math.max(...xs) - Math.min(...xs) + padding * 2,
    height: Math.max(...ys) - Math.min(...ys) + padding * 2,
  };
};

const cloneStart = main.indexOf("cloneSelectionStyleStroke(e,t,n,r){");
const cloneEnd = main.indexOf("selectionStyleMedianWidth", cloneStart);
if (cloneStart < 0 || cloneEnd < 0) throw new Error("Could not isolate the selection style clone helper");
const cloneSource = main.slice(cloneStart, cloneEnd);
const cloneSelectionStyleStroke = new Function("dt", `return function ${cloneSource}`)(bboxFor);
const original = {
  id: "selection-style-test",
  tool: "pen",
  width: 4,
  color: "#2f6de0",
  points: [{ x: 10, y: 20 }, { x: 14, y: 24 }],
  bbox: { x: 7, y: 17, width: 10, height: 10 },
};
const styled = cloneSelectionStyleStroke(
  original,
  { pen: 6, highlighter: 16 },
  { pen: 4, highlighter: 16 },
  { pen: "#cf3040", highlighter: "#ffd60a" },
);
if (styled.width !== 6) throw new Error("Selection style did not preserve proportional width scaling");
if (styled.color !== "#cf3040") throw new Error("Selection style did not apply the selected tool color");
if (styled.points !== original.points) throw new Error("Selection style should preserve stroke geometry");
if (styled.points.some((point, index) => point.x !== original.points[index].x || point.y !== original.points[index].y)) {
  throw new Error("Selection style changed stroke points");
}
if (Object.values(styled.bbox).some((value) => !Number.isFinite(value))) {
  throw new Error("Selection style bounds are invalid");
}

const highlighterOriginal = { ...original, id: "selection-style-highlighter-test", tool: "highlighter", width: 16, color: "#ffd60a" };
const mixedPenOnly = cloneSelectionStyleStroke(
  highlighterOriginal,
  { pen: 7, highlighter: null },
  { pen: 4, highlighter: 16 },
  { pen: "#cf3040", highlighter: "#ffd60a" },
);
if (mixedPenOnly.width !== 16 || mixedPenOnly.color !== "#ffd60a") {
  throw new Error("Mixed selection styling changed the wrong handwriting tool");
}

const clampStart = main.indexOf("selectionStyleWidthClamp(e,t){");
const clampEnd = main.indexOf("beginSelectionStyle()", clampStart);
const clampSource = main.slice(clampStart, clampEnd);
const selectionStyleWidthClamp = new Function("tr", "oe", `return function ${clampSource}`)((value, base) => value * base, { baseWidth: 16 });
if (selectionStyleWidthClamp(1, "pen") !== 3 || selectionStyleWidthClamp(200, "pen") !== 7) {
  throw new Error("Pen selection thickness is not constrained to 3–7 px");
}
if (selectionStyleWidthClamp(1, "highlighter") !== 4 || selectionStyleWidthClamp(200, "highlighter") !== 29) {
  throw new Error("Highlighter selection thickness no longer follows its existing range");
}

new vm.Script(main, { filename: "main.js" });
console.log("Selection style verification passed");
