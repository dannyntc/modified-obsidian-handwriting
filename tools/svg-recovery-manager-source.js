/*
 * User-facing SVG recovery workflow. The compiled bundle supplies the
 * Obsidian globals S and I; the pure decoding work remains in
 * svg-recovery-source.js so it can be verified without an Obsidian runtime.
 */
var HandwritingSvgRecoveryManager = (() => {
  const FOLDER = "Handwriting snapshots";
  const RECOVERY_FOLDER = "Handwriting recoveries";
  const managedBlock = /<!--\s*handwriting-portable-snapshot:start\s*-->[\s\S]*?<!--\s*handwriting-portable-snapshot:end\s*-->\s*|<div\b(?=[^>]*\bdata-handwriting-portable-snapshot\s*=\s*["']true["'])[^>]*>[\s\S]*?<\/div>\s*/gi;
  const marker = /<!--\s*handwriting-portable-snapshot:(?:start|end)\s*-->/gi;
  const pageIdLine = /^\s*(?:handwriting-page-id|handwriting-version)\s*:\s*.*(?:\r?\n|$)/gim;

  const clone = value => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const basename = path => String(path || "").split("/").pop()?.replace(/\.md$/i, "") || "Note";
  const folderOf = path => String(path || "").split("/").slice(0, -1).join("/");
  const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const safe = value => String(value || "note").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "note";

  class Manager {
    constructor(app, options = {}) {
      this.app = app;
      this.options = options;
      this.pendingReview = new Map();
      this.stopped = false;
    }

    destroy() {
      this.stopped = true;
      this.pendingReview.clear();
    }

    normaliseStroke(raw, index) {
      if (raw?.recoveredGeometry) {
        const geometry = raw.recoveredGeometry;
        const stroke = HandwritingSvgRecovery.strokeFromOutline({
          id: raw.id || `recovered-${index + 1}`,
          tool: raw.tool,
          color: raw.color,
          width: raw.width,
          outline: geometry.outline,
          caps: geometry.caps,
          subpaths: geometry.subpaths,
          sourcePath: geometry.sourcePath,
        });
        stroke.createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
        return stroke;
      }
      if (!raw || typeof raw !== "object" || !Array.isArray(raw.points) || raw.points.length === 0) {
        throw new Error(`Handwriting recovery stroke ${index + 1} is invalid`);
      }
      const points = raw.points.map(point => ({
        x: Number(point.x), y: Number(point.y), pressure: Number.isFinite(Number(point.pressure)) ? Number(point.pressure) : 0.5,
        t: Number.isFinite(Number(point.t)) ? Number(point.t) : 0,
      }));
      if (points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) throw new Error(`Handwriting recovery stroke ${index + 1} has invalid points`);
      return {
        ...clone(raw),
        id: String(raw.id || `recovered-${index + 1}`),
        points,
        bbox: raw.bbox || HandwritingSvgRecovery.boundsOf(points, Number(raw.width) || 0),
      };
    }

    strokesFromMetadata(payload) {
      if (!Array.isArray(payload?.strokes) || payload.strokes.length === 0) throw new Error("SVG recovery metadata has no strokes");
      return payload.strokes.map((stroke, index) => this.normaliseStroke(stroke, index));
    }

    decodeSource(source) {
      const text = String(source || "");
      try {
        const payload = HandwritingSvgRecovery.extractMetadata(text);
        return { kind: "embedded", payload, strokes: this.strokesFromMetadata(payload) };
      } catch (embeddedError) {
        const strokes = HandwritingSvgRecovery.extractSvgStrokes(text);
        return { kind: "svg", warning: String(embeddedError?.message || embeddedError), strokes };
      }
    }

    recoveryMarkdown(source) {
      let cleaned = String(source || "").replace(managedBlock, "").replace(marker, "");
      const frontmatter = /^(\uFEFF?---\s*\r?\n)([\s\S]*?)(\r?\n---\s*(?:\r?\n|$))/i.exec(cleaned);
      if (frontmatter) {
        const body = frontmatter[2].replace(pageIdLine, "");
        cleaned = `${frontmatter[1]}${body}${frontmatter[3]}${cleaned.slice(frontmatter[0].length)}`;
      } else {
        cleaned = cleaned.replace(pageIdLine, "");
      }
      return cleaned.replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
    }

    async read(file) {
      if (!file) throw new Error("Handwriting recovery source file is missing");
      return this.app.vault.cachedRead ? this.app.vault.cachedRead(file) : this.app.vault.read(file);
    }

    async exists(path) {
      return !!this.app.vault.getAbstractFileByPath?.(path) || !!(await this.app.vault.adapter?.exists?.(path));
    }

    async uniquePath(path) {
      if (!(await this.exists(path))) return path;
      const extension = path.toLowerCase().endsWith(".md") ? ".md" : "";
      const stem = extension ? path.slice(0, -extension.length) : path;
      for (let index = 2; index < 10000; index++) {
        const candidate = `${stem} ${index}${extension}`;
        if (!(await this.exists(candidate))) return candidate;
      }
      throw new Error("Handwriting recovery could not allocate a note path");
    }

    async createRecoveryNote(sourceFile, targetFile = null) {
      if (this.stopped) throw new Error("Handwriting recovery is no longer active");
      const snapshots = this.options.portableSnapshots;
      snapshots?.protectSnapshot?.(sourceFile.path);
      let source;
      try { source = await this.read(sourceFile); }
      finally { snapshots?.releaseSnapshot?.(sourceFile.path); }
      const decoded = this.decodeSource(source);
      let content = "";
      let targetPath = null;
      if (targetFile) {
        content = this.recoveryMarkdown(await this.read(targetFile));
        targetPath = targetFile.path;
      } else {
        content = `# Handwriting recovery\n\nSource: ${sourceFile.path}\n`;
      }
      const folder = targetFile ? folderOf(targetFile.path) : RECOVERY_FOLDER;
      if (folder && !await this.exists(folder)) await this.app.vault.createFolder(folder);
      const path = await this.uniquePath(`${folder ? `${folder}/` : ""}${safe(basename(targetFile?.path || sourceFile.path))} (Handwriting recovery ${timestamp()}).md`);
      const file = await this.app.vault.create(path, content);
      try {
        await I.ensureLoaded(path);
        I.applyAdd(path, decoded.strokes);
        I.save(path);
        await I.settle?.(4000);
        this.pendingReview.set(path, { targetPath, sourcePath: sourceFile.path, sourceKind: decoded.kind });
        await this.app.workspace.openLinkText?.(path, "", true);
      } catch (error) {
        throw new Error(`Handwriting recovery note was created at ${path}, but its ink could not be saved: ${error?.message || error}`);
      }
      return { path, targetPath, sourcePath: sourceFile.path, sourceKind: decoded.kind, count: decoded.strokes.length, file };
    }

    async candidateFiles(activePath = "") {
      const files = (this.app.vault.getFiles?.() || []).filter(file => file.extension?.toLowerCase() === "svg");
      const activePage = activePath ? String(activePath).split("/").pop()?.replace(/\.md$/i, "") : "";
      return files.sort((left, right) => {
        const leftScore = left.path.startsWith(`${FOLDER}/`) ? (activePage && left.path.includes(safe(activePage)) ? 0 : 1) : 2;
        const rightScore = right.path.startsWith(`${FOLDER}/`) ? (activePage && right.path.includes(safe(activePage)) ? 0 : 1) : 2;
        return leftScore - rightScore || left.path.localeCompare(right.path);
      });
    }

    async restoreActive() {
      const target = this.app.workspace.getActiveFile?.();
      const candidates = await this.candidateFiles(target?.path || "");
      if (candidates.length === 0) {
        new S.Notice("Handwriting: no SVG backups were found");
        return null;
      }
      if (candidates.length === 1) {
        return this.createRecoveryNote(candidates[0], target?.extension === "md" ? target : null)
          .catch(error => {
            new S.Notice(`Handwriting: recovery failed (${error?.message || error})`);
            return null;
          });
      }
      if (!S.FuzzySuggestModal) {
        new S.Notice("Handwriting: more than one SVG backup was found, but no backup picker is available");
        return null;
      }
      const manager = this;
      const modal = new S.FuzzySuggestModal(this.app);
      modal.setPlaceholder?.("Choose an SVG handwriting backup");
      modal.getItems = () => candidates;
      modal.getItemText = file => file.path;
      modal.onChooseItem = file => manager.createRecoveryNote(file, target?.extension === "md" ? target : null).catch(error => new S.Notice(`Handwriting: recovery failed (${error.message || error})`));
      modal.open();
      return null;
    }

    async replaceOriginal(reviewPath, targetPath) {
      if (!targetPath || reviewPath === targetPath) throw new Error("Handwriting recovery target is invalid");
      await I.settle?.(4000);
      await I.ensureLoaded(targetPath);
      await I.ensureLoaded(reviewPath);
      const generation = I.generation(targetPath);
      const targetFile = this.app.vault.getAbstractFileByPath(targetPath);
      const targetMarkdown = await this.read(targetFile);
      const targetPageId = I.pageIdOf(targetPath);
      const targetRecord = I.record(targetPath);
      const oldPage = targetPageId ? I.snapshot(targetRecord) : null;
      const incoming = I.strokes(reviewPath).map(clone);
      if (incoming.length === 0) throw new Error("The recovery note contains no handwriting");
      const backupPayload = oldPage || { version: 1, pageId: targetPageId, strokes: I.strokes(targetPath).map(clone) };
      const backupFolder = `${RECOVERY_FOLDER}/original-handwriting-backups`;
      if (!await this.exists(backupFolder)) await this.app.vault.createFolder(backupFolder);
      const backupPath = await this.uniquePath(`${backupFolder}/${safe(basename(targetPath))}-${timestamp()}.json`);
      let backupText = JSON.stringify(backupPayload, null, 2);
      const sidecarPath = targetPageId && I.path?.(targetPageId);
      if (sidecarPath && this.app.vault.adapter?.read) {
        try { backupText = await this.app.vault.adapter.read(sidecarPath); } catch {}
      }
      await this.app.vault.create(backupPath, backupText);
      const currentMarkdown = await this.read(targetFile);
      if (currentMarkdown !== targetMarkdown || I.generation(targetPath) !== generation) throw new Error("The original note changed during recovery review; review the recovery note again");
      if (targetPageId && oldPage) {
        const replacement = { ...oldPage, strokes: incoming, pageId: targetPageId };
        const restored = await I.restoreRevision(targetPageId, replacement);
        if (!restored) throw new Error("The original note's handwriting page could not be restored");
      } else {
        const existingIds = I.recordIds?.(targetPath) || [];
        if (existingIds.length) I.applyRemove(targetPath, existingIds);
        I.applyAdd(targetPath, incoming);
        I.save(targetPath);
      }
      await I.settle?.(4000);
      this.pendingReview.delete(reviewPath);
      this.options.portableSnapshots?.queue(targetPath, "recovery-replace");
      return { targetPath, backupPath, count: incoming.length };
    }

    finishReview() {
      const review = this.app.workspace.getActiveFile?.();
      const pending = review && this.pendingReview.get(review.path);
      if (!review || !pending) {
        new S.Notice("Handwriting: open a recovery note before finishing its review");
        return;
      }
      if (!pending.targetPath) {
        new S.Notice("Handwriting: this recovery note can be kept separately; its original note is unavailable");
        return;
      }
      const items = ["Keep this recovery note", "Replace the original note's handwriting"];
      if (!S.FuzzySuggestModal) return;
      const modal = new S.FuzzySuggestModal(this.app);
      modal.setPlaceholder?.("Choose what to do with the reviewed handwriting");
      modal.getItems = () => items;
      modal.getItemText = item => item;
      modal.onChooseItem = item => {
        if (item === items[1]) this.replaceOriginal(review.path, pending.targetPath)
          .then(result => new S.Notice(`Handwriting: original note updated; backup saved at ${result.backupPath}`))
          .catch(error => new S.Notice(`Handwriting: original note was left unchanged (${error.message || error})`));
        else this.pendingReview.delete(review.path);
      };
      modal.open();
    }
  }

  return Manager;
})();
