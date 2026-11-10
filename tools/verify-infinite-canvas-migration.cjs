const fs = require("node:fs");

const bundle = fs.readFileSync("main.js", "utf8");

const checks = [
  ["migration method exists", /async migrateInfiniteCanvasDefaults\(\)/],
  ["migration is one-time", /infiniteCanvasDefaultsMigrated===!0/],
  ["migration forces the global default on", /this\.settings\.extendCanvasWhileScrolling=!0/],
  ["migration clears note overrides", /this\.canvasOverride\.save\(e,"default"\)/],
  ["migration persists completion", /this\.settings\.infiniteCanvasDefaultsMigrated=!0/],
  ["migration is started after canvas choices are available", /this\.canvasOverride\.start\(this\),L\(this\.migrateInfiniteCanvasDefaults\(\)/],
];

const failures = checks.filter(([, pattern]) => !pattern.test(bundle)).map(([name]) => name);
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}

console.log(`PASS: ${checks.length} infinite-canvas migration invariants`);
