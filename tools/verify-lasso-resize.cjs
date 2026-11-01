const fs = require("fs");
const vm = require("vm");

const main = fs.readFileSync("main.js", "utf8");
for (const marker of [
  "selectionHandleAt(e,t)",
  "beginResize(e,t,n)",
  "applyResizePreview(e)",
  "commitLiveResize()",
  "rollbackLiveResize()",
  'this.dispatchInk({type:"replace",path:e,removed:t,removedAt:r,inserted:n,insertedAt:r})',
  "drawSelectionBox(e,t,n,r=!1)",
]) {
  if (!main.includes(marker)) throw new Error(`Missing lasso resize marker: ${marker}`);
}
if (main.includes("selectionHandleAt(e,t)")) {
  const method = main.slice(main.indexOf("selectionHandleAt(e,t)"), main.indexOf("selectionHandleAt(e,t)") + 500);
  if (!method.includes('nw:{x:t.x,y:t.y}') || !method.includes('se:{x:t.x+t.width,y:t.y+t.height}')) throw new Error("Corner handle hit testing is incomplete");
}
new vm.Script(main, { filename: "main.js" });
console.log("Lasso resize verification passed");
