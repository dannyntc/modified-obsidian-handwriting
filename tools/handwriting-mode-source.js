/* HANDWRITING MODE */
var HandwritingMode = (() => {
  const HANDWRITING = "handwriting";
  const TYPING = "typing";
  const LEGACY_KEYBOARD_COMMAND = "handwriting:pen-ink-toggle";
  const listeners = new Set();
  let current = HANDWRITING;

  const isValid = (value) => value === HANDWRITING || value === TYPING;
  const isHandwriting = () => current === HANDWRITING;
  const isTyping = () => current === TYPING;

  function syncDocument(doc) {
    const body = doc?.body;
    if (!body) return;
    body.classList.toggle("handwriting-mode-handwriting", isHandwriting());
    body.classList.toggle("handwriting-mode-typing", isTyping());
  }

  function runtimeOverlays() {
    try {
      return typeof B !== "undefined" && B instanceof Set ? [...B] : [];
    } catch {
      return [];
    }
  }

  function set(value) {
    if (!isValid(value) || value === current) return false;
    const previous = current;
    current = value;
    syncDocument(typeof document === "undefined" ? null : document);

    if (isTyping()) {
      try {
        typeof ok === "function" && ok(true);
      } catch (error) {
        console.error("[handwriting] could not finish the active stroke", error);
      }
      try {
        typeof Bs === "function" && Bs();
      } catch (error) {
        console.error("[handwriting] could not clear the pen cursor", error);
      }
    }

    for (const overlay of runtimeOverlays()) {
      try {
        overlay.applyHandwritingMode?.(current);
      } catch (error) {
        console.error("[handwriting] could not apply the input mode", error);
      }
    }
    for (const listener of [...listeners]) {
      try {
        listener(current, previous);
      } catch (error) {
        console.error("[handwriting] mode listener failed", error);
      }
    }
    try {
      typeof J === "function" && J();
    } catch (error) {
      console.error("[handwriting] could not refresh mode controls", error);
    }
    return true;
  }

  function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    listener(current, current);
    return () => listeners.delete(listener);
  }

  function isInkCommand(id) {
    const value = String(id ?? "").replace(/^handwriting:/, "");
    return /^(?:inline-tool-|ink-|pen-color-|highlighter-|eraser-|mouse-ink-|toolbar-zoom-)/.test(value);
  }

  function filterTransaction(transaction) {
    if (!isHandwriting() || !transaction?.docChanged) return transaction;
    if (typeof transaction.isUserEvent !== "function") return transaction;
    return transaction.isUserEvent("input") || transaction.isUserEvent("delete") ? [] : transaction;
  }

  function blurEditor(editor) {
    try {
      if (editor?.view && typeof vy === "function") {
        vy(editor.view, false);
      } else {
        editor?.view?.contentDOM?.blur?.();
      }
    } catch (error) {
      console.error("[handwriting] could not blur the note editor", error);
    }
  }

  function syncKeyboardSuppression(editor) {
    const contentDOM = editor?.view?.contentDOM;
    if (!contentDOM?.setAttribute) return;
    const state = editor.__handwritingModeKeyboard ?? {
      originalInputMode: contentDOM.getAttribute?.("inputmode") ?? null,
      active: false,
    };
    editor.__handwritingModeKeyboard = state;
    if (isHandwriting()) {
      if (!state.active) {
        state.originalInputMode = contentDOM.getAttribute?.("inputmode") ?? null;
        state.active = true;
      }
      contentDOM.setAttribute("inputmode", "none");
      return;
    }
    if (!state.active) return;
    if (state.originalInputMode === null) contentDOM.removeAttribute?.("inputmode");
    else contentDOM.setAttribute("inputmode", state.originalInputMode);
    state.active = false;
  }

  function restoreKeyboardSuppression(editor) {
    const state = editor?.__handwritingModeKeyboard;
    const contentDOM = editor?.view?.contentDOM;
    if (state?.active && contentDOM) {
      if (state.originalInputMode === null) contentDOM.removeAttribute?.("inputmode");
      else contentDOM.setAttribute?.("inputmode", state.originalInputMode);
    }
    delete editor.__handwritingModeKeyboard;
  }

  function installEditableMode(editor) {
    const view = editor?.view;
    if (!view?.dispatch || typeof Qe === "undefined" || !Qe.Compartment || !Qe.StateEffect?.appendConfig ||
      typeof at === "undefined" || !at.EditorView?.editable) return null;
    const baseEditable = view.state?.facet?.(at.EditorView.editable) !== false;
    const compartment = new Qe.Compartment();
    const state = { compartment, baseEditable };
    editor.__handwritingModeEditable = state;
    try {
      view.dispatch({
        effects: Qe.StateEffect.appendConfig.of(
          compartment.of(at.EditorView.editable.of(isTyping() && baseEditable)),
        ),
      });
      return state;
    } catch (error) {
      delete editor.__handwritingModeEditable;
      console.error("[handwriting] could not install note editability", error);
      return null;
    }
  }

  function syncEditorEditable(editor) {
    const state = editor?.__handwritingModeEditable;
    const view = editor?.view;
    if (!state || !view?.dispatch || typeof at === "undefined" || !at.EditorView?.editable) return;
    try {
      view.dispatch({
        effects: state.compartment.reconfigure(at.EditorView.editable.of(isTyping() && state.baseEditable)),
      });
    } catch (error) {
      console.error("[handwriting] could not update note editability", error);
    }
  }

  function restoreEditorEditable(editor) {
    const state = editor?.__handwritingModeEditable;
    const view = editor?.view;
    if (state && view?.dispatch && typeof at !== "undefined" && at.EditorView?.editable) {
      try {
        view.dispatch({ effects: state.compartment.reconfigure(at.EditorView.editable.of(state.baseEditable)) });
      } catch {
        // The CodeMirror view may already be destroyed during pane teardown.
      }
    }
    delete editor.__handwritingModeEditable;
  }

  function closeHandwritingChrome(editor, root) {
    try {
      editor?.mobileTools?.setCollapsed?.(false);
      editor?.mobileTools?.setMoreOpen?.(false);
      editor?.mobileTools?.closeInkSliders?.();
      editor?.mobileTools?.cancelTipTimer?.();
    } catch (error) {
      console.error("[handwriting] could not close the handwriting toolbar", error);
    }
    try {
      const scope = root.closest?.(".markdown-source-view") ?? root;
      const openChrome = scope.querySelectorAll?.(
        ".handwriting-slider-pop.is-showing, .handwriting-strip-tip.is-showing, .handwriting-pill-tip.is-showing",
      ) ?? [];
      for (const element of openChrome) element.classList.remove("is-showing");
    } catch (error) {
      console.error("[handwriting] could not close handwriting popovers", error);
    }
  }

  function isTextEditorTarget(root, target) {
    return !!target && !target.closest?.(".handwriting-mode-toggle, .handwriting-mode-option") && (target === root || root.contains?.(target));
  }

  function shouldBlockKey(event) {
    if (event.isComposing || event.key === "Process") return true;
    const key = String(event.key ?? "");
    const command = event.ctrlKey || event.metaKey;
    if (command && (key.toLowerCase() === "v" || key.toLowerCase() === "x")) return true;
    if (event.altKey || command) return ["Backspace", "Delete", "Enter"].includes(key);
    return key.length === 1 || ["Backspace", "Delete", "Enter"].includes(key);
  }

  function attachTextGuards(editor, root) {
    const keydown = (event) => {
      if (isHandwriting() && isTextEditorTarget(root, event.target) && shouldBlockKey(event)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const block = (event) => {
      if (!isHandwriting() || !isTextEditorTarget(root, event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const beforeInput = (event) => {
      if (!isHandwriting() || !isTextEditorTarget(root, event.target)) return;
      const type = String(event.inputType ?? "");
      if (type.startsWith("insert") || type.startsWith("delete")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const focusin = (event) => {
      if (!isHandwriting() || !isTextEditorTarget(root, event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      blurEditor(editor);
    };
    const pointerdown = (event) => {
      if (isHandwriting() && isTextEditorTarget(root, event.target)) blurEditor(editor);
    };
    root.addEventListener("keydown", keydown, true);
    root.addEventListener("beforeinput", beforeInput, true);
    root.addEventListener("focusin", focusin, true);
    root.addEventListener("pointerdown", pointerdown, true);
    root.addEventListener("compositionstart", block, true);
    root.addEventListener("paste", block, true);
    root.addEventListener("cut", block, true);
    root.addEventListener("drop", block, true);
    return () => {
      root.removeEventListener("keydown", keydown, true);
      root.removeEventListener("beforeinput", beforeInput, true);
      root.removeEventListener("focusin", focusin, true);
      root.removeEventListener("pointerdown", pointerdown, true);
      root.removeEventListener("compositionstart", block, true);
      root.removeEventListener("paste", block, true);
      root.removeEventListener("cut", block, true);
      root.removeEventListener("drop", block, true);
    };
  }

  function setIcon(button, icon, fallback) {
    try {
      const setter = typeof Yt !== "undefined" ? Yt?.setIcon : null;
      if (typeof setter === "function") {
        setter(button, icon);
        if (button.querySelector?.("svg")) return;
      }
    } catch {
      // The standalone runtime and tests may not expose Obsidian's icon helper.
    }
    if (typeof button.setText === "function") button.setText(fallback);
    else button.textContent = fallback;
  }

  function createControl(root) {
    const doc = root.ownerDocument;
    const control = doc.createElement("div");
    control.className = "handwriting-mode-toggle";
    control.dataset.ignoreSwipe = "true";
    control.setAttribute("role", "group");
    control.setAttribute("aria-label", "Note input mode");
    const buttons = new Map();
    for (const [value, icon, glyph, label] of [
      [HANDWRITING, "pen", "P", "Use handwriting mode"],
      [TYPING, "keyboard", "K", "Use typing mode"],
    ]) {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = `handwriting-mobile-tool handwriting-mode-option handwriting-mode-${value}`;
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      setIcon(button, icon, glyph);
      button.addEventListener("click", () => set(value));
      control.appendChild(button);
      buttons.set(value, button);
    }
    root.appendChild(control);
    return { control, buttons };
  }

  function findToolbarModeButtons(toolbar) {
    const buttons = new Map();
    for (const entry of toolbar?.buttons ?? []) {
      const commandId = entry?.spec?.commandId;
      if (commandId === "handwriting:mode-handwriting") buttons.set(HANDWRITING, entry.el);
      if (commandId === "handwriting:mode-typing") buttons.set(TYPING, entry.el);
    }
    return buttons.size === 2 ? buttons : null;
  }

  function removeLegacyKeyboardButton(toolbar) {
    const entries = Array.isArray(toolbar?.buttons) ? toolbar.buttons : [];
    const legacyElements = new Set(
      entries
        .filter((entry) => entry?.spec?.commandId === LEGACY_KEYBOARD_COMMAND)
        .map((entry) => entry.el)
        .filter(Boolean),
    );
    if (legacyElements.size === 0) return;

    for (const element of legacyElements) element.remove?.();
    if (Array.isArray(toolbar.rowOrder)) {
      for (let index = toolbar.rowOrder.length - 1; index >= 0; index -= 1) {
        if (legacyElements.has(toolbar.rowOrder[index])) toolbar.rowOrder.splice(index, 1);
      }
    }
    if (Array.isArray(toolbar.buttons)) {
      for (let index = toolbar.buttons.length - 1; index >= 0; index -= 1) {
        if (legacyElements.has(toolbar.buttons[index]?.el)) toolbar.buttons.splice(index, 1);
      }
    }
    toolbar.built?.delete?.(LEGACY_KEYBOARD_COMMAND);
  }

  function isNoteToolbarCompatible(toolbar) {
    removeLegacyKeyboardButton(toolbar);
    return !!findToolbarModeButtons(toolbar);
  }

  function clearToolbarModeButtons(toolbar, buttons) {
    if (!toolbar) return;
    toolbar.el?.classList.remove("handwriting-mode-toolbar");
    for (const button of buttons?.values?.() ?? []) {
      button.classList.remove("handwriting-mode-option", "handwriting-mode-handwriting", "handwriting-mode-typing");
    }
    if (toolbar.modeButtons === buttons) toolbar.modeButtons = null;
  }

  function attachToolbar(editor, toolbar) {
    const state = editor?.__handwritingModeUi;
    if (!state) return;
    removeLegacyKeyboardButton(toolbar);
    const nextToolbar = findToolbarModeButtons(toolbar) ? toolbar : null;
    if (state.toolbar === nextToolbar && (nextToolbar ? state.toolbarButtons?.size === 2 : state.control.parentElement === state.root)) {
      nextToolbar?.el?.classList.add("handwriting-mode-toolbar");
      state.refresh();
      nextToolbar?.layoutOverflow?.();
      nextToolbar?.refresh?.();
      return;
    }

    const previousToolbar = state.toolbar;
    clearToolbarModeButtons(previousToolbar, state.toolbarButtons);
    state.toolbarButtons = new Map();
    state.control.remove?.();
    state.toolbar = nextToolbar;
    if (nextToolbar) {
      state.toolbarButtons = findToolbarModeButtons(nextToolbar) ?? new Map();
      nextToolbar.el.classList.add("handwriting-mode-toolbar");
      nextToolbar.modeButtons = state.toolbarButtons;
      for (const [value, button] of state.toolbarButtons) {
        button.classList.add("handwriting-mode-option", `handwriting-mode-${value}`);
      }
    } else {
      state.root.appendChild(state.control);
    }
    state.refresh();
    previousToolbar?.layoutOverflow?.();
    nextToolbar?.layoutOverflow?.();
    nextToolbar?.refresh?.();
  }

  function applyVisualState(editor, root, control, buttons, toolbarButtons, toolbar) {
    const typing = isTyping();
    syncKeyboardSuppression(editor);
    syncEditorEditable(editor);
    if (typing) closeHandwritingChrome(editor, root);
    else blurEditor(editor);
    root.classList.toggle("handwriting-mode-host", true);
    root.classList.toggle("handwriting-mode-typing", typing);
    root.classList.toggle("handwriting-mode-handwriting", !typing);
    for (const [value, button] of [...buttons, ...toolbarButtons]) {
      const active = value === current;
      button.classList.toggle("is-current", active);
      button.classList.toggle("is-active", active);
      button.disabled = active;
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-disabled", String(active));
    }
    control.dataset.mode = current;
    syncDocument(root.ownerDocument);
    toolbar?.refresh?.();
  }

  function guardMutations(editor) {
    const names = ["clearAllInk", "deleteSelectedInk", "cutSelectedInk", "pasteInkHere"];
    const saved = {};
    for (const name of names) {
      const original = editor[name];
      if (typeof original !== "function") continue;
      saved[name] = original;
      editor[name] = function guardedHandwritingMutation(...args) {
        if (isTyping()) {
          if (name === "cutSelectedInk") return { kind: "empty" };
          return name === "clearAllInk" ? null : 0;
        }
        return original.apply(this, args);
      };
    }
    return saved;
  }

  function attachEditor(editor, root) {
    if (!root || editor.__handwritingModeDispose) return;
    syncKeyboardSuppression(editor);
    const { control, buttons } = createControl(root);
    const uiState = { control, buttons, toolbarButtons: new Map(), root, toolbar: null, refresh: null };
    const textGuardsDispose = attachTextGuards(editor, root);
    const saved = guardMutations(editor);
    const refresh = () => applyVisualState(editor, root, control, buttons, uiState.toolbarButtons, uiState.toolbar);
    uiState.refresh = refresh;
    editor.__handwritingModeUi = uiState;
    editor.applyHandwritingToolbar = (toolbar) => attachToolbar(editor, toolbar);
    const unsubscribe = subscribe(refresh);
    editor.applyHandwritingMode = refresh;
    const attachToken = {};
    editor.__handwritingModeAttachToken = attachToken;
    editor.__handwritingModeDispose = () => {
      unsubscribe();
      textGuardsDispose();
      restoreKeyboardSuppression(editor);
      restoreEditorEditable(editor);
      const toolbar = uiState.toolbar;
      clearToolbarModeButtons(toolbar, uiState.toolbarButtons);
      toolbar?.layoutOverflow?.();
      control.remove();
      for (const [name, original] of Object.entries(saved)) editor[name] = original;
      delete editor.applyHandwritingMode;
      delete editor.applyHandwritingToolbar;
      delete editor.__handwritingModeUi;
      delete editor.__handwritingModeAttachToken;
      delete editor.__handwritingModeDispose;
      root.classList.remove("handwriting-mode-host", "handwriting-mode-typing", "handwriting-mode-handwriting");
    };
    refresh();
    const schedule = typeof queueMicrotask === "function" ? queueMicrotask : (callback) => Promise.resolve().then(callback);
    schedule(() => {
      if (editor.__handwritingModeAttachToken === attachToken && editor.__handwritingModeDispose) {
        installEditableMode(editor);
      }
    });
  }

  function detachEditor(editor) {
    editor?.__handwritingModeDispose?.();
  }

  function reset() {
    if (current !== HANDWRITING) set(HANDWRITING);
    syncDocument(typeof document === "undefined" ? null : document);
  }

  return {
    HANDWRITING,
    TYPING,
    get: () => current,
    set,
    reset,
    subscribe,
    isHandwriting,
    isTyping,
    isInkCommand,
    filterTransaction,
    attachEditor,
    attachToolbar,
    isNoteToolbarCompatible,
    detachEditor,
  };
})();
