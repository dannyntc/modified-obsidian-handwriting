const fs = require("fs");
const vm = require("vm");

const main = fs.readFileSync("main.js", "utf8");
if (!main.includes('this.penSlider=l("Pen size","3","7","1"')) throw new Error("Pen slider is not 3px–7px in 1px steps");
if (main.includes('this.penSlider=l("Pen size",String(tr(.3,j.baseWidth))')) throw new Error("Original fractional pen slider is still present");
if (!main.includes('this.hlSlider=l("Highlighter size",String(tr(.25,oe.baseWidth)),String(Math.ceil(tr(1.8,oe.baseWidth))),"1"')) throw new Error("Highlighter slider was changed unexpectedly");
new vm.Script(main, { filename: "main.js" });
console.log("Pen size verification passed");
