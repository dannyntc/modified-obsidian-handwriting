const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
const checkOnly = process.argv.includes("--check");
let bundle = fs.readFileSync(bundlePath, "utf8");

const helper = 'var HandwritingDefaultPenSize=(()=>{const pixels=5;return{pixels,reset:(apply,baseWidth)=>{const multiplier=pixels/baseWidth;apply("pen",multiplier);return multiplier}}})();';
const helperMarker = "var HandwritingDefaultPenSize=(()=>{";

if (!bundle.includes(helperMarker)) {
  const insertionPoint = bundle.indexOf("var HandwritingPortableSnapshots");
  if (insertionPoint < 0) throw new Error("Could not find the portable snapshot helper insertion point");
  bundle = `${bundle.slice(0, insertionPoint)}${helper}\n${bundle.slice(insertionPoint)}`;
}

const replaceOnce = (before, after, label) => {
  if (bundle.includes(after)) return;
  const count = bundle.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  bundle = bundle.replace(before, after);
};

replaceOnce(
  'It("pen",this.settings.inkSizes.pen)',
  "HandwritingDefaultPenSize.reset(It,j.baseWidth)",
  "startup pen-size reset",
);
replaceOnce(
  'this.registerEvent(this.app.workspace.on("file-open",m=>{m&&m.extension==="md"&&(HandwritingDefaultPenSize.reset(It,j.baseWidth),this.portableSnapshots?.queue(m.path,"open"))}))',
  'this.registerEvent(this.app.workspace.on("file-open",m=>{m&&m.extension==="md"&&(HandwritingDefaultPenSize.reset(It,j.baseWidth),J(),this.portableSnapshots?.queue(m.path,"open"))}))',
  "note-open pen-size reset",
);

new vm.Script(bundle, { filename: bundlePath });

if (checkOnly) {
  console.log("PASS: default pen size bundle is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with a 5px default pen size on note open");
}
