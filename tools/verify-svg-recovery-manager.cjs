const fs = require("node:fs");
const vm = require("node:vm");

const recoverySource = fs.readFileSync("tools/svg-recovery-source.js", "utf8");
const managerSource = fs.readFileSync("tools/svg-recovery-manager-source.js", "utf8");
const main = fs.readFileSync("main.js", "utf8");
const context = { Math, Number, String, Array, Object, JSON, Set, Map, Date };
vm.runInNewContext(`${recoverySource}\n${managerSource}\nthis.Manager=HandwritingSvgRecoveryManager;`, context, {
  filename: "tools/svg-recovery-manager-source.js",
});

const Manager = context.Manager;
if (!Manager) throw new Error("SVG recovery manager did not initialize");
const manager = new Manager({ vault: {} });

const stroke = context.HandwritingSvgRecovery.strokeFromOutline({
  id: "embedded-1",
  outline: [{ x: 0, y: -1 }, { x: 10, y: -1 }, { x: 10, y: 1 }, { x: 0, y: 1 }],
  caps: [],
});
const embedded = context.HandwritingSvgRecovery.metadataElement({ pageId: "page-a", strokes: [stroke] });
const embeddedResult = manager.decodeSource(`<svg><metadata>${embedded}</metadata></svg>`);
if (embeddedResult.kind !== "embedded" || embeddedResult.strokes.length !== 1) {
  throw new Error("embedded source was not selected");
}

const legacy = `<svg><path fill="#000" d="M 0 -1 L 10 -1 L 10 1 L 0 1 Z"/></svg>`;
const legacyResult = manager.decodeSource(legacy);
if (legacyResult.kind !== "svg" || legacyResult.strokes.length !== 1) {
  throw new Error("legacy source was not decoded");
}

const markdown = manager.recoveryMarkdown(
  "---\nhandwriting-page-id: old-page\nhandwriting-version: 2\ntags:\n  - test\n---\n\n# Note\n\nBody\n\n<div data-handwriting-portable-snapshot=\"true\">old</div>\n",
);
if (/handwriting-page-id|handwriting-version|data-handwriting-portable-snapshot/.test(markdown)) {
  throw new Error("recovery Markdown retained source ownership data");
}
if (!markdown.includes("# Note") || !markdown.includes("Body")) {
  throw new Error("recovery Markdown lost note content");
}
if (!main.includes('l.recoveredGeometry&&typeof l.recoveredGeometry==="object"&&typeof HandwritingSvgRecovery!=="undefined"&&HandwritingSvgRecovery.isValidGeometry(l.recoveredGeometry)?{recoveredGeometry:l.recoveredGeometry}:{}')) {
  throw new Error("sidecar parser does not retain recovered geometry");
}
if (!main.includes('t.recoveredGeometry&&typeof t.recoveredGeometry==="object"?{recoveredGeometry:t.recoveredGeometry}:{}')) {
  throw new Error("sidecar serializer does not retain recovered geometry");
}
for (const required of [
  "HandwritingSvgRecoveryManager",
  "handwriting-restore-svg-backup",
  "handwriting-finish-svg-recovery",
  "this.svgRecovery=new HandwritingSvgRecoveryManager",
]) {
  if (!main.includes(required)) throw new Error(`SVG recovery bundle integration is missing ${required}`);
}

console.log("PASS: SVG recovery source selection and note ownership cleanup");
