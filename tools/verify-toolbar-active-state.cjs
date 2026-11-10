const fs = require("node:fs");

const bundle = fs.readFileSync("main.js", "utf8");

if (!bundle.includes('o.classList.toggle("is-active",a.isActive?.(this.host)??!1)')) {
  throw new Error("toolbar active styling is still gated by the input-lit predicate");
}
if (!bundle.includes('refreshActiveStates(){for(let{el:o,spec:a}of this.buttons){o.classList.toggle("is-active",a.isActive?.(this.host)??!1);let l=a.isEnabled?.(this.host)??!0;o.classList.toggle("is-disabled",!l),o.setAttribute("aria-disabled",l?"false":"true")}}refresh(){this.refreshActiveStates(),')) {
  throw new Error("toolbar active or enabled states are still deferred until the animation frame");
}
if (!bundle.includes('isLit:i=>Ib(i,"pen")') || !bundle.includes('isLit:i=>Ib(i,"highlighter")')) {
  throw new Error("pen/highlighter lit predicates are missing");
}

console.log("PASS: all toolbar active and enabled styling follows current tool state");
