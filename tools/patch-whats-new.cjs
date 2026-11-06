#!/usr/bin/env node
const fs = require("fs");
const vm = require("vm");

const path = "main.js";
const checkOnly = process.argv.includes("--check");
let main = fs.readFileSync(path, "utf8");

const legacyEntry = '"1.4.17":[`plugin verification oops\n\nthank you for downloading Handwriting.\n\n - alan :)`],';
const count = main.split(legacyEntry).length - 1;
if (count > 1) throw new Error(`Expected at most one historical install-note entry, found ${count}`);
if (count === 1) main = main.replace(legacyEntry, "");

if (main.includes('"1.4.17":[`plugin verification oops') || main.includes("thank you for downloading Handwriting.")) {
  throw new Error("The historical install-note entry was not removed");
}
new vm.Script(main);

if (!checkOnly && count === 1) {
  fs.writeFileSync(path, main);
  console.log("Removed the historical Alan install note from main.js");
}
