const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("tools/portable-snapshot-source.js", "utf8");

class TFile {
  constructor(path, content = "", mtime = 0) {
    this.path = path;
    this.extension = path.split(".").pop();
    this.stat = { mtime };
    this.content = content;
  }
}

const notices = [];
const context = {
  S: { TFile, Notice: message => notices.push(message) },
  I: {
    pageIdOf: path => path === "folder/note.md" ? "page-123" : null,
    inkPresence: () => "ink",
    ensureLoaded: async () => {},
    generation: () => 1,
    strokes: () => [],
  },
  EE: () => "<path d=\"M0 0\"/>",
  window: {},
  requestAnimationFrame: callback => callback(),
  btoa: value => Buffer.from(value, "binary").toString("base64"),
  setTimeout,
  clearTimeout,
  console,
};
vm.runInNewContext(`${source}\nthis.PortableSnapshots=HandwritingPortableSnapshots;`, context);

const DAY = 24 * 60 * 60 * 1000;
const MONTH = 30 * DAY;

const makeVault = ({ now = 0, notes = [], assets = [] } = {}) => {
  const files = new Map();
  const folders = new Set();
  for (const note of notes) files.set(note.path, new TFile(note.path, note.content, note.mtime ?? now));
  for (const asset of assets) files.set(asset.path, new TFile(asset.path, asset.content ?? "<svg/>", asset.mtime ?? now));
  const state = { files, folders, trashed: [] };
  const vault = {
    getAbstractFileByPath(path) {
      return files.get(path) ?? (folders.has(path) ? {} : null);
    },
    getFiles() {
      return [...files.values()];
    },
    getMarkdownFiles() {
      return [...files.values()].filter(file => file.extension === "md");
    },
    async createFolder(path) {
      folders.add(path);
    },
    async create(path, content) {
      const file = new TFile(path, content, now);
      files.set(path, file);
      return file;
    },
    async process(file, callback) {
      file.content = callback(file.content);
      return file;
    },
    async cachedRead(file) {
      return file.content;
    },
    async trash(file) {
      state.trashed.push(file.path);
      files.delete(file.path);
    },
    async delete(file) {
      state.trashed.push(file.path);
      files.delete(file.path);
    },
  };
  return { state, vault };
};

const managerFor = ({ now = 0, notes = [], assets = [] } = {}) => {
  const holder = makeVault({ now, notes, assets });
  const manager = new context.PortableSnapshots({ vault: holder.vault }, { now: () => now });
  return { ...holder, manager };
};

(async () => {
  const current = "Handwriting snapshots/page-123/snapshot-1-1000-1.svg";
  const old = "Handwriting snapshots/page-123/snapshot-1-1000-2.svg";
  const note = "folder/note.md";
  const linked = "<div data-handwriting-portable-snapshot=\"true\"><img src=\"../Handwriting%20snapshots/page-123/snapshot-1-1000-1.svg\"></div>\n";

  const retained = managerFor({
    now: 1000 + MONTH - 1,
    notes: [{ path: note, content: linked }],
    assets: [{ path: current, mtime: 1000 }, { path: old, mtime: 1000 }],
  });
  await retained.manager.reconcile();
  if (retained.state.trashed.length !== 0) throw new Error(`snapshot cleanup ran before the 30-day retention period: ${retained.state.trashed.join(", ")}`);

  const expired = managerFor({
    now: 1000 + MONTH,
    notes: [{ path: note, content: linked }],
    assets: [{ path: current, mtime: 1000 }, { path: old, mtime: 1000 }],
  });
  await expired.manager.reconcile();
  if (!expired.state.trashed.includes(old)) throw new Error("superseded snapshot was not removed after 30 days");
  if (expired.state.trashed.includes(current)) throw new Error("current linked snapshot was removed");

  const deletedMarker = "Handwriting snapshots/page-123/.handwriting-snapshot-deleted.json";
  const erased = managerFor({
    now: 5000,
    notes: [{ path: note, content: "# Note\n" }],
    assets: [{ path: current, mtime: 1 }],
  });
  erased.manager.pageHasInk = () => false;
  await erased.manager.reconcile();
  if (!erased.state.files.has(deletedMarker)) throw new Error("handwriting deletion did not create a retention marker");
  if (erased.state.trashed.includes(current)) throw new Error("snapshot was removed before one month elapsed after handwriting deletion");

  const erasedExpired = managerFor({
    now: 5000 + MONTH,
    notes: [{ path: note, content: "# Note\n" }],
    assets: [
      { path: current, mtime: 1 },
      { path: deletedMarker, content: JSON.stringify({ version: 1, pageId: "page-123", deletedAt: 5000 }), mtime: 5000 },
    ],
  });
  erasedExpired.manager.pageHasInk = () => false;
  await erasedExpired.manager.reconcile();
  if (!erasedExpired.state.trashed.includes(current)) throw new Error("snapshot was not removed after one month of deleted handwriting");
  if (!erasedExpired.state.trashed.includes(deletedMarker)) throw new Error("expired handwriting deletion marker was not removed");

  const restored = managerFor({
    now: 6000,
    notes: [{ path: note, content: linked }],
    assets: [
      { path: current, mtime: 1 },
      { path: deletedMarker, content: JSON.stringify({ version: 1, pageId: "page-123", deletedAt: 5000 }), mtime: 5000 },
    ],
  });
  await restored.manager.reconcile();
  if (restored.state.trashed.includes(current)) throw new Error("restoring handwriting removed the current snapshot");
  if (!restored.state.trashed.includes(deletedMarker)) throw new Error("restoring handwriting did not cancel the deletion marker");

  const eventDeleted = managerFor({
    now: 7000,
    notes: [],
    assets: [{ path: current, mtime: 1 }],
  });
  await eventDeleted.manager.deleted(note);
  if (!eventDeleted.state.trashed.includes(current)) throw new Error("note deletion event did not remove its confirmed orphaned snapshot");

  const orphan = managerFor({
    now: 9000,
    notes: [],
    assets: [{ path: current, mtime: 1 }],
  });
  await orphan.manager.reconcile();
  if (!orphan.state.trashed.includes(current)) throw new Error("snapshot for a deleted note was not removed during retrospective reconciliation");

  const concurrent = managerFor({
    now: 10000,
    notes: [{ path: note, content: "# Note\n" }],
    assets: [{ path: current, mtime: 1 }],
  });
  const markerPath = deletedMarker;
  let markerCreateAttempts = 0;
  let releaseMarkerCreate;
  let markerCreateStarted;
  const markerStarted = new Promise(resolve => { markerCreateStarted = resolve; });
  const markerGate = new Promise(resolve => { releaseMarkerCreate = resolve; });
  const originalCreate = concurrent.vault.create;
  concurrent.vault.create = async (path, content) => {
    if (path !== markerPath) return originalCreate(path, content);
    markerCreateAttempts++;
    if (markerCreateAttempts === 1) {
      markerCreateStarted();
      await markerGate;
      return originalCreate(path, content);
    }
    throw new Error("File already exists.");
  };
  const firstMarker = concurrent.manager.markDeleted("page-123");
  await markerCreateStarted;
  const secondMarker = concurrent.manager.markDeleted("page-123");
  releaseMarkerCreate();
  await Promise.all([firstMarker, secondMarker]);
  if (markerCreateAttempts !== 1) throw new Error(`concurrent deletion marker creation ran ${markerCreateAttempts} times`);

  const adapterOnly = managerFor({
    now: 11000,
    notes: [{ path: note, content: "# Note\n" }],
    assets: [{ path: current, mtime: 1 }],
  });
  const adapterMarker = JSON.stringify({ version: 1, pageId: "page-123", safePageId: "page-123", deletedAt: 10000 });
  adapterOnly.vault.adapter = {
    async exists(path) { return path === markerPath; },
    async read(path) { if (path === markerPath) return adapterMarker; throw new Error("missing"); },
  };
  let adapterCreateAttempts = 0;
  const adapterCreate = adapterOnly.vault.create;
  adapterOnly.vault.create = async (path, content) => {
    if (path === markerPath) adapterCreateAttempts++;
    return adapterCreate(path, content);
  };
  await adapterOnly.manager.markDeleted("page-123");
  if (adapterCreateAttempts !== 0) throw new Error("adapter-only deletion marker was recreated");

  const plain = managerFor({
    now: 12000,
    notes: [{ path: note, content: "# Plain note\n" }],
  });
  let plainWrites = 0;
  const plainProcess = plain.vault.process;
  plain.vault.process = async (...args) => { plainWrites++; return plainProcess(...args); };
  plain.manager.pageHasInk = () => false;
  await plain.manager.run(note, "open");
  if (plainWrites !== 0) throw new Error("plain note cleanup performed an unnecessary Markdown write");

  const concurrentDelete = managerFor({
    now: 13000,
    notes: [],
    assets: [
      { path: current, mtime: 1 },
      { path: deletedMarker, content: JSON.stringify({ version: 1, pageId: "page-123", deletedAt: 12000 }), mtime: 12000 },
    ],
  });
  let firstTrashStarted;
  let releaseFirstTrash;
  const firstTrash = new Promise(resolve => { firstTrashStarted = resolve; });
  const trashGate = new Promise(resolve => { releaseFirstTrash = resolve; });
  let trashAttempts = 0;
  const originalTrash = concurrentDelete.vault.trash;
  concurrentDelete.vault.trash = async file => {
    if (file.path === current) {
      trashAttempts++;
      if (trashAttempts === 1) {
        firstTrashStarted();
        await trashGate;
        return originalTrash(file);
      }
      throw new Error("File already exists.");
    }
    return originalTrash(file);
  };
  const firstDelete = concurrentDelete.manager.removeOrphanedPage("page-123");
  await firstTrashStarted;
  const secondDelete = concurrentDelete.manager.removeOrphanedPage("page-123");
  await new Promise(resolve => setTimeout(resolve, 0));
  releaseFirstTrash();
  await Promise.all([firstDelete, secondDelete]);
  if (!concurrentDelete.state.trashed.includes(current) || !concurrentDelete.state.trashed.includes(deletedMarker)) {
    throw new Error("concurrent deleted-note cleanup did not finish idempotently");
  }

  if (notices.length !== 0) throw new Error(`unexpected notices: ${notices.join(", ")}`);
  console.log("PASS: portable snapshot retention and orphan cleanup");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
