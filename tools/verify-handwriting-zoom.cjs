const fs = require("node:fs");

const main = fs.readFileSync("main.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

const checks = [
  ["150% zoom ceiling", /var mn=1\.5/ .test(main)],
  ["no four-button zoom tuple", !main.includes('["Zoom out","\\u2212"')],
  ["readout control class", main.includes("handwriting-note-viewport-controls")],
  ["final pinch commit uses hard cap", !main.includes("e>mn*Ed")],
  ["pinch overshoot source removed", !main.includes("mn*Ed")],
  ["pinch-aware raster scale", main.includes("q=Math.max(s,this.pinchScaleNow),h=W.Platform.isMobileApp?Math.max(q,mn):q") && main.includes("g=Un(u.cssW,u.cssH,q") && main.includes("Math.max(this.cssScale,this.pinchScaleNow)")],
  ["pinch composite disables smoothing", main.includes('a.filter="none",a.imageSmoothingEnabled=!1')],
  ["single reset readout button", (main.match(/createEl\("button",\{text:"100%"/g) || []).length === 1],
  ["pane clipping rule", css.includes(".handwriting-note-viewport-pane")],
  ["readout reset label", main.includes("Reset note zoom to 100%")],
  ["zoom inking state stays visible", main.includes('setInking(e){this.inking=e,this.element.toggleClass("is-inking",e)}')],
  ["zoom inking state is touch-through", /\.handwriting-note-viewport-controls\.is-inking\s*\{[^}]*opacity:\s*1;[^}]*pointer-events:\s*none;/.test(css)],
  ["zoom is not in shared inking fade", !/\.handwriting-mobile-tools\.is-inking,[\s\S]*?\.handwriting-note-viewport-controls\.is-inking\s*\{[^}]*opacity:\s*0;/.test(css)],
  ["zoom is not hidden in typing mode", !css.includes("body.handwriting-mode-typing .handwriting-note-viewport-controls,")],
  ["manual zoom visibility remains supported", main.includes('this.element.toggleClass("is-hidden",!ov(td(),wt(n,sv())))')],
  ["zoom setting describes persistent visibility", main.includes("Stays visible while you write")],
  ["portable snapshot manager", main.includes("HandwritingPortableSnapshots")],
  ["portable snapshot data block", main.includes('data-handwriting-portable-snapshot="true"') && main.includes("managedBlockPattern")],
  ["portable snapshot attachment folder", main.includes("Handwriting snapshots")],
  ["portable snapshot note update", main.includes("vault.process(file")],
  ["portable snapshot refresh command", main.includes("handwriting-refresh-portable-snapshot")],
  ["portable snapshot unload flush", main.includes("portableSnapshots?.flush")],
  ["portable snapshot hidden while plugin runs", main.includes("handwriting-installed") && css.includes(".handwriting-portable-snapshot")],
  ["adaptive raster overscan", main.includes("function handwritingRasterBandOverscan(") && main.includes("rasterScale:this.rasterTargetForBand()")],
  ["raster quality diagnostics", main.includes("raster target / allocated") && main.includes("rasterLimited")],
  ["resize variable is scoped", main.includes("this.rasterLimited=d+1e-6<this.rasterTarget;let p=")],
  ["render quality comparison command", main.includes("compare-inline-rendering") && main.includes("HandwritingRenderDiagnostics.open")],
  ["render quality report geometry", main.includes("effective backing per CSS px") && main.includes("ancestor transforms")],
];

const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`PASS: ${checks.length} handwriting zoom invariants`);
