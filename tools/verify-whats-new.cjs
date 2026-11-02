#!/usr/bin/env node
const fs = require("fs");

const main = fs.readFileSync("main.js", "utf8");

if (main.includes('"1.4.17":[`plugin verification oops')) {
  throw new Error("The historical Alan install note is still in the What’s New data");
}
if (main.includes("thank you for downloading Handwriting.")) {
  throw new Error("The Alan install message is still present");
}
for (const marker of ['"1.4.16"', '"1.4.19"', "showWhatsNewIfDue", "freshInstall"]) {
  if (!main.includes(marker)) throw new Error(`What’s New behavior marker disappeared: ${marker}`);
}
if (main.includes("showScribbleHintIfDue") || main.includes("this.showScribbleHintIfDue()")) {
  throw new Error("The first-install iPad Scribble note is still wired to startup");
}
for (const marker of ["scribbleHintOffered", "checkEinkHint()", "this.checkEinkHint()"] ) {
  if (!main.includes(marker)) throw new Error(`Unrelated device hint behavior disappeared: ${marker}`);
}

console.log("What’s New install-note verification passed");
