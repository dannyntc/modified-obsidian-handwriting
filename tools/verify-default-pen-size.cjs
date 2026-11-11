const fs = require("node:fs");
const vm = require("node:vm");

const main = fs.readFileSync("main.js", "utf8");

if (!main.includes('var HandwritingDefaultPenSize=(()=>{')) {
  throw new Error("Default pen-size helper is missing");
}
if (!main.includes('HandwritingDefaultPenSize.reset(It,j.baseWidth)')) {
  throw new Error("Startup pen-size reset is missing");
}
if (!main.includes('m&&m.extension==="md"&&(HandwritingDefaultPenSize.reset(It,j.baseWidth),J(),this.portableSnapshots?.queue(m.path,"open"))')) {
  throw new Error("Note-open pen-size reset is missing");
}
if (!main.includes('It("highlighter",this.settings.inkSizes.highlighter)')) {
  throw new Error("Highlighter initialization was changed unexpectedly");
}

const helperStart = main.indexOf('var HandwritingDefaultPenSize=(()=>{');
const helperEnd = main.indexOf("\n})();", helperStart);
if (helperStart < 0 || helperEnd < 0) throw new Error("Could not isolate the default pen-size helper");
const helperSource = main.slice(helperStart, helperEnd + "\n})();".length);
const context = { HandwritingDefaultPenSize: undefined };
vm.createContext(context);
vm.runInContext(`${helperSource};HandwritingDefaultPenSize`, context);

let applied = null;
const multiplier = context.HandwritingDefaultPenSize.reset((tool, value) => {
  applied = { tool, value };
}, 2.2);
if (applied?.tool !== "pen" || Math.abs(applied.value - 5 / 2.2) > 1e-12) {
  throw new Error("Default pen-size reset does not apply 5 px to the pen");
}
if (Math.abs(multiplier - 5 / 2.2) > 1e-12) {
  throw new Error("Default pen-size reset returned the wrong multiplier");
}

new vm.Script(main, { filename: "main.js" });
console.log("Default pen-size verification passed");
