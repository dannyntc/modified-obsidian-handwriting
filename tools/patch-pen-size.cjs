const fs = require("fs");
const vm = require("vm");

const bundlePath = "main.js";
const checkOnly = process.argv.includes("--check");
let bundle = fs.readFileSync(bundlePath, "utf8");

const before = 'this.penSlider=l("Pen size",String(tr(.3,j.baseWidth)),String(tr(3,j.baseWidth)),"0.01",(d,u)=>this.host.setInkSizeMult("pen",Cb(d,j.baseWidth),u),"pen")';
const after = 'this.penSlider=l("Pen size","3","7","1",(d,u)=>this.host.setInkSizeMult("pen",Cb(d,j.baseWidth),u),"pen")';

if (bundle.includes(after)) {
  console.log("Pen size slider already uses 3px–7px whole-pixel steps");
} else {
  if (!bundle.includes(before)) throw new Error("Could not find the original pen size slider");
  if (checkOnly) throw new Error("Pen size slider patch is missing");
  bundle = bundle.replace(before, after);
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with a 3px–7px whole-pixel pen size slider");
}

new vm.Script(bundle, { filename: bundlePath });
