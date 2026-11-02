const fs = require("fs");
const vm = require("vm");

const main = fs.readFileSync("main.js", "utf8");
for (const marker of [
  "selectionHandleAt(e,t)",
  "beginResize(e,t,n)",
  "applyResizePreview(e)",
  "commitLiveResize()",
  "rollbackLiveResize()",
  'this.dispatchInk({type:"replace",path:e,removed:t,removedAt:r,inserted:n,insertedAt:r})',
  "drawSelectionBox(e,t,n,r=!1)",
]) {
  if (!main.includes(marker)) throw new Error(`Missing lasso resize marker: ${marker}`);
}
if (main.includes("selectionHandleAt(e,t)")) {
  const method = main.slice(main.indexOf("selectionHandleAt(e,t)"), main.indexOf("selectionHandleAt(e,t)") + 500);
  if (!method.includes('nw:{x:t.x,y:t.y}') || !method.includes('se:{x:t.x+t.width,y:t.y+t.height}')) throw new Error("Corner handle hit testing is incomplete");
}
if (!main.includes("cloneResizeStroke(e,n,r)")) throw new Error("Resize stroke cloning must accept exactly anchor and scale");
if (main.includes("cloneResizeStroke(e,t,n,r)")) throw new Error("Resize stroke cloning still has the invalid four-argument signature");
if (!main.includes("this.cloneResizeStroke(h,a?this.resizeAnchor(n,r):n,o)")) throw new Error("Resize preview is not passing the fixed anchor and scale");

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
const cloneMethodStart = main.indexOf("cloneResizeStroke(e,n,r){");
const cloneMethodEnd = main.indexOf("beginResize(", cloneMethodStart);
const cloneMethodSource = main.slice(cloneMethodStart, cloneMethodEnd);
const cloneResizeStroke = new Function("dt", `return function ${cloneMethodSource}`)(bboxFor);
for (const stroke of [
  { inkStyle: "pen", width: 3 },
  { inkStyle: "highlighter", width: 8 },
]) {
  const original = {
    id: `${stroke.inkStyle}-resize-test`,
    ...stroke,
    points: [{ x: 10, y: 20 }, { x: 14, y: 24 }],
    bbox: { x: 7, y: 17, width: 10, height: 10 },
  };
  for (const [anchor, scale, expectedWidth] of [
    [{ x: 10, y: 20 }, 2, stroke.width * 2],
    [{ x: 14, y: 24 }, 0.5, stroke.width * 0.5],
  ]) {
    const resized = cloneResizeStroke(original, anchor, scale);
    if (!Number.isFinite(resized.width) || resized.width !== expectedWidth) throw new Error(`${stroke.inkStyle} resize width is invalid`);
    if (resized.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error(`${stroke.inkStyle} resize point is invalid`);
    if (resized.points[0].x !== anchor.x + (original.points[0].x - anchor.x) * scale) throw new Error(`${stroke.inkStyle} resize anchor geometry is incorrect`);
    if (Object.values(resized.bbox).some((value) => !Number.isFinite(value))) throw new Error(`${stroke.inkStyle} resize bounds are invalid`);
  }
}
new vm.Script(main, { filename: "main.js" });
console.log("Lasso resize verification passed");
