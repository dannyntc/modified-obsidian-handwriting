const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("tools/handwriting-mode-source.js", "utf8");
const context = { console };
vm.runInNewContext(`${source}\nthis.mode = HandwritingMode;`, context, {
  filename: "tools/handwriting-mode-source.js",
});

const mode = context.mode;
assert.equal(mode.get(), "handwriting", "handwriting is the default mode");
assert.equal(mode.isHandwriting(), true);
assert.equal(mode.isTyping(), false);

const changes = [];
const unsubscribe = mode.subscribe((next, previous) => changes.push({ next, previous }));
changes.length = 0;
assert.equal(mode.set("typing"), true);
assert.equal(mode.get(), "typing");
assert.equal(mode.isTyping(), true);
assert.equal(mode.isHandwriting(), false);
assert.deepEqual(changes, [{ next: "typing", previous: "handwriting" }]);

assert.equal(mode.set("typing"), false, "reselecting the active mode is a no-op");
assert.equal(mode.set("invalid"), false, "unknown modes are rejected");
assert.equal(mode.get(), "typing");

unsubscribe();
assert.equal(mode.set("handwriting"), true);
assert.deepEqual(changes, [{ next: "typing", previous: "handwriting" }]);

const bundle = fs.readFileSync("main.js", "utf8");
const styles = fs.readFileSync("styles.css", "utf8");
assert.match(bundle, /HandwritingMode/);
assert.match(bundle, /handwriting-mode-toggle/);
assert.match(bundle, /handwriting-mode-typing/);
assert.match(source, /EditorView\.editable/);
assert.match(source, /new Qe\.Compartment/);
assert.match(source, /focusin/);
assert.match(source, /attachToolbar/);
assert.match(source, /setIcon/);
assert.match(source, /handwriting-mode-option/);
assert.match(source, /isNoteToolbarCompatible/);
assert.doesNotMatch(source, /button\.textContent = text/);
assert.match(bundle, /handwriting:mode-handwriting/);
assert.match(bundle, /handwriting:mode-typing/);
assert.match(bundle, /excludedCommands:new Set\(\[ai\]\)/);
assert.match(bundle, /this\.excludedCommands\.has\(d\.commandId\)/);
assert.match(bundle, /stale\(\)\{for\(let e of UC\)\{if\(this\.excludedCommands\.has\(e\.commandId\)\)/);
assert.match(bundle, /commandId:ai/);
assert.match(bundle, /removeLegacyKeyboardButton/);
assert.match(bundle, /isNoteToolbarCompatible/);
assert.match(bundle, /handwriting:pen-ink-toggle/);
const rejectedTransaction = mode.filterTransaction({ docChanged: true, isUserEvent: (kind) => kind === "input" });
assert.equal(Array.isArray(rejectedTransaction), true);
assert.equal(rejectedTransaction.length, 0);
const pluginTransaction = { docChanged: true, isUserEvent: () => false };
assert.equal(mode.filterTransaction(pluginTransaction), pluginTransaction);
assert.equal(mode.isInkCommand("handwriting:inline-tool-pen"), true);
assert.equal(mode.isInkCommand("editor:undo"), false);
assert.match(styles, /\.handwriting-mode-toggle/);
assert.match(styles, /body\.handwriting-mode-typing \.handwriting-mobile-tools\.handwriting-mode-toolbar\s*\{[^}]*display:\s*flex\s*!important/s);
assert.match(styles, /body\.handwriting-mode-typing \.handwriting-mobile-tools\.handwriting-mode-toolbar > :not\(\.handwriting-mode-option\)/);
assert.match(styles, /\.handwriting-mode-option\s*\{[^}]*width:\s*32px/s);
assert.doesNotMatch(styles, /handwriting-mode-toggle\.handwriting-mode-in-toolbar/);
assert.match(styles, /body\.handwriting-mode-typing \.handwriting-pen-pill/);
assert.match(styles, /body\.handwriting-mode-typing \.handwriting-slider-pop/);
assert.match(styles, /body\.handwriting-mode-typing \.handwriting-strip-tip/);
assert.match(styles, /body\.handwriting-mode-typing \.handwriting-pill-tip/);

class FakeClassList {
  constructor() {
    this.names = new Set();
  }

  toggle(name, force) {
    const next = force === undefined ? !this.names.has(name) : force;
    next ? this.names.add(name) : this.names.delete(name);
    return next;
  }

  add(...names) {
    for (const name of names) this.names.add(name);
  }

  remove(...names) {
    for (const name of names) this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }
}

class FakeElement {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.classList = new FakeClassList();
    this.dataset = {};
    this.listeners = new Map();
    this.queryResults = [];
    this.attributes = new Map();
    this.disabled = false;
  }

  get className() {
    return [...this.classList.names].join(" ");
  }

  set className(value) {
    this.classList.names = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  contains(target) {
    return target === this || this.children.some((child) => child.contains(target));
  }

  closest(selector) {
    for (let element = this; element; element = element.parentElement) {
      const selectors = String(selector).split(",").map((value) => value.trim());
      if (selectors.some((value) => value === ".handwriting-mode-toggle" && element.classList.contains("handwriting-mode-toggle"))) return element;
      if (selectors.some((value) => value === ".handwriting-mode-option" && element.classList.contains("handwriting-mode-option"))) return element;
    }
    return null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener));
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener({ target: this, ...event });
  }

  querySelectorAll() {
    return this.queryResults;
  }
}

class FakeDocument {
  constructor() {
    this.body = new FakeElement(this);
  }

  createElement() {
    return new FakeElement(this);
  }
}

const fakeDocument = new FakeDocument();
const editableValues = [];
const pendingMicrotasks = [];
const editableFacet = {
  of(value) {
    editableValues.push(value);
    return { type: "editable", value };
  },
};
class FakeCompartment {
  of(extension) {
    return { type: "compartment", extension };
  }

  reconfigure(extension) {
    return { type: "reconfigure", extension };
  }
}
const fakeContext = {
  console,
  document: fakeDocument,
  Qe: {
    Compartment: FakeCompartment,
    StateEffect: { appendConfig: { of: (extension) => ({ type: "appendConfig", extension }) } },
  },
  at: { EditorView: { editable: editableFacet } },
  B: new Set(),
  queueMicrotask: (callback) => pendingMicrotasks.push(callback),
};
vm.runInNewContext(`${source}\nthis.mode = HandwritingMode;`, fakeContext, {
  filename: "tools/handwriting-mode-source-runtime-test.js",
});

const runtimeMode = fakeContext.mode;
const runtimeRoot = fakeDocument.createElement();
const contentDOM = fakeDocument.createElement();
let blurCount = 0;
contentDOM.blur = () => blurCount++;
runtimeRoot.appendChild(contentDOM);
const openSlider = fakeDocument.createElement();
openSlider.classList.add("handwriting-slider-pop", "is-showing");
const openTip = fakeDocument.createElement();
openTip.classList.add("handwriting-strip-tip", "is-showing");
runtimeRoot.queryResults = [openSlider, openTip];
const dispatches = [];
const stableChromeHost = fakeDocument.createElement();
const runtimeEditor = {
  view: {
    state: { facet: () => true },
    contentDOM,
    dispatch: (transaction) => dispatches.push(transaction),
  },
  mobileTools: {
    setMoreOpen: () => { runtimeEditor.moreClosed = true; },
    closeInkSliders: () => { runtimeEditor.slidersClosed = true; },
    cancelTipTimer: () => { runtimeEditor.tipClosed = true; },
  },
  chromeHost: () => stableChromeHost,
};
runtimeMode.attachEditor(runtimeEditor, runtimeRoot);
assert.equal(contentDOM.getAttribute("inputmode"), "none", "handwriting mode suppresses the keyboard before focus can occur");
const modeControl = stableChromeHost.children.find((child) => child.classList.contains("handwriting-mode-toggle"));
assert.ok(modeControl, "the standalone icon fallback is created on the stable chrome host");
assert.equal(modeControl.parentElement, stableChromeHost, "the standalone fallback is outside the zoomed editor");
assert.equal(modeControl.children.length, 2, "the fallback contains only pen and keyboard icons");
const toolbarHost = fakeDocument.createElement();
const toolbarMoreRow = fakeDocument.createElement();
const modePenButton = fakeDocument.createElement();
const modeKeyboardButton = fakeDocument.createElement();
const legacyKeyboardButton = fakeDocument.createElement();
const legacyOverflowButton = fakeDocument.createElement();
const deleteSelectionButton = fakeDocument.createElement();
toolbarHost.appendChild(toolbarMoreRow);
toolbarMoreRow.appendChild(legacyOverflowButton);
toolbarHost.appendChild(legacyKeyboardButton);
toolbarHost.appendChild(deleteSelectionButton);
toolbarHost.appendChild(modePenButton);
toolbarHost.appendChild(modeKeyboardButton);
const toolbar = {
  el: toolbarHost,
  moreRow: toolbarMoreRow,
  buttons: [
    { el: legacyKeyboardButton, spec: { commandId: "handwriting:pen-ink-toggle" } },
    { el: legacyOverflowButton, spec: { commandId: "handwriting:pen-ink-toggle" } },
    { el: deleteSelectionButton, spec: { commandId: "handwriting:delete-selected-ink" } },
    { el: modePenButton, spec: { commandId: "handwriting:mode-handwriting" } },
    { el: modeKeyboardButton, spec: { commandId: "handwriting:mode-typing" } },
  ],
  rowOrder: [legacyKeyboardButton, deleteSelectionButton, legacyOverflowButton, modePenButton, modeKeyboardButton],
  built: new Set(["handwriting:pen-ink-toggle", "handwriting:delete-selected-ink"]),
  layoutCalls: 0,
  refreshCalls: 0,
  layoutOverflow() { this.layoutCalls += 1; },
  refresh() { this.refreshCalls += 1; },
};
const incompleteToolbarHost = fakeDocument.createElement();
const incompleteLegacyButton = fakeDocument.createElement();
incompleteToolbarHost.appendChild(incompleteLegacyButton);
const incompleteToolbar = {
  el: incompleteToolbarHost,
  buttons: [{ el: incompleteLegacyButton, spec: { commandId: "handwriting:pen-ink-toggle" } }],
  rowOrder: [incompleteLegacyButton],
  built: new Set(["handwriting:pen-ink-toggle"]),
};
assert.equal(runtimeMode.isNoteToolbarCompatible(incompleteToolbar), false, "a toolbar missing mode controls is incompatible");
assert.equal(incompleteLegacyButton.parentElement, null, "compatibility checking removes a legacy keyboard button");
runtimeMode.attachToolbar(runtimeEditor, toolbar);
assert.equal(toolbarHost.children.includes(legacyKeyboardButton), false, "the legacy keyboard icon beside the bin is removed");
assert.equal(toolbarMoreRow.children.includes(legacyOverflowButton), false, "the legacy keyboard icon is removed from the overflow row");
assert.equal(toolbar.buttons.some(({ spec }) => spec.commandId === "handwriting:pen-ink-toggle"), false, "the legacy command is removed from toolbar measurement");
assert.equal(toolbar.rowOrder.includes(legacyKeyboardButton), false, "the legacy command is removed from toolbar ordering");
assert.equal(toolbar.rowOrder.includes(legacyOverflowButton), false, "the overflow legacy command is removed from toolbar ordering");
assert.equal(toolbar.built.has("handwriting:pen-ink-toggle"), false, "the legacy command is removed from the built set");
assert.equal(toolbarHost.children.includes(deleteSelectionButton), true, "the bin/delete button remains in the toolbar");
assert.equal(toolbarHost.children.includes(modeControl), false, "the text mode control is not copied into the toolbar");
assert.equal(modePenButton.classList.contains("handwriting-mode-option"), true, "the toolbar pen icon is marked as a mode control");
assert.equal(modeKeyboardButton.classList.contains("handwriting-mode-option"), true, "the existing keyboard icon is marked as a mode control");
assert.equal(toolbar.rowOrder.at(-1), modeKeyboardButton, "the keyboard mode icon is the rightmost mode control");
assert.equal(toolbarHost.classList.contains("handwriting-mode-toolbar"), true, "the note toolbar is marked as the mode toolbar");
assert.equal(toolbar.rowOrder.includes(modeControl), false, "the fallback is not added to toolbar measurement");
assert.equal(modePenButton.disabled, true, "the active handwriting icon is disabled");
assert.equal(modeKeyboardButton.disabled, false, "the typing icon is enabled from handwriting mode");
assert.ok(toolbar.layoutCalls > 0, "moving the mode control refreshes toolbar layout");
runtimeMode.attachToolbar(runtimeEditor, toolbar);
assert.equal(toolbar.buttons.filter(({ spec }) => spec.commandId === "handwriting:mode-typing").length, 1, "reattaching does not duplicate the keyboard mode icon");
assert.equal(editableValues.length, 0, "CodeMirror editability is installed after the mount stack completes");
pendingMicrotasks.shift()();
assert.equal(editableValues.at(-1), false, "handwriting mode makes the note editor non-editable");
assert.ok(blurCount > 0, "handwriting mode blurs the note editor");
runtimeMode.set("typing");
assert.equal(contentDOM.getAttribute("inputmode"), null, "typing mode restores an absent inputmode attribute");
assert.equal(editableValues.at(-1), true, "typing mode restores editability");
assert.equal(modeControl.parentElement, null, "typing keeps the standalone fallback out of the toolbar");
assert.equal(modePenButton.disabled, false, "typing re-enables the handwriting icon");
assert.equal(modeKeyboardButton.disabled, true, "typing disables the active keyboard icon");
assert.equal(modeKeyboardButton.classList.contains("is-active"), true, "typing marks the keyboard icon active");
assert.equal(runtimeEditor.moreClosed, true, "typing mode closes the overflow toolbar");
assert.equal(runtimeEditor.slidersClosed, true, "typing mode closes open handwriting sliders");
assert.equal(openSlider.classList.contains("is-showing"), false, "typing mode closes an open slider popover");
assert.equal(openTip.classList.contains("is-showing"), false, "typing mode closes an open toolbar tip");
let prevented = false;
let stopped = false;
runtimeMode.set("handwriting");
assert.equal(contentDOM.getAttribute("inputmode"), "none", "handwriting mode reapplies keyboard suppression");
runtimeRoot.dispatch("focusin", {
  target: contentDOM,
  preventDefault: () => { prevented = true; },
  stopImmediatePropagation: () => { stopped = true; },
});
assert.equal(prevented, true, "handwriting mode prevents note focus");
assert.equal(stopped, true, "handwriting mode stops focus propagation");
assert.ok(blurCount > 1, "handwriting focus guard blurs the note editor");
runtimeMode.attachToolbar(runtimeEditor, null);
assert.equal(modeControl.parentElement, stableChromeHost, "detaching the toolbar returns the fallback mode control to its stable host");
assert.equal(toolbarHost.classList.contains("handwriting-mode-toolbar"), false, "the old toolbar loses the mode marker when detached");
assert.equal(toolbar.rowOrder.includes(modeControl), false, "the fallback control is never added to toolbar measurement");
assert.equal(modePenButton.classList.contains("handwriting-mode-option"), false, "detaching removes the mode marker from the old pen button");
assert.equal(modeKeyboardButton.classList.contains("handwriting-mode-option"), false, "detaching removes the mode marker from the old keyboard button");
runtimeMode.detachEditor(runtimeEditor);
assert.equal(contentDOM.getAttribute("inputmode"), null, "detaching restores the original inputmode attribute");
assert.equal(editableValues.at(-1), true, "detaching restores the host editability facet");

const readOnlyRoot = fakeDocument.createElement();
const readOnlyEditor = {
  view: {
    state: { facet: () => false },
    contentDOM: fakeDocument.createElement(),
    dispatch: (transaction) => dispatches.push(transaction),
  },
};
readOnlyRoot.appendChild(readOnlyEditor.view.contentDOM);
runtimeMode.attachEditor(readOnlyEditor, readOnlyRoot);
pendingMicrotasks.shift()();
runtimeMode.set("typing");
assert.equal(editableValues.at(-1), false, "typing mode preserves a host read-only editor");
runtimeMode.detachEditor(readOnlyEditor);
runtimeMode.reset();

const customInputModeRoot = fakeDocument.createElement();
const customInputModeContent = fakeDocument.createElement();
customInputModeContent.setAttribute("inputmode", "text");
const customInputModeEditor = {
  view: {
    state: { facet: () => true },
    contentDOM: customInputModeContent,
    dispatch: (transaction) => dispatches.push(transaction),
  },
};
customInputModeRoot.appendChild(customInputModeContent);
runtimeMode.attachEditor(customInputModeEditor, customInputModeRoot);
assert.equal(customInputModeContent.getAttribute("inputmode"), "none", "handwriting overrides a host inputmode");
pendingMicrotasks.shift()();
runtimeMode.set("typing");
assert.equal(customInputModeContent.getAttribute("inputmode"), "text", "typing restores a custom host inputmode");
runtimeMode.detachEditor(customInputModeEditor);
assert.equal(customInputModeContent.getAttribute("inputmode"), "text", "detaching preserves a custom host inputmode");
runtimeMode.reset();
console.log("PASS: handwriting mode state and bundle integration are present");
