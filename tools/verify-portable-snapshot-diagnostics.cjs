const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("tools/portable-snapshot-source.js", "utf8");
const bundle = fs.readFileSync("main.js", "utf8");

class TFile {
  constructor(path, content = "") {
    this.path = path;
    this.extension = path.split(".").pop();
    this.content = content;
    this.stat = { mtime: 0 };
  }
}

const notices = [];
const context = {
  S: { TFile, Notice: message => notices.push(message) },
  I: {
    pageIdOf: () => "page-123",
    inkPresence: () => "ink",
    ensureLoaded: async () => {},
    generation: () => 1,
    strokes: () => [],
  },
  EE: () => "",
  window: {},
  requestAnimationFrame: callback => callback(),
  btoa: value => Buffer.from(value, "binary").toString("base64"),
  setTimeout,
  clearTimeout,
  console,
};

vm.runInNewContext(`${source}\nthis.PortableSnapshots=HandwritingPortableSnapshots;`, context);

const file = new TFile("folder/Meeting notes.md", "# Meeting notes\nPrivate note text");
const vault = {
  getAbstractFileByPath: path => path === file.path ? file : null,
  getFiles: () => [file],
  getMarkdownFiles: () => [file],
  cachedRead: async target => target.content,
};

(async () => {
  const manager = new context.PortableSnapshots({ vault }, { now: () => 123456 });
  manager.capture = async () => {
    throw new Error("renderer unavailable on iPad");
  };

  await manager.run(file.path, "open").catch(() => {});

  const report = manager.latestErrorText();
  if (!report) throw new Error("a failed snapshot update did not retain a report");
  if (!report.includes("stage: render")) throw new Error(`report did not identify render stage: ${report}`);
  if (!report.includes("reason: open")) throw new Error(`report did not identify trigger: ${report}`);
  if (!report.includes("renderer unavailable on iPad")) throw new Error(`report omitted the actual error: ${report}`);
  if (!report.includes("Meeting notes.md")) throw new Error(`report omitted the note path: ${report}`);
  if (report.includes("Private note text")) throw new Error("report leaked note contents");
  if (report.length > 7000) throw new Error(`report is not bounded: ${report.length} characters`);
  if (notices.length !== 0) throw new Error(`the low-level run should not display a notice: ${notices.join(", ")}`);

  const originalEnsureLoaded = context.I.ensureLoaded;
  const originalCachedRead = vault.cachedRead;
  const assertStage = async (stage, setup) => {
    context.I.ensureLoaded = async () => {};
    vault.cachedRead = async target => target.content;
    const stagedManager = new context.PortableSnapshots({ vault }, { now: () => 123456 });
    stagedManager.capture = async () => ({ svg: "<svg/>", generation: 1 });
    setup(stagedManager);
    await stagedManager.run(file.path, stage).catch(() => {});
    const stagedReport = stagedManager.latestErrorText();
    if (!stagedReport?.includes(`stage: ${stage}`)) {
      throw new Error(`failure was recorded at the wrong stage (${stage}): ${stagedReport}`);
    }
  };

  try {
    await assertStage("load", () => {
      context.I.ensureLoaded = async () => { throw new Error("sidecar load failed"); };
    });
    await assertStage("read", () => {
      vault.cachedRead = async () => { throw new Error("note read failed"); };
    });
    for (const stage of ["create", "update", "cleanup"]) {
      await assertStage(stage, manager => {
        manager.publish = async (...args) => {
          args[3](stage);
          throw new Error(`${stage} failed`);
        };
      });
    }
  } finally {
    context.I.ensureLoaded = originalEnsureLoaded;
    vault.cachedRead = originalCachedRead;
  }

  const oldSnapshot = new TFile("Handwriting snapshots/page-123/snapshot-1-0-1.svg");
  const cleanupVault = {
    getAbstractFileByPath: path => path === file.path ? file : path === oldSnapshot.path ? oldSnapshot : null,
    getFiles: () => [file, oldSnapshot],
    getMarkdownFiles: () => [file],
    cachedRead: async target => target.content,
    trash: async () => { throw new Error("File already exists."); },
  };
  const cleanupManager = new context.PortableSnapshots({ vault: cleanupVault }, { now: () => 30 * 24 * 60 * 60 * 1000 + 1 });
  cleanupManager.capture = async () => ({ svg: "<svg/>", generation: 1 });
  cleanupManager.publish = async (...args) => {
    args[3]("cleanup");
    await cleanupManager.cleanupPage("page-123", new Set(), true);
  };
  await cleanupManager.run(file.path, "open").catch(() => {});
  const cleanupReport = cleanupManager.latestErrorText();
  if (!cleanupReport?.includes("operation: remove unreferenced snapshot")) {
    throw new Error(`cleanup operation was not reported: ${cleanupReport}`);
  }
  if (!cleanupReport.includes(`file: ${oldSnapshot.path}`)) {
    throw new Error(`cleanup file was not reported: ${cleanupReport}`);
  }
  if (!cleanupReport.includes("File already exists.")) {
    throw new Error(`cleanup exception was not retained: ${cleanupReport}`);
  }

  const deletionMarker = new TFile("Handwriting snapshots/page-123/.handwriting-snapshot-deleted.json");
  const markerVault = {
    getAbstractFileByPath: path => path === deletionMarker.path ? deletionMarker : null,
    getFiles: () => [deletionMarker],
    getMarkdownFiles: () => [],
    cachedRead: async target => target.content,
    trash: async () => { throw new Error("File already exists."); },
  };
  const markerManager = new context.PortableSnapshots({ vault: markerVault }, { now: () => 1 });
  await markerManager.clearDeleted("page-123").catch(error => markerManager.recordError(file.path, error, "cleanup", "open"));
  const markerReport = markerManager.latestErrorText();
  if (!markerReport?.includes("operation: clear deletion marker")) {
    throw new Error(`deletion-marker cleanup was not reported: ${markerReport}`);
  }
  if (!markerReport.includes(`file: ${deletionMarker.path}`)) {
    throw new Error(`deletion-marker path was not reported: ${markerReport}`);
  }

  if (!bundle.includes('id:"handwriting-show-portable-snapshot-error"')) {
    throw new Error("the iPad-accessible portable snapshot error command is missing from the bundle");
  }

  console.log("PASS: portable snapshot failure diagnostics retain bounded stage information");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
