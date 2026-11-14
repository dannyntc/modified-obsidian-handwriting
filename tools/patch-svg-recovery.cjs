const fs = require("node:fs");
const vm = require("node:vm");

const bundlePath = "main.js";
let bundle = fs.readFileSync(bundlePath, "utf8");

const replaceOnce = (before, after, label) => {
  if (bundle.includes(after)) return;
  const count = bundle.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  if (process.argv.includes("--check")) throw new Error(`Missing ${label}`);
  bundle = bundle.replace(before, after);
};

replaceOnce(
  'fg=new Set(["id","tool","color","width","createdAt","device","widthMode","pts","ptsd","points","page","pressureProfile","pressureSensitivity","inkStyle","inkSmoothing"]);',
  'fg=new Set(["id","tool","color","width","createdAt","device","widthMode","pts","ptsd","points","page","pressureProfile","pressureSensitivity","inkStyle","inkSmoothing","recoveredGeometry"]);',
  "recovered geometry storage allow-list",
);
replaceOnce(
  '...t.widthMode==="uniform"?{widthMode:t.widthMode}:{},...t.pressureProfile==="exp7"?',
  '...t.widthMode==="uniform"?{widthMode:t.widthMode}:t.widthMode==="recovered"?{widthMode:"recovered"}:{},...t.pressureProfile==="exp7"?',
  "recovered geometry storage width mode",
);
replaceOnce(
  '...t.inkSmoothing==="on"||t.inkSmoothing==="off"?{inkSmoothing:t.inkSmoothing}:{},...typeof t.page=="number"?{page:t.page}:{},...e>=2?{ptsd:j0(t.points)}:{pts:q0(t.points)}',
  '...t.inkSmoothing==="on"||t.inkSmoothing==="off"?{inkSmoothing:t.inkSmoothing}:{},...t.recoveredGeometry&&typeof t.recoveredGeometry==="object"?{recoveredGeometry:t.recoveredGeometry}:{},...typeof t.page=="number"?{page:t.page}:{},...e>=2?{ptsd:j0(t.points)}:{pts:q0(t.points)}',
  "recovered geometry sidecar serializer",
);
replaceOnce(
  '...l.widthMode==="uniform"?{widthMode:"uniform"}:{},...l.pressureProfile==="exp7"?',
  '...l.widthMode==="uniform"?{widthMode:"uniform"}:l.recoveredGeometry&&typeof l.recoveredGeometry==="object"?{widthMode:"recovered"}:{},...l.pressureProfile==="exp7"?',
  "recovered geometry sidecar parser width mode",
);
const recoveredParser = '...l.inkSmoothing==="on"||l.inkSmoothing==="off"?{inkSmoothing:l.inkSmoothing}:{},...l.recoveredGeometry&&typeof l.recoveredGeometry==="object"?{recoveredGeometry:l.recoveredGeometry}:{},...Number.isInteger(l.page)&&l.page>=1?{page:l.page}:{}';
const recoveredParserValid = '...l.inkSmoothing==="on"||l.inkSmoothing==="off"?{inkSmoothing:l.inkSmoothing}:{},...l.recoveredGeometry&&typeof l.recoveredGeometry==="object"&&typeof HandwritingSvgRecovery!=="undefined"&&HandwritingSvgRecovery.isValidGeometry(l.recoveredGeometry)?{recoveredGeometry:l.recoveredGeometry}:{},...Number.isInteger(l.page)&&l.page>=1?{page:l.page}:{}';
if (bundle.includes(recoveredParser)) replaceOnce(recoveredParser, recoveredParserValid, "recovered geometry sidecar parser validation");
else replaceOnce(
  '...l.inkSmoothing==="on"||l.inkSmoothing==="off"?{inkSmoothing:l.inkSmoothing}:{},...Number.isInteger(l.page)&&l.page>=1?{page:l.page}:{}',
  recoveredParserValid,
  "recovered geometry sidecar parser",
);
replaceOnce(
  'points:d,bbox:dt(d,p*2),createdAt:',
  'points:d,bbox:l.recoveredGeometry&&typeof HandwritingSvgRecovery!=="undefined"&&HandwritingSvgRecovery.isValidGeometry(l.recoveredGeometry)?l.recoveredGeometry.bbox:dt(d,p*2),createdAt:',
  "recovered geometry sidecar bounds",
);
replaceOnce(
  'function _u(i){let e=mo(i.pressureSensitivity);try{return IE(i)}finally{go(e)}}',
  'function _u(i){if(i?.recoveredGeometry?.centers?.length){let e=i.recoveredGeometry.centers,t=i.recoveredGeometry.halfWidths||[];return e.map((n,r)=>({x:n.x,y:n.y,hw:Number.isFinite(t[r])?Math.max(.05,t[r]):Math.max(.05,(i.width||1)/2)}))}let e=mo(i.pressureSensitivity);try{return IE(i)}finally{go(e)}}',
  "recovered geometry render ribbon",
);
replaceOnce(
  'function TE(i){if(HandwritingFountainInk.isFountain(i))return HandwritingFountainInk.path(i);',
  'function TE(i){if(i?.recoveredGeometry&&typeof HandwritingSvgRecovery!=="undefined")return HandwritingSvgRecovery.pathFromRecoveredGeometry(i.recoveredGeometry);if(HandwritingFountainInk.isFountain(i))return HandwritingFountainInk.path(i);',
  "recovered geometry SVG path",
);
replaceOnce(
  'function Gi(i,e,t,n,r){let s=i.points;',
  'function Gi(i,e,t,n,r){if(i?.recoveredGeometry&&typeof HandwritingSvgRecovery!=="undefined"&&typeof HandwritingSvgRecovery.splitRecoveredStroke==="function")return HandwritingSvgRecovery.splitRecoveredStroke(i,e,t,n,r);let s=i.points;',
  "recovered geometry eraser split",
);
replaceOnce(
  'function aw(i,e,t){for(let n of i.points)n.x+=e,n.y+=t;i.bbox={x:i.bbox.x+e,y:i.bbox.y+t,width:i.bbox.width,height:i.bbox.height},dh(i)}',
  'function aw(i,e,t){for(let n of i.points)n.x+=e,n.y+=t;i.bbox={x:i.bbox.x+e,y:i.bbox.y+t,width:i.bbox.width,height:i.bbox.height},i.recoveredGeometry&&typeof HandwritingSvgRecovery!=="undefined"&&(i.recoveredGeometry=HandwritingSvgRecovery.translateGeometry(i.recoveredGeometry,e,t)),dh(i)}',
  "recovered geometry move transform",
);
replaceOnce(
  'function or(i,e){for(let t of i.points)t.x*=e,t.y*=e;i.width*=e,i.bbox={x:i.bbox.x*e,y:i.bbox.y*e,width:i.bbox.width*e,height:i.bbox.height*e},dh(i)}',
  'function or(i,e){for(let t of i.points)t.x*=e,t.y*=e;i.width*=e,i.bbox={x:i.bbox.x*e,y:i.bbox.y*e,width:i.bbox.width*e,height:i.bbox.height*e},i.recoveredGeometry&&typeof HandwritingSvgRecovery!=="undefined"&&(i.recoveredGeometry=HandwritingSvgRecovery.scaleGeometry(i.recoveredGeometry,{x:0,y:0},e)),dh(i)}',
  "recovered geometry font transform",
);
replaceOnce(
  'cloneResizeStroke(e,n,r){let s=Number.isFinite(e.width)?e.width*r:e.width,o=e.points.map(a=>({...a,x:n.x+(a.x-n.x)*r,y:n.y+(a.y-n.y)*r}));return{...e,points:o,width:s,bbox:dt(o,s*2)}}',
  'cloneResizeStroke(e,n,r){let s=Number.isFinite(e.width)?e.width*r:e.width,o=e.points.map(a=>({...a,x:n.x+(a.x-n.x)*r,y:n.y+(a.y-n.y)*r}));return{...e,points:o,width:s,recoveredGeometry:e.recoveredGeometry&&typeof HandwritingSvgRecovery!=="undefined"?HandwritingSvgRecovery.scaleGeometry(e.recoveredGeometry,n,r):e.recoveredGeometry,bbox:dt(o,s*2)}}',
  "recovered geometry lasso resize",
);
replaceOnce(
  'cloneSelectionStyleStroke(e,t,n,r){let s=e.tool,o=Number.isFinite(e.width)&&Number.isFinite(t[s])&&Number.isFinite(n[s])&&n[s]>0?Math.max(.05,e.width*t[s]/n[s]):e.width,a=typeof r[s]==="string"?r[s]:e.color;return{...e,width:o,color:a,bbox:dt(e.points,o*2)}}',
  'cloneSelectionStyleStroke(e,t,n,r){let s=e.tool,o=Number.isFinite(e.width)&&Number.isFinite(t[s])&&Number.isFinite(n[s])&&n[s]>0?Math.max(.05,e.width*t[s]/n[s]):e.width,a=typeof r[s]==="string"?r[s]:e.color;return{...e,width:o,color:a,recoveredGeometry:e.recoveredGeometry&&typeof HandwritingSvgRecovery!=="undefined"?HandwritingSvgRecovery.scaleGeometryWidths(e.recoveredGeometry,e.width>0?o/e.width:1):e.recoveredGeometry,bbox:dt(e.points,o*2)}}',
  "recovered geometry style transform",
);

new vm.Script(bundle, { filename: bundlePath });
if (process.argv.includes("--check")) console.log("PASS: recovered geometry bundle integration is valid");
else {
  fs.writeFileSync(bundlePath, bundle);
  console.log("Updated main.js recovered geometry integration");
}
