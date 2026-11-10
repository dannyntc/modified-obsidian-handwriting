const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
let bundle = fs.readFileSync(bundlePath, "utf8");

const methodNeedle = 'settingsFrom(e){return{...e!=null&&typeof e=="object"&&!Array.isArray(e)?e:{},';
const migrationMethod = 'async migrateInfiniteCanvasDefaults(){if(this.settingsReadFailed||this.settings.infiniteCanvasDefaultsMigrated===!0)return;this.settings.extendCanvasWhileScrolling=!0,this.applyRuntimeSettings();try{await this.persistSettings()}catch(e){console.error("[handwriting] infinite canvas default migration could not save settings",e);return}let t=!0;for(let e of this.app.vault.getMarkdownFiles())try{let n=this.canvasOverride?.choice(e.path),r=this.app.metadataCache.getFileCache(e)?.frontmatter,s=Object.prototype.hasOwnProperty.call(r??{},_t);if(n!=="default"||s)await this.canvasOverride.save(e,"default")}catch(n){t=!1,console.error("[handwriting] infinite canvas default migration could not update "+e.path,n)}if(!t)return;this.settings.infiniteCanvasDefaultsMigrated=!0;try{await this.persistSettings()}catch(e){console.error("[handwriting] infinite canvas default migration could not save completion",e);return}this.refreshHeaderActions(),J()}';
const methodPatched = migrationMethod + methodNeedle;
const methodCount = bundle.split(methodNeedle).length - 1;
const methodPatchedCount = bundle.split(methodPatched).length - 1;
if (methodPatchedCount === 0) {
  if (methodCount !== 1) throw new Error(`infinite-canvas migration method: expected one insertion point, found ${methodCount}`);
  bundle = bundle.replace(methodNeedle, methodPatched);
}

const callBefore = 'this.canvasOverride=new la(this.app),this.canvasOverride.start(this),this.registerEditorExtension(vk())';
const callAfter = 'this.canvasOverride=new la(this.app),this.canvasOverride.start(this),L(this.migrateInfiniteCanvasDefaults(),"migrate infinite canvas defaults"),this.registerEditorExtension(vk())';
const callBeforeCount = bundle.split(callBefore).length - 1;
const callAfterCount = bundle.split(callAfter).length - 1;
if (callAfterCount === 0) {
  if (callBeforeCount !== 1) throw new Error(`infinite-canvas migration call: expected one insertion point, found ${callBeforeCount}`);
  bundle = bundle.replace(callBefore, callAfter);
}

new vm.Script(bundle, { filename: bundlePath });

if (process.argv.includes("--check")) {
  if (!bundle.includes(migrationMethod) || !bundle.includes(callAfter)) {
    throw new Error("infinite-canvas migration is missing");
  }
  console.log("PASS: infinite-canvas migration patch is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js to migrate existing infinite-canvas choices once");
}
