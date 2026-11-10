const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
let bundle = fs.readFileSync(bundlePath, "utf8");

const before = 'o.classList.toggle("is-active",(a.isLit??a.isActive)?.(this.host)??!1)';
const after = 'o.classList.toggle("is-active",a.isActive?.(this.host)??!1)';
const beforeCount = bundle.split(before).length - 1;
const afterCount = bundle.split(after).length - 1;
if (beforeCount === 0 && afterCount >= 1) {
  // Already patched.
} else {
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`toolbar active-state patch: expected one unpatched match, found before=${beforeCount}, after=${afterCount}`);
  }
  bundle = bundle.replace(before, after);
}

const deferredRefresh = 'refresh(){this.refreshQueued||(this.refreshQueued=!0,(this.el.ownerDocument.defaultView??window).requestAnimationFrame(()=>{this.refreshQueued=!1,this.refreshNow()}))}';
const activeOnlyRefresh = 'refreshActiveStates(){for(let{el:o,spec:a}of this.buttons)o.classList.toggle("is-active",a.isActive?.(this.host)??!1)}refresh(){this.refreshActiveStates(),this.refreshQueued||(this.refreshQueued=!0,(this.el.ownerDocument.defaultView??window).requestAnimationFrame(()=>{this.refreshQueued=!1,this.refreshNow()}))}';
const immediateRefresh = 'refreshActiveStates(){for(let{el:o,spec:a}of this.buttons){o.classList.toggle("is-active",a.isActive?.(this.host)??!1);let l=a.isEnabled?.(this.host)??!0;o.classList.toggle("is-disabled",!l),o.setAttribute("aria-disabled",l?"false":"true")}}refresh(){this.refreshActiveStates(),this.refreshQueued||(this.refreshQueued=!0,(this.el.ownerDocument.defaultView??window).requestAnimationFrame(()=>{this.refreshQueued=!1,this.refreshNow()}))}';
const deferredCount = bundle.split(deferredRefresh).length - 1;
const activeOnlyCount = bundle.split(activeOnlyRefresh).length - 1;
const immediateCount = bundle.split(immediateRefresh).length - 1;
if (immediateCount === 1) {
  // Already patched.
} else if (activeOnlyCount === 1) {
  bundle = bundle.replace(activeOnlyRefresh, immediateRefresh);
} else {
  if (deferredCount !== 1 || activeOnlyCount !== 0 || immediateCount !== 0) {
    throw new Error(`toolbar immediate-refresh patch: expected one known match, found deferred=${deferredCount}, activeOnly=${activeOnlyCount}, immediate=${immediateCount}`);
  }
  bundle = bundle.replace(deferredRefresh, immediateRefresh);
}

new vm.Script(bundle, { filename: bundlePath });

if (process.argv.includes("--check")) {
  if (!bundle.includes(after) || bundle.includes(before) || !bundle.includes(immediateRefresh)) {
    throw new Error("toolbar active-state patch is missing or still defers active/enabled styling");
  }
  console.log("PASS: toolbar active-state patch is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js so toolbar active and enabled styling updates immediately");
}
