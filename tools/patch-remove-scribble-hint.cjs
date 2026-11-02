#!/usr/bin/env node
const fs = require("fs");
const vm = require("vm");

const path = "main.js";
const checkOnly = process.argv.includes("--check");
let main = fs.readFileSync(path, "utf8");

function replaceOnce(needle, replacement, label) {
  const count = main.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  main = main.replace(needle, replacement);
}

replaceOnce(
  'this.unloaded||(this.showWhatsNewIfDue(),this.showScribbleHintIfDue())',
  'this.unloaded||this.showWhatsNewIfDue()',
  "startup Scribble hint registration",
);

replaceOnce(
  'showScribbleHintIfDue(){!S.Platform.isIosApp||!S.Platform.isTablet||this.settings.scribbleHintOffered||(bi(`IPAD USERS ONLY\n\nif you are seeing black ink \'lift\' up off the page and ink is disappearing\n\nturn off scribble > iPad settings > Apple pencil > scribble toggle off\n\n- alan :)`,0),this.settings.scribbleHintOffered=!0,this.saveSettingsNow())}',
  '',
  "Scribble hint method",
);

if (main.includes("showScribbleHintIfDue") || main.includes("this.showScribbleHintIfDue()")) {
  throw new Error("Scribble hint wiring remains after patch");
}
new vm.Script(main);

if (!checkOnly) {
  fs.writeFileSync(path, main);
  console.log("Removed the first-install iPad Scribble note");
}
