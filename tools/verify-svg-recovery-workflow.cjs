const fs = require("node:fs");
const vm = require("node:vm");

const recoverySource = fs.readFileSync("tools/svg-recovery-source.js", "utf8");
const managerSource = fs.readFileSync("tools/svg-recovery-manager-source.js", "utf8");
const context = { Math, Number, String, Array, Object, JSON, Set, Map, Date, structuredClone };
vm.runInNewContext(`${recoverySource}\n${managerSource}`, context, { filename: "tools/svg-recovery-workflow.js" });

const files = new Map();
const folders = new Set(["folder"]);
const target = { path: "folder/note.md", extension: "md" };
const sourceFile = { path: "Handwriting snapshots/page-1/snapshot-1.svg", extension: "svg" };
const targetMarkdown = "---\nhandwriting-page-id: page-target\ntags:\n  - keep\n---\n\n# Note\n\nBody\n";
files.set(target.path, targetMarkdown);
files.set(sourceFile.path, `<svg><metadata>${context.HandwritingSvgRecovery.metadataElement({
  pageId: "page-source",
  strokes: [context.HandwritingSvgRecovery.strokeFromOutline({
    id: "source-stroke",
    color: "#2f6de0",
    outline: [{ x: 0, y: -1 }, { x: 10, y: -1 }, { x: 10, y: 1 }, { x: 0, y: 1 }],
    caps: [],
  })],
})}</metadata></svg>`);

const ink = new Map();
let generation = 2;
const app = {
  vault: {
    getAbstractFileByPath(path) {
      if (folders.has(path)) return { path };
      if (files.has(path)) return { path, extension: path.split(".").pop() };
      return null;
    },
    getFiles() {
      return [...files.keys()].map(path => ({ path, extension: path.split(".").pop() }));
    },
    cachedRead(file) { return Promise.resolve(files.get(file.path)); },
    read(file) { return Promise.resolve(files.get(file.path)); },
    async createFolder(path) { folders.add(path); },
    async create(path, content) { files.set(path, content); return { path, extension: path.split(".").pop() }; },
    adapter: { async exists(path) { return files.has(path) || folders.has(path); } },
  },
  workspace: { async openLinkText(path) { app.opened = path; }, getActiveFile() { return target; } },
};

context.I = {
  async ensureLoaded(path) { if (!ink.has(path)) ink.set(path, []); },
  applyAdd(path, strokes) { ink.set(path, [...(ink.get(path) || []), ...strokes]); },
  applyRemove(path) { ink.set(path, []); },
  recordIds(path) { return (ink.get(path) || []).map(stroke => stroke.id); },
  save() {},
  async settle() { return true; },
  pageIdOf(path) { return path === target.path ? "page-target" : path === "folder/note.md" ? "page-target" : `page-${path}`; },
  generation() { return generation; },
  strokes(path) { return ink.get(path) || []; },
  record(path) { return { pageId: this.pageIdOf(path), strokes: this.strokes(path) }; },
  snapshot(record) { return { schemaVersion: 1, pageId: record.pageId, surface: "inline", strokes: record.strokes }; },
  async restoreRevision(pageId, page) { ink.set(target.path, page.strokes); return target.path; },
};
context.S = { Notice: message => { app.notice = message; } };

(async () => {
  const snapshotGuard = { protected: [], released: [], protectSnapshot(path) { this.protected.push(path); }, releaseSnapshot(path) { this.released.push(path); }, queue() {} };
  const manager = new context.HandwritingSvgRecoveryManager(app, { portableSnapshots: snapshotGuard });
  const created = await manager.createRecoveryNote(sourceFile, target);
  if (!files.has(created.path) || !app.opened) throw new Error("recovery note was not opened");
  if (/handwriting-page-id/.test(files.get(created.path))) throw new Error("recovery note copied page ownership");
  if (files.get(target.path) !== targetMarkdown) throw new Error("recovery note creation changed the original note");
  if ((ink.get(created.path) || []).length !== 1) throw new Error("recovery handwriting was not saved");
  if (snapshotGuard.protected[0] !== sourceFile.path || snapshotGuard.released[0] !== sourceFile.path) {
    throw new Error("source snapshot was not protected during import");
  }

  manager.pendingReview.set(created.path, { targetPath: target.path });
  const before = files.get(target.path);
  const result = await manager.replaceOriginal(created.path, target.path);
  if (files.get(target.path) !== before) throw new Error("replacement changed the original note text");
  if ((ink.get(target.path) || []).length !== 1 || ink.get(target.path)[0].id !== "source-stroke") {
    throw new Error("replacement did not update only the original handwriting");
  }
  if (!files.has(result.backupPath)) throw new Error("replacement backup was not created");

  console.log("PASS: SVG recovery note creation and reviewed replacement");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
