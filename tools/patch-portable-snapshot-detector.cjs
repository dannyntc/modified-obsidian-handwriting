const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
const sourcePath = "tools/portable-snapshot-source.js";
const recoverySourcePath = "tools/svg-recovery-source.js";
const managerSourcePath = "tools/svg-recovery-manager-source.js";
const source = fs.readFileSync(sourcePath, "utf8").trim();
const recoverySource = fs.readFileSync(recoverySourcePath, "utf8").trim();
const managerSource = fs.readFileSync(managerSourcePath, "utf8").trim();
const swipeSource = fs.readFileSync("tools/swipe-back-guard-source.js", "utf8").trim();
let bundle = fs.readFileSync(bundlePath, "utf8");

const sourceMarker = "var HandwritingPortableSnapshots=(()=>{";
const recoveryMarker = "var HandwritingSvgRecovery = (() => {";
const managerMarker = "var HandwritingSvgRecoveryManager = (() => {";
const sourceBodyStart = source.indexOf(sourceMarker);
if (sourceBodyStart < 0) throw new Error("portable snapshot source marker not found");
const sourceHeader = source.slice(0, sourceBodyStart);
const sourceBody = source.slice(sourceBodyStart);
const helperStart = bundle.indexOf(sourceMarker);
const helperEnd = helperStart >= 0 ? bundle.indexOf("\n\nvar Ry=", helperStart) : -1;
if (helperStart < 0 || helperEnd < 0) throw new Error("portable snapshot helper boundaries not found");
let helperPrefix = bundle.slice(0, helperStart);
while (helperPrefix.endsWith(sourceHeader)) helperPrefix = helperPrefix.slice(0, -sourceHeader.length);
const previousRecoveryStart = helperPrefix.indexOf(recoveryMarker);
if (previousRecoveryStart >= 0) {
  const previousRecoveryEnd = helperPrefix.indexOf("\n})();", previousRecoveryStart);
  if (previousRecoveryEnd < 0) throw new Error("previous SVG recovery helper boundary not found");
  helperPrefix = helperPrefix.slice(0, previousRecoveryStart) + helperPrefix.slice(previousRecoveryEnd + "\n})();".length);
}
const previousManagerStart = helperPrefix.indexOf(managerMarker);
if (previousManagerStart >= 0) {
  const previousManagerEnd = helperPrefix.indexOf("\n})();", previousManagerStart);
  if (previousManagerEnd < 0) throw new Error("previous SVG recovery manager boundary not found");
  helperPrefix = helperPrefix.slice(0, previousManagerStart) + helperPrefix.slice(previousManagerEnd + "\n})();".length);
}
bundle = `${helperPrefix}${recoverySource}\n\n${managerSource}\n\n${sourceHeader}${sourceBody}\n\n${swipeSource}${bundle.slice(helperEnd)}`;

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
const recoveryCommands = 'this.addCommand({id:"handwriting-restore-svg-backup",name:"Restore handwriting from SVG backup",callback:()=>this.svgRecovery?.restoreActive()}),this.addCommand({id:"handwriting-finish-svg-recovery",name:"Finish handwriting recovery review",callback:()=>this.svgRecovery?.finishReview()}),';
if (!bundle.includes('id:"handwriting-restore-svg-backup"')) {
  replaceOnce(
    'this.addCommand({id:"handwriting-rebuild-portable-snapshots"',
    `${recoveryCommands}this.addCommand({id:"handwriting-rebuild-portable-snapshots"`,
    "SVG recovery commands",
  );
}
const portableErrorCommand = 'this.addCommand({id:"handwriting-show-portable-snapshot-error",name:"Bug report: show portable snapshot error",callback:()=>{const report=this.portableSnapshots?.latestErrorText();report?new Xn(this.app,"Portable snapshot error",report).open():new S.Notice("Handwriting: no portable snapshot error recorded")}}),';
while (bundle.split(portableErrorCommand).length - 1 > 1) bundle = bundle.replace(portableErrorCommand, "");
const versionedPortableInstallation='this.portableSnapshots=new HandwritingPortableSnapshots(this.app,{version:this.manifest.version}),this.svgRecovery=new HandwritingSvgRecoveryManager(this.app,{portableSnapshots:this.portableSnapshots}),this.swipeBackGuard=new HandwritingSwipeBackGuard(this.app),this.swipeBackGuard.install(),document.body.classList.add("handwriting-installed"),';
if(!bundle.includes(versionedPortableInstallation)){
  const existingVersionedInstallation='this.portableSnapshots=new HandwritingPortableSnapshots(this.app,{version:this.manifest.version}),this.swipeBackGuard=new HandwritingSwipeBackGuard(this.app),this.swipeBackGuard.install(),document.body.classList.add("handwriting-installed"),';
  if(bundle.includes(existingVersionedInstallation)) replaceOnce(existingVersionedInstallation,versionedPortableInstallation,"portable snapshot and SVG recovery installation");
  else replaceOnce(
    'this.portableSnapshots=new HandwritingPortableSnapshots(this.app),document.body.classList.add("handwriting-installed"),',
    'this.portableSnapshots=new HandwritingPortableSnapshots(this.app),this.svgRecovery=new HandwritingSvgRecoveryManager(this.app,{portableSnapshots:this.portableSnapshots}),this.swipeBackGuard=new HandwritingSwipeBackGuard(this.app),this.swipeBackGuard.install(),document.body.classList.add("handwriting-installed"),',
    "mobile swipe-back and SVG recovery installation",
  );
}
const svgRecoveryCleanup='this.register(()=>{this.svgRecovery?.destroy(),this.swipeBackGuard?.destroy(),document.body.classList.remove("handwriting-installed"),this.portableSnapshots?.destroy()}),';
if (!bundle.includes(svgRecoveryCleanup) && bundle.includes('this.register(()=>{this.swipeBackGuard?.destroy(),document.body.classList.remove("handwriting-installed"),this.portableSnapshots?.destroy()}),')) {
  replaceOnce(
    'this.register(()=>{this.swipeBackGuard?.destroy(),document.body.classList.remove("handwriting-installed"),this.portableSnapshots?.destroy()}),',
    svgRecoveryCleanup,
    "SVG recovery and mobile swipe-back cleanup",
  );
} else if (!bundle.includes(svgRecoveryCleanup)) {
  replaceOnce(
    'this.register(()=>{document.body.classList.remove("handwriting-installed"),this.portableSnapshots?.destroy()}),',
    'this.register(()=>{this.svgRecovery?.destroy(),document.body.classList.remove("handwriting-installed"),this.portableSnapshots?.destroy()}),',
    "SVG recovery cleanup",
  );
}
new vm.Script(bundle, { filename: bundlePath });

if (process.argv.includes("--check")) {
  console.log("PASS: portable snapshot detector cleanup bundle is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js portable snapshot helper and detector cleanup");
}
