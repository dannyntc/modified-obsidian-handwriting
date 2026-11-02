#!/usr/bin/env node
const fs = require("fs");

const main = fs.readFileSync("main.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

const requiredMain = [
  "layoutHandwritingOverlayStack",
  "positionSelectionOverlay",
  "setSelectionOverlayTransform",
  "selectionOverlayOpen",
  "scheduleSelectionOverlayLayout",
  "selectionOverlayRoot",
  "restoreSelectionOverlayPop",
  "setSelectionOverlayTransform",
];
for (const marker of requiredMain) {
  if (!main.includes(marker)) throw new Error(`Missing layout marker: ${marker}`);
}

const requiredCss = [
  ".handwriting-selection-overlay-root",
  ".handwriting-selection-overlay-pop",
  "z-index: 40",
  ".handwriting-note-viewport-controls.is-selection-stack",
  "handwriting-selection-action-pop",
  ".handwriting-mobile-tools.handwriting-corner-bottom-right .handwriting-selection-action-pop",
];
for (const marker of requiredCss) {
  if (!css.includes(marker)) throw new Error(`Missing layout CSS marker: ${marker}`);
}

const helperStart = main.indexOf("function layoutHandwritingOverlayStack");
const helperEnd = main.indexOf("\nvar VC=160", helperStart);
const helper = helperStart >= 0 && helperEnd > helperStart
  ? main.slice(helperStart, helperEnd)
  : "";
for (const marker of [
  'corner.startsWith("bottom")',
  "toolbarDy",
  "zoomDx",
  "Math.max",
  "Math.min",
]) {
  if (!helper.includes(marker)) throw new Error(`Missing geometry behavior: ${marker}`);
}

const layout = new Function(`${helper}; return layoutHandwritingOverlayStack;`)();
const pane = { left: 0, top: 0, right: 400, bottom: 800 };
const topToolbar = { left: 300, top: 8, right: 392, bottom: 58, width: 92, height: 50 };
const bottomToolbar = { left: 300, top: 742, right: 392, bottom: 792, width: 92, height: 50 };
const topZoom = { left: 300, top: 60, right: 392, bottom: 94, width: 92, height: 34 };
const bottomZoom = { left: 300, top: 60, right: 392, bottom: 94, width: 92, height: 34 };
const topLayout = layout(pane, topToolbar, topZoom, "top-right");
if (topLayout.toolbarDy <= 0 || topLayout.zoomDy > 0) {
  throw new Error("Top toolbar does not move below the zoom controls");
}
if (topZoom.top + topLayout.zoomDy + topZoom.height > topToolbar.top + topLayout.toolbarDy) {
  throw new Error("Top stack still overlaps");
}
const bottomLayout = layout(pane, bottomToolbar, bottomZoom, "bottom-right");
if (bottomLayout.toolbarDy >= 0 || bottomLayout.zoomDy <= 0) {
  throw new Error("Bottom toolbar does not move above the zoom controls");
}
if (bottomToolbar.bottom + bottomLayout.toolbarDy > bottomZoom.top + bottomLayout.zoomDy) {
  throw new Error("Bottom stack still overlaps");
}

for (const corner of ["top-left", "top-center", "bottom-left", "bottom-center"]) {
  const toolbar = corner.startsWith("bottom") ? bottomToolbar : topToolbar;
  const zoom = corner.startsWith("bottom") ? bottomZoom : topZoom;
  const result = layout(pane, toolbar, zoom, corner);
  if (!Number.isFinite(result.toolbarDy) || !Number.isFinite(result.zoomDx) || !Number.isFinite(result.zoomDy)) {
    throw new Error(`Non-finite stack transform for ${corner}`);
  }
}

const overlayHelperStart = main.indexOf("function positionSelectionOverlay");
const overlayHelperEnd = main.indexOf("\nvar VC=160", overlayHelperStart);
const overlayHelper = overlayHelperStart >= 0 && overlayHelperEnd > overlayHelperStart
  ? main.slice(overlayHelperStart, overlayHelperEnd)
  : "";
const position = new Function(`${overlayHelper}; return positionSelectionOverlay;`)();
const root = { left: 0, top: 0, right: 400, bottom: 800 };
const popSize = { width: 144, height: 100 };
const topPop = position(pane, topToolbar, popSize, root, "top-right");
if (topPop.side !== "below" || topPop.top < topToolbar.bottom) {
  throw new Error("Top Style overlay is not below the toolbar");
}
const bottomPop = position(pane, bottomToolbar, popSize, root, "bottom-right");
if (bottomPop.side !== "above" || bottomPop.top + popSize.height > bottomToolbar.top) {
  throw new Error("Bottom Style overlay is not above the toolbar");
}

if (!(main.includes("selectionOverlayOpen") && main.includes("selectionStyleMode"))) {
  throw new Error("Selection action and Style mode are not both wired to layout");
}
const scheduleStart = main.indexOf("scheduleSelectionOverlayLayout(){");
const scheduleEnd = main.indexOf("setCorner(e){", scheduleStart);
const scheduleSource = scheduleStart >= 0 && scheduleEnd > scheduleStart
  ? main.slice(scheduleStart, scheduleEnd)
  : "";
if (scheduleSource.includes("||!this.viewportControls")) {
  throw new Error("Selection overlay layout is incorrectly gated on zoom controls");
}
if (!scheduleSource.includes("this.positionSelectionOverlay()")) {
  throw new Error("Selection overlay is not positioned after selection opens");
}
if (!/requestAnimationFrame/.test(scheduleSource)) {
  throw new Error("Overlay layout is not deferred until popup geometry exists");
}

console.log("Selection overlay layout verification passed");
