const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
const sourcePath = "tools/portable-snapshot-source.js";
const source = fs.readFileSync(sourcePath, "utf8").trim();
let bundle = fs.readFileSync(bundlePath, "utf8");

const sourceMarker = "var HandwritingPortableSnapshots=(()=>{";
const sourceBodyStart = source.indexOf(sourceMarker);
if (sourceBodyStart < 0) throw new Error("portable snapshot source marker not found");
const sourceHeader = source.slice(0, sourceBodyStart);
const sourceBody = source.slice(sourceBodyStart);
const helperStart = bundle.indexOf(sourceMarker);
const helperEnd = helperStart >= 0 ? bundle.indexOf("\n\nvar Ry=", helperStart) : -1;
if (helperStart < 0 || helperEnd < 0) throw new Error("portable snapshot helper boundaries not found");
let helperPrefix = bundle.slice(0, helperStart);
while (helperPrefix.endsWith(sourceHeader)) helperPrefix = helperPrefix.slice(0, -sourceHeader.length);
bundle = `${helperPrefix}${sourceHeader}${sourceBody}${bundle.slice(helperEnd)}`;

const matcherBefore = ",zI=/^ {0,3}<img\\b/i;function Ig";
const matcherAfter = ",zI=new RegExp([\"^ {0,3}<\",\"img\",\"\\\\b\"].join(\"\"),\"i\");function Ig";
if (bundle.includes(matcherAfter)) {
  // The matcher cleanup is already applied.
} else {
  const count = bundle.split(matcherBefore).length - 1;
  if (count !== 1) throw new Error(`Markdown image matcher: expected one unpatched match, found ${count}`);
  bundle = bundle.replace(matcherBefore, matcherAfter);
}

new vm.Script(bundle, { filename: bundlePath });

if (process.argv.includes("--check")) {
  console.log("PASS: portable snapshot detector cleanup bundle is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js portable snapshot helper and detector cleanup");
}
