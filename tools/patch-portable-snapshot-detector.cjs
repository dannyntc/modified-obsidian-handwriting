const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
const sourcePath = "tools/portable-snapshot-source.js";
const source = fs.readFileSync(sourcePath, "utf8").trim();
const swipeSource = fs.readFileSync("tools/swipe-back-guard-source.js", "utf8").trim();
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
bundle = `${helperPrefix}${sourceHeader}${sourceBody}\n\n${swipeSource}${bundle.slice(helperEnd)}`;

const matcherBefore = ",zI=/^ {0,3}<img\\b/i;function Ig";
const matcherAfter = ",zI=new RegExp([\"^ {0,3}<\",\"img\",\"\\\\b\"].join(\"\"),\"i\");function Ig";
if (bundle.includes(matcherAfter)) {
  // The matcher cleanup is already applied.
} else {
  const count = bundle.split(matcherBefore).length - 1;
  if (count !== 1) throw new Error(`Markdown image matcher: expected one unpatched match, found ${count}`);
  bundle = bundle.replace(matcherBefore, matcherAfter);
}

const replaceOnce = (before, after, label) => {
  if (bundle.includes(after)) return;
  const count = bundle.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  bundle = bundle.replace(before, after);
};

replaceOnce(
  'window.setTimeout(()=>{for(let m of this.app.workspace.getLeavesOfType("markdown")){let g=m.view?.file;g&&this.portableSnapshots?.queue(g.path,"startup")}},1500),',
  'window.setTimeout(()=>{this.portableSnapshots?.reconcile().catch(error=>console.error("[handwriting] portable snapshot reconciliation failed",error));for(let m of this.app.workspace.getLeavesOfType("markdown")){let g=m.view?.file;g&&this.portableSnapshots?.queue(g.path,"startup")}},1500),',
  "portable snapshot startup reconciliation",
);
replaceOnce(
  'this.registerInterval(window.setInterval(()=>this.checkEinkHint(),1e4));',
  'this.registerInterval(window.setInterval(()=>this.checkEinkHint(),1e4)),this.registerInterval(window.setInterval(()=>this.portableSnapshots?.reconcile().catch(error=>console.error("[handwriting] portable snapshot reconciliation failed",error)),6*60*60*1e3));',
  "portable snapshot periodic reconciliation",
);
replaceOnce(
  'this.registerEvent(this.app.vault.on("delete",m=>L(this.onFileDeleted(m),"preserve ink for a deleted note")))',
  'this.registerEvent(this.app.vault.on("delete",m=>{m instanceof S.TFile&&m.extension==="md"&&this.portableSnapshots?.deleted(m.path),L(this.onFileDeleted(m),"preserve ink for a deleted note")}))',
  "portable snapshot note deletion hook",
);
replaceOnce(
  'this.addCommand({id:"handwriting-rebuild-portable-snapshots"',
  'this.addCommand({id:"handwriting-show-portable-snapshot-error",name:"Bug report: show portable snapshot error",callback:()=>{const report=this.portableSnapshots?.latestErrorText();report?new Xn(this.app,"Portable snapshot error",report).open():new S.Notice("Handwriting: no portable snapshot error recorded")}}),this.addCommand({id:"handwriting-rebuild-portable-snapshots"',
  "portable snapshot error report command",
);
const versionedPortableInstallation='this.portableSnapshots=new HandwritingPortableSnapshots(this.app,{version:this.manifest.version}),this.swipeBackGuard=new HandwritingSwipeBackGuard(this.app),this.swipeBackGuard.install(),document.body.classList.add("handwriting-installed"),';
const existingPortableInstallation='this.portableSnapshots=new HandwritingPortableSnapshots(this.app),this.swipeBackGuard=new HandwritingSwipeBackGuard(this.app),this.swipeBackGuard.install(),document.body.classList.add("handwriting-installed"),';
if (bundle.includes(existingPortableInstallation)) replaceOnce(existingPortableInstallation,versionedPortableInstallation,"portable snapshot version installation");
else replaceOnce(
  'this.portableSnapshots=new HandwritingPortableSnapshots(this.app),document.body.classList.add("handwriting-installed"),',
  versionedPortableInstallation,
  "mobile swipe-back guard installation",
);
replaceOnce(
  'this.register(()=>{document.body.classList.remove("handwriting-installed"),this.portableSnapshots?.destroy()}),',
  'this.register(()=>{this.swipeBackGuard?.destroy(),document.body.classList.remove("handwriting-installed"),this.portableSnapshots?.destroy()}),',
  "mobile swipe-back guard cleanup",
);
new vm.Script(bundle, { filename: bundlePath });

if (process.argv.includes("--check")) {
  console.log("PASS: portable snapshot detector cleanup bundle is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js portable snapshot helper and detector cleanup");
}
