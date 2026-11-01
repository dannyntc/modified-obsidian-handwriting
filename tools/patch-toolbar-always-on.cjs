const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
let bundle = fs.readFileSync(bundlePath, "utf8");

function replaceOnce(before, after, label) {
  const beforeCount = bundle.split(before).length - 1;
  const afterCount = bundle.split(after).length - 1;
  if (beforeCount === 0 && afterCount === 1) return;
  if (beforeCount !== 1 || afterCount !== 0) {
    throw new Error(`${label}: expected one unpatched or one patched match, found before=${beforeCount}, after=${afterCount}`);
  }
  bundle = bundle.replace(before, after);
}

replaceOnce(
  'var Ch="auto"',
  'var Ch="show"',
  "toolbar runtime default",
);
replaceOnce(
  'function Lh(i){return i==="show"||i==="hide"?i:"auto"}',
  'function Lh(i){return"show"}',
  "toolbar setting normalization",
);
replaceOnce(
  'penTools:"auto",noteZoomControls:"show"',
  'penTools:"show",noteZoomControls:"show"',
  "toolbar settings default",
);
replaceOnce(
  'callback:()=>{let m=x=>on(x,S.Platform.isMobileApp,qe()),g=!m(this.settings.penTools),b=this.settings.barsRestore?.penTools,w=g?b&&m(b)?b:"show":"hide";this.settings.barsRestore=g?null:{penTools:this.settings.penTools,noteZoomControls:this.settings.noteZoomControls},this.settings.penTools=w,_o(w),Ge(),L(this.persistSettings(),"save the toolbar visibility"),V()&&new S.Notice(`Handwriting: toolbar ${w==="hide"?"off":"on"}`)}',
  'callback:()=>{this.settings.penTools="show",this.settings.barsRestore=null,_o("show"),Ge(),L(this.persistSettings(),"save the toolbar visibility"),V()&&new S.Notice("Handwriting: toolbar on")}',
  "toolbar visibility command",
);
replaceOnce(
  'case"penTools":{let a=Lh(o);r.penTools=a,_o(a),Ge();break}',
  'case"penTools":r.penTools="show",_o("show"),Ge();break;',
  "toolbar settings UI normalization",
);
replaceOnce(
  '{name:"Toolbar visibility",desc:"Show or hide the pen toolbar. Auto shows it on phones and tablets, on desktop once a pen is used, and moves it aside while you write. Global setting. Default auto.",control:{type:"dropdown",key:"penTools",options:{hide:"Off",show:"On",auto:"Auto"}}}',
  '{name:"Toolbar visibility",desc:"The pen toolbar is always enabled. Global setting. Default on.",control:{type:"dropdown",key:"penTools",options:{show:"On"}}}',
  "toolbar visibility setting definition",
);

new vm.Script(bundle, { filename: bundlePath });

if (process.argv.includes("--check")) {
  for (const text of [
    'var Ch="show"',
    'function Lh(i){return"show"}',
    'penTools:"show",noteZoomControls:"show"',
    'options:{show:"On"}',
    'this.settings.penTools="show"',
    'Handwriting: toolbar on',
  ]) {
    if (!bundle.includes(text)) throw new Error(`toolbar always-on patch is missing ${text}`);
  }
  console.log("PASS: toolbar always-on bundle patch is valid");
} else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js with always-on toolbar visibility");
}
