const fs = require("node:fs");
const vm = require("node:vm");

const fountainSource = fs.readFileSync("tools/fountain-ink-source.js", "utf8");
const source = fs.readFileSync("tools/svg-recovery-source.js", "utf8");
const snapshotSource = fs.readFileSync("tools/portable-snapshot-source.js", "utf8");
const context = { Math, Number, String, Array, Object, JSON, Set, Map };
vm.runInNewContext(`${fountainSource}\n${source}\nthis.SvgRecovery=HandwritingSvgRecovery;`, context, {
  filename: "tools/svg-recovery-source.js",
});

const recovery = context.SvgRecovery;
if (!recovery) throw new Error("SVG recovery helper did not initialize");

const outline = [
  { x: 0, y: -2 },
  { x: 10, y: -3 },
  { x: 20, y: -2 },
  { x: 20, y: 2 },
  { x: 10, y: 3 },
  { x: 0, y: 2 },
];
const recovered = recovery.strokeFromOutline({
  id: "legacy-pen-1",
  tool: "pen",
  color: "#2f6de0",
  path: "M 0 -2 L 10 -3 L 20 -2 L 20 2 L 10 3 L 0 2 Z",
  outline,
  caps: [
    { x: 0, y: 0, r: 2 },
    { x: 20, y: 0, r: 2 },
  ],
});
if (!recovered || recovered.tool !== "pen") throw new Error("outline was not recovered");
if (recovered.points.length < 2) throw new Error("recovered outline has no editable centreline");
if (!recovered.recoveredGeometry || recovered.recoveredGeometry.version !== 1) {
  throw new Error("recovered geometry metadata is missing");
}
if (recovered.recoveredGeometry.outline.length !== outline.length) {
  throw new Error("recovered outline vertices were not retained");
}
if (recovered.bbox.x !== -2 || recovered.bbox.y !== -3 || recovered.bbox.width !== 24 || recovered.bbox.height !== 6) {
  throw new Error(`recovered bounds are wrong: ${JSON.stringify(recovered.bbox)}`);
}

const encoded = recovery.encodeMetadata({
  version: 1,
  pageId: "page-123",
  strokes: [recovered],
});
const decoded = recovery.decodeMetadata(encoded);
if (decoded.pageId !== "page-123" || decoded.strokes.length !== 1) {
  throw new Error("embedded recovery metadata did not round-trip");
}
if (decoded.strokes[0].recoveredGeometry.outline.length !== outline.length) {
  throw new Error("embedded recovered outline did not round-trip");
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg"><metadata>${recovery.metadataElement({
  version: 1,
  pageId: "page-123",
  strokes: [recovered],
})}</metadata></svg>`;
const extracted = recovery.extractMetadata(svg);
if (extracted.pageId !== "page-123" || extracted.strokes.length !== 1) {
  throw new Error("SVG metadata was not extracted");
}

let rejected = false;
try {
  recovery.strokeFromOutline({ id: "bad", tool: "pen", color: "#000", outline: [{ x: Infinity, y: 0 }] });
} catch (error) {
  rejected = /finite|geometry/i.test(String(error));
}
if (!rejected) throw new Error("invalid SVG geometry was not rejected");
if (!recovery.isValidGeometry(recovered.recoveredGeometry)) throw new Error("valid recovered geometry was rejected");
if (recovery.isValidGeometry({ version: 1, subpaths: [], centers: [{ x: 0, y: 0 }], halfWidths: [1] })) {
  throw new Error("empty recovered geometry was accepted");
}

const legacySvg = `<svg><foreignObject></foreignObject><g transform="translate(4 5)"><path fill="#2f6de0" d="M 4 3 L 14 2 L 24 3 L 24 7 L 14 8 L 4 7 Z M 2 5 A 2 2 0 1 0 6 5 A 2 2 0 1 0 2 5 Z M 22 5 A 2 2 0 1 0 26 5 A 2 2 0 1 0 22 5 Z"/></g></svg>`;
const legacyStrokes = recovery.extractSvgStrokes(legacySvg);
if (legacyStrokes.length !== 1) throw new Error(`legacy SVG produced ${legacyStrokes.length} strokes`);
if (Math.abs(legacyStrokes[0].points[0].x - 0) > 1e-6 || Math.abs(legacyStrokes[0].points[0].y) > 1e-6) {
  throw new Error("legacy SVG translation was not removed");
}
if (legacyStrokes[0].recoveredGeometry.subpaths.length !== 3) {
  throw new Error("legacy SVG caps were not retained");
}
const fountainStroke = {
  inkStyle: "fountain-v2",
  width: 2.2,
  pressureSensitivity: "on",
  inkSmoothing: "on",
  points: [
    { x: 0, y: 0, pressure: 0.2, t: 0 },
    { x: 5, y: 1, pressure: 0.5, t: 8 },
    { x: 12, y: 0, pressure: 0.8, t: 16 },
    { x: 20, y: 8, pressure: 0.6, t: 24 },
  ],
};
const fountainSvg = `<svg><path fill="#2f6de0" d="${context.HandwritingFountainInk.path(fountainStroke)}"/></svg>`;
const fountainRecovered = recovery.extractSvgStrokes(fountainSvg);
if (fountainRecovered.length !== 1 || fountainRecovered[0].recoveredGeometry.centers.length < 4) {
  throw new Error("fountain SVG outline was not recovered");
}
const highlighterSvg = `<svg><g opacity="0.35"><path fill="#ffd60a" d="${legacySvg.match(/d="([^"]+)"/)[1]}"/></g></svg>`;
if (recovery.extractSvgStrokes(highlighterSvg)[0].tool !== "highlighter") throw new Error("highlighter group was not identified");
const styled = recovery.scaleGeometryWidths(recovered.recoveredGeometry, 1.5);
if (Math.abs(styled.halfWidths[0] - recovered.recoveredGeometry.halfWidths[0] * 1.5) > 1e-6) {
  throw new Error("recovered width scaling is incorrect");
}
const split = recovery.splitRecoveredStroke(recovered, 10, 0, 0.5, id => `${id}-split`);
if (!Array.isArray(split) || split.length < 2 || split.some(strokePart => !strokePart.recoveredGeometry)) {
  throw new Error("recovered geometry was not split into editable eraser fragments");
}

if (!snapshotSource.includes("HandwritingSvgRecovery")) {
  throw new Error("portable snapshot capture does not load the recovery helper");
}
if (!snapshotSource.includes("metadataElement")) {
  throw new Error("portable snapshot capture does not embed recovery metadata");
}

console.log("PASS: SVG geometry recovery and metadata round-trip");
