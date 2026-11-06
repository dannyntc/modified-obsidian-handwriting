const fs = require("node:fs");

const main = fs.readFileSync("main.js", "utf8");
const checks = [
  ["pinch ownership state", main.includes("pinchSession=!1")],
  ["pinch ownership begins with two contacts", main.includes("this.pinchSession=!0,this.pinchLive&&")],
  ["pointer release checks pinch ownership", main.includes("let s=this.touchPos.has(e.pointerId)&&this.pinchSession")],
  ["remaining pinch finger movement is consumed", main.includes("if(this.pinchSession&&this.touchPos.has(e.pointerId))")],
  ["pinch release is prevented", main.includes("(s||o||a||n)&&")],
  ["native end clears pinch ownership", main.includes("this.pinchSession=!1,this.pinchStartSpread=0")],
  ["owned pinch native events are consumed", main.includes("if(pinchOwned||this.pinchSession){d.preventDefault(),d.stopPropagation();return}")],
];

const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}

console.log(`PASS: ${checks.length} handwriting pinch ownership invariants`);
