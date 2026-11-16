const fs = require("fs");
const vm = require("vm");

const main = fs.readFileSync("main.js", "utf8");

for (const marker of [
  "cornerTransform=null",
  "classifyCornerTransform(e)",
  "beginCornerTransform(e,t)",
  "applyCornerTransformPreview(e)",
  "rotateRecoveredGeometry(e,t,n)",
  "cloneRotateStroke(e,t,n)",
  "commitLiveRotate()",
  "rollbackLiveRotate()",
  "selectionFrame=null",
  "selectionFrameFromBounds(e,t=0)",
  "selectionFrameForOverlay(e)",
  "selectionFrameCorners(e)",
  "selectionFrameBounds(e)",
  "selectionFrameContains(e,t,n=0)",
  'a&&e?.mode==="rotate"&&(this.selectionFrame=a)',
  "s.translate((c.x-e.x)*e.zoom,(c.y-e.y)*e.zoom)",
  "s.rotate(a)",
  'this.dispatchInk({type:"replace",path:s,removed:t,removedAt:r,inserted:n,insertedAt:r})',
  'r==="se"?this.beginCornerTransform(e,a):this.beginResize(e,a,r)',
  "if(this.cornerTransform){this.applyCornerTransformPreview(t);return}",
]) {
  if (!main.includes(marker)) throw new Error(`Missing lasso rotation marker: ${marker}`);
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

const rotateStart = main.indexOf("cloneRotateStroke(e,t,n){");
const rotateEnd = main.indexOf("classifyCornerTransform(e){", rotateStart);
if (rotateStart < 0 || rotateEnd < 0) throw new Error("Could not isolate the rotation stroke helper");
const cloneRotateStroke = new Function("dt", `return function ${main.slice(rotateStart, rotateEnd)}`)(bboxFor);
const original = {
  id: "lasso-rotate-test",
  tool: "highlighter",
  width: 8,
  color: "#ffd60a",
  points: [{ x: 10, y: 0, pressure: 0.4, t: 0 }, { x: 10, y: 4, pressure: 0.8, t: 16 }],
  bbox: { x: 6, y: -4, width: 8, height: 12 },
  recoveredGeometry: {
    version: 1,
    subpaths: [{ kind: "circle", center: { x: 10, y: 0 }, r: 4 }],
    outline: [],
    caps: [{ x: 10, y: 0, r: 4 }],
    centers: [{ x: 10, y: 0 }],
    halfWidths: [4],
    sourcePath: "fixture",
    bbox: { x: 6, y: -4, width: 8, height: 8 },
  },
};
const recovered = (geometry, center, angle) => {
  const rotate = main.slice(
    main.indexOf("rotateRecoveredGeometry(e,t,n){"),
    main.indexOf("cloneRotateStroke(e,t,n){"),
  );
  const rotateRecoveredGeometry = new Function("dt", `return function ${rotate}`)(bboxFor);
  return rotateRecoveredGeometry(geometry, center, angle);
};
const rotated = cloneRotateStroke.call({ rotateRecoveredGeometry: recovered }, original, { x: 0, y: 0 }, Math.PI / 2);
if (Math.abs(rotated.points[0].x) > 1e-6 || Math.abs(rotated.points[0].y - 10) > 1e-6) {
  throw new Error("Rotation did not transform stroke points around the selection centre");
}
if (rotated.width !== original.width || rotated.color !== original.color || rotated.tool !== original.tool) {
  throw new Error("Rotation changed stroke style properties");
}
if (!rotated.recoveredGeometry || Math.abs(rotated.recoveredGeometry.centers[0].x) > 1e-6 || Math.abs(rotated.recoveredGeometry.centers[0].y - 10) > 1e-6) {
  throw new Error("Rotation did not transform recovered SVG geometry");
}
if (Object.values(rotated.bbox).some((value) => !Number.isFinite(value))) {
  throw new Error("Rotated stroke bounds are invalid");
}

const classifyStart = main.indexOf("classifyCornerTransform(e){");
const classifyEnd = main.indexOf("rotateBounds(e){", classifyStart);
const classifySource = main.slice(classifyStart, classifyEnd);
const classifyCornerTransform = new Function(`return function ${classifySource}`)();
const base = { center: { x: 0, y: 0 }, start: { x: 10, y: 10 }, threshold: 0 };
if (classifyCornerTransform({ ...base, point: { x: 20, y: 20 } }) !== "resize") {
  throw new Error("Radial bottom-right movement was not classified as resize");
}
if (classifyCornerTransform({ ...base, point: { x: -10, y: 10 } }) !== "rotate") {
  throw new Error("Tangential bottom-right movement was not classified as rotate");
}

new vm.Script(main, { filename: "main.js" });

const helperStart = main.indexOf("function selectionFrameFromBox");
const helperEnd = main.indexOf("var VC=160", helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error("Could not isolate selection frame helpers");
const frameHelpers = new Function(`${main.slice(helperStart, helperEnd)}; return { selectionFrameFromBox, selectionFrameCorners, selectionFrameBounds, selectionFrameContains };`)();
const frame = frameHelpers.selectionFrameFromBox({ x: 0, y: 0, width: 20, height: 10 }, Math.PI / 2);
if (frame.center.x !== 10 || frame.center.y !== 5 || frame.angle !== Math.PI / 2) {
  throw new Error("Selection frame did not preserve the source box and angle");
}
const corners = frameHelpers.selectionFrameCorners(frame);
if (Math.abs(corners.se.x - 5) > 1e-6 || Math.abs(corners.se.y - 15) > 1e-6) {
  throw new Error("Rotated selection frame corner geometry is incorrect");
}
const frameBounds = frameHelpers.selectionFrameBounds(frame);
if (Math.abs(frameBounds.x - 5) > 1e-6 || Math.abs(frameBounds.y + 5) > 1e-6 || frameBounds.width !== 10 || frameBounds.height !== 20) {
  throw new Error("Rotated selection frame bounds are incorrect");
}
if (!frameHelpers.selectionFrameContains(frame, frame.center) || frameHelpers.selectionFrameContains(frame, { x: 40, y: 40 })) {
  throw new Error("Rotated selection frame hit testing is incorrect");
}

console.log("Lasso rotation verification passed");
