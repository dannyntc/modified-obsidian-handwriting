const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
let bundle = fs.readFileSync(bundlePath, "utf8");

function replaceOnce(before, after, label) {
  if (bundle.includes(after)) return;
  const count = bundle.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected one unpatched match or one patched bundle, found ${count}`);
  }
  bundle = bundle.replace(before, after);
}

replaceOnce(
  'setInking(e){this.inking=e,this.stepAside.set(e&&td()==="auto")}',
  'setInking(e){this.inking=e,this.element.toggleClass("is-inking",e)}',
  "persistent zoom inking state",
);

replaceOnce(
  'desc:"Buttons to zoom the page in and out. Needs Infinite canvas on for the note. Auto moves it aside while you write. Global setting. Default visible."',
  'desc:"Show the floating zoom percentage and reset button. Needs Infinite canvas on for the note. Stays visible while you write. Global setting. Default visible."',
  "persistent zoom setting description",
);

new vm.Script(bundle, { filename: bundlePath });

const expected = [
  'setInking(e){this.inking=e,this.element.toggleClass("is-inking",e)}',
  "Stays visible while you write",
];
const missing = expected.filter((fragment) => !bundle.includes(fragment));
if (missing.length) throw new Error(`zoom persistence patch is incomplete: ${missing.join(", ")}`);

if (process.argv.includes("--check")) {
  console.log("PASS: zoom persistence bundle patch is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with persistent zoom readout behavior");
}
