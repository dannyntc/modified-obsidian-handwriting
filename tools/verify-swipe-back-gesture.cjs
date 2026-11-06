const fs = require("node:fs");
const vm = require("node:vm");

const sourcePath = "tools/swipe-back-guard-source.js";
const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, "utf8") : "";
const bundle = fs.readFileSync("main.js", "utf8");
if (!source.includes("var HandwritingSwipeBackGuard")) {
  throw new Error("swipe-back guard source is missing");
}
const context = {
  S: { Platform: { isMobileApp: true } },
  document: {
    documentElement: { dir: "" },
    body: { classList: { contains: () => false } },
  },
  console,
};
vm.runInNewContext(`${source}\nthis.SwipeBackGuard=HandwritingSwipeBackGuard;`, context);

const calls = [];
const workspace = {
  trigger(...args) {
    calls.push(args);
    return "forwarded";
  },
};
const originalTrigger = workspace.trigger;
const guard = new context.SwipeBackGuard({ workspace });

if (!guard.install()) throw new Error("swipe-back guard did not install on mobile");
if (!guard.install()) throw new Error("repeated guard installation was not idempotent");

const backSwipe = { points: 2, direction: "x", startX: 20, x: 120 };
const forwardSwipe = { points: 2, direction: "x", startX: 120, x: 20 };
const verticalSwipe = { points: 2, direction: "y", startX: 20, x: 120 };
const singleFingerBack = { points: 1, direction: "x", startX: 20, x: 120 };

if (workspace.trigger("swipe", backSwipe) !== undefined) throw new Error("back swipe was forwarded");
if (calls.length !== 0) throw new Error("back swipe reached the workspace dispatcher");
if (workspace.trigger("swipe", forwardSwipe) !== "forwarded") throw new Error("forward swipe was suppressed");
if (workspace.trigger("swipe", verticalSwipe) !== "forwarded") throw new Error("vertical swipe was suppressed");
if (workspace.trigger("swipe", singleFingerBack) !== "forwarded") throw new Error("single-finger swipe was suppressed");
if (workspace.trigger("other", backSwipe) !== "forwarded") throw new Error("unrelated workspace event was suppressed");
if (calls.length !== 4) throw new Error(`expected four forwarded events, got ${calls.length}`);

context.document.documentElement.dir = "rtl";
if (workspace.trigger("swipe", forwardSwipe) !== undefined) throw new Error("RTL back swipe was forwarded");
if (workspace.trigger("swipe", backSwipe) !== "forwarded") throw new Error("RTL forward swipe was suppressed");

guard.destroy();
if (workspace.trigger !== originalTrigger) throw new Error("guard did not restore the original trigger");

const restored = workspace.trigger("swipe", backSwipe);
if (restored !== "forwarded" || calls.length !== 6) throw new Error("destroy did not restore the original trigger");

const wrappedWorkspace = { trigger: originalTrigger };
context.document.documentElement.dir = "";
const wrappedGuard = new context.SwipeBackGuard({ workspace: wrappedWorkspace });
wrappedGuard.install();
const guardWrapper = wrappedWorkspace.trigger;
const laterWrapper = (...args) => guardWrapper(...args);
wrappedWorkspace.trigger = laterWrapper;
wrappedGuard.destroy();
if (wrappedWorkspace.trigger !== laterWrapper) throw new Error("guard destroyed another wrapper");
if (wrappedWorkspace.trigger("swipe", backSwipe) !== "forwarded") throw new Error("destroyed guard remained active through another wrapper");

const desktopWorkspace = { trigger: (...args) => args[0] };
const desktopGuard = new context.SwipeBackGuard({ workspace: desktopWorkspace }, { mobile: false });
if (desktopGuard.install()) throw new Error("swipe-back guard installed on desktop");
if (desktopWorkspace.trigger("swipe", backSwipe) !== "swipe") throw new Error("desktop trigger changed");
if (!bundle.includes("HandwritingSwipeBackGuard")) throw new Error("swipe-back guard is missing from main.js");
if (!bundle.includes("this.swipeBackGuard.install()")) throw new Error("swipe-back guard is not installed by the plugin");
if (!bundle.includes("this.swipeBackGuard?.destroy()")) throw new Error("swipe-back guard is not cleaned up on unload");

console.log("PASS: swipe-back guard filters only the mobile backward two-finger gesture");
