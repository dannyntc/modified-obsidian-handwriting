const assert = require("node:assert/strict");
const fs = require("node:fs");

const bundle = fs.readFileSync("main.js", "utf8");

assert.match(bundle, /var Ch="show"/);
assert.match(bundle, /function Lh\(i\)\{return"show"\}/);
assert.match(bundle, /penTools:"show",noteZoomControls:"show"/);
assert.match(bundle, /options:\{show:"On"\}/);
assert.match(bundle, /this\.settings\.penTools="show"/);
assert.match(bundle, /case"penTools":r\.penTools="show",_o\("show"\),Ge\(\);break;/);
assert.match(bundle, /Handwriting: toolbar on/);
assert.doesNotMatch(bundle, /desc:"Show or hide the pen toolbar\. Auto shows it on phones and tablets[^\"]*Default auto\./);
assert.doesNotMatch(
  bundle,
  /Toolbar visibility"[^}]*options:\{hide:"Off",show:"On",auto:"Auto"\}/,
);
assert.doesNotMatch(bundle, /this\.settings\.penTools=w/);

console.log("PASS: toolbar visibility is forced on");
