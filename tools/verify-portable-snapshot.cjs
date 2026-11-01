const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("tools/portable-snapshot-source.js", "utf8");
const bundle = fs.readFileSync("main.js", "utf8");

class TFile {
  constructor(path) {
    this.path = path;
    this.extension = "md";
  }
}

const notices = [];
const S = { TFile, Notice: message => notices.push(message) };
const context = {
  S,
  I: { pageIdOf: () => "page-123" },
  EE: () => "<path d=\"M0 0\"/>",
  window: {},
  requestAnimationFrame: callback => callback(),
  btoa: value => Buffer.from(value, "binary").toString("base64"),
  setTimeout,
  clearTimeout,
  console,
};
vm.runInNewContext(`${source}\nthis.PortableSnapshots=HandwritingPortableSnapshots;`, context);

(async()=>{
  const file = new TFile("folder/note.md");
  const makeVault = initialNote => {
    let note = initialNote;
    const folders = new Set();
    const created = new Map();
    return {
      get note() {
        return note;
      },
      created,
      vault: {
        getAbstractFileByPath(path) {
          return folders.has(path) || created.has(path) ? {} : null;
        },
        async createFolder(path) {
          folders.add(path);
        },
        async create(path, content) {
          created.set(path, content);
          return { path };
        },
        async process(target, callback) {
          note = callback(note);
          return target;
        },
      },
    };
  };
  const publish = async (initialNote, generation) => {
    const state = makeVault(initialNote);
    const manager = new context.PortableSnapshots({ vault: state.vault });
    await manager.publish(file, { svg: "<svg/>" }, generation);
    return { manager, state };
  };
  const hasLegacyMarker = note => /<!--\s*handwriting-portable-snapshot:(?:start|end)\s*-->/i.test(note);
  const countManagedBlocks = note => (note.match(/data-handwriting-portable-snapshot="true"/g) || []).length;

  const modern = await publish("# Note\n\nText\n", 4);
  if (hasLegacyMarker(modern.state.note)) throw new Error("new snapshots must not contain visible legacy marker comments");
  if (!modern.state.note.includes('data-handwriting-portable-snapshot="true"')) throw new Error("snapshot data block was not inserted");
  if (!modern.state.note.includes("../Handwriting%20snapshots/page-123/snapshot-4-")) throw new Error("snapshot link is not relative to the note");
  if (modern.state.created.size !== 1) throw new Error("snapshot attachment was not created");

  const legacy = await publish(
    "# Note\n\n<!-- handwriting-portable-snapshot:start -->\n\n<div class=\"handwriting-portable-snapshot\"><img src=\"old.svg\"></div>\n\n<!-- handwriting-portable-snapshot:end -->\n\nAfter\n",
    5,
  );
  if (hasLegacyMarker(legacy.state.note)) throw new Error("spaced legacy markers were not migrated");
  if (countManagedBlocks(legacy.state.note) !== 1) throw new Error("legacy snapshot did not become one managed data block");
  if (!legacy.state.note.includes("../Handwriting%20snapshots/page-123/snapshot-5-")) throw new Error("migrated snapshot link is not current");
  if (!legacy.state.note.includes("# Note")) throw new Error("legacy migration removed note content");
  if (legacy.state.note.indexOf("After") < legacy.state.note.indexOf("data-handwriting-portable-snapshot")) throw new Error("legacy migration moved content after the snapshot");

  const compactLegacy = await publish(
    "# Note\n\n<!--handwriting-portable-snapshot:start-->\n<div class=\"handwriting-portable-snapshot\"><img src=\"old.svg\"></div>\n<!--handwriting-portable-snapshot:end-->\n",
    6,
  );
  if (hasLegacyMarker(compactLegacy.state.note)) throw new Error("compact legacy markers were not migrated");
  if (countManagedBlocks(compactLegacy.state.note) !== 1) throw new Error("compact legacy snapshot did not become one managed data block");
  if (!compactLegacy.state.note.includes("# Note")) throw new Error("compact legacy migration removed note content");

  const duplicateNote = "# Note\n\n<div class=\"handwriting-portable-snapshot\" data-handwriting-portable-snapshot=\"true\"><img src=\"old-1.svg\"></div>\n\nKeep this text\n\n<div class=\"handwriting-portable-snapshot\" data-handwriting-portable-snapshot=\"true\"><img src=\"old-2.svg\"></div>\n\nAfter\n";
  const duplicate = await publish(duplicateNote, 7);
  if (countManagedBlocks(duplicate.state.note) !== 1) throw new Error("duplicate modern snapshots were not consolidated");
  if (!duplicate.state.note.includes("Keep this text") || !duplicate.state.note.includes("After")) throw new Error("duplicate consolidation removed surrounding note text");
  if (!duplicate.state.note.includes("../Handwriting%20snapshots/page-123/snapshot-7-")) throw new Error("consolidated snapshot does not reference the new attachment");

  const mixed = await publish(
    "# Note\n\n<!-- handwriting-portable-snapshot:start -->\n<div class=\"handwriting-portable-snapshot\"><img src=\"legacy.svg\"></div>\n<!-- handwriting-portable-snapshot:end -->\n\nBetween\n\n<div class=\"handwriting-portable-snapshot\" data-handwriting-portable-snapshot=\"true\"><img src=\"modern.svg\"></div>\n",
    8,
  );
  if (hasLegacyMarker(mixed.state.note)) throw new Error("mixed snapshot markers were not removed");
  if (countManagedBlocks(mixed.state.note) !== 1) throw new Error("mixed snapshot blocks were not consolidated");
  if (!mixed.state.note.includes("Between")) throw new Error("mixed consolidation removed intervening note text");

  const unmatched = makeVault("# Note\n\n<!--handwriting-portable-snapshot:end-->\n");
  const unmatchedManager = new context.PortableSnapshots({ vault: unmatched.vault });
  await unmatchedManager.removePublishedBlock(file);
  if (hasLegacyMarker(unmatched.note)) throw new Error("unmatched legacy marker was not removed");

  await modern.manager.removePublishedBlock(file);
  if (modern.state.note.includes("data-handwriting-portable-snapshot=\"true\"")) throw new Error("snapshot data block was not removable");
  if (!modern.state.note.includes("# Note")) throw new Error("snapshot removal removed note content");
  if (modern.state.created.size !== 1) throw new Error("snapshot attachment was deleted during block removal");
  const duplicateRemoval = makeVault(duplicateNote);
  const duplicateRemovalManager = new context.PortableSnapshots({ vault: duplicateRemoval.vault });
  await duplicateRemovalManager.removePublishedBlock(file);
  if (countManagedBlocks(duplicateRemoval.note) !== 0 || !duplicateRemoval.note.includes("Keep this text")) throw new Error("duplicate snapshot removal damaged note content");
  if (!bundle.includes("HandwritingPortableSnapshots")) throw new Error("manager is missing from main.js");
  if (bundle.includes("/^ {0,3}<img\\b/i")) throw new Error("the bundled Markdown image matcher still triggers the broken-image detector");
  if (bundle.includes("<img${attributes")) throw new Error("the snapshot image serializer still looks like a missing-src template");
  if (notices.length !== 0) throw new Error(`unexpected notices: ${notices.join(", ")}`);

  console.log("PASS: portable snapshot block and attachment lifecycle");
})().catch(error=>{
  console.error(error);
  process.exitCode=1;
});
