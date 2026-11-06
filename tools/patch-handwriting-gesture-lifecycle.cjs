const fs = require("node:fs");

const file = "main.js";
let bundle = fs.readFileSync(file, "utf8");

function replaceOnce(label, before, after) {
  if (bundle.includes(after)) return;
  const count = bundle.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  bundle = bundle.replace(before, after);
}

replaceOnce(
  "pinch session state",
  "pinchStartSpread=0;pinchFocal={x:0,y:0};liveTouchIds=new Set",
  "pinchStartSpread=0;pinchFocal={x:0,y:0};pinchSession=!1;liveTouchIds=new Set",
);
replaceOnce(
  "pinch session ownership",
  "this.pinchFocal=Ca(t[0],t[1]),this.pinchLive&&(",
  "this.pinchFocal=Ca(t[0],t[1]),this.pinchSession=!0,this.pinchLive&&(",
);
replaceOnce(
  "pointer release pinch ownership",
  "let s=this.touchPos.has(e.pointerId)&&this.pinchLive;",
  "let s=this.touchPos.has(e.pointerId)&&this.pinchSession;",
);
replaceOnce(
  "remaining pinch finger movement",
  "if(this.touchPos.has(e.pointerId)&&(this.touchPos.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.updatePinch(e))){e.preventDefault(),e.stopPropagation();return}if(this.fingerInkBlockedUntilAllLift",
  "if(this.touchPos.has(e.pointerId)&&(this.touchPos.set(e.pointerId,{x:e.clientX,y:e.clientY}),this.updatePinch(e))){e.preventDefault(),e.stopPropagation();return}if(this.pinchSession&&this.touchPos.has(e.pointerId)){e.preventDefault(),e.stopPropagation();return}if(this.fingerInkBlockedUntilAllLift",
);
replaceOnce(
  "final pointer release clears pinch session",
  "this.touchPos.delete(e.pointerId),this.endPinch(e,l),this.rebasePinch()",
  "this.touchPos.delete(e.pointerId),this.endPinch(e,l),this.rebasePinch(),this.touchPos.size===0&&(this.pinchSession=!1)",
);
replaceOnce(
  "native end clears pinch session",
  "this.pinchStartSpread=0,this.paroleId=null",
  "this.pinchSession=!1,this.pinchStartSpread=0,this.paroleId=null",
);
replaceOnce(
  "native touch pinch ownership capture",
  "let d=h;if(!d.changedTouches)return;let u=d.target;if(!u||!this.scrollEl.contains(u))return;let p=!this.penOff()",
  "let d=h;if(!d.changedTouches)return;let u=d.target;if(!u||!this.scrollEl.contains(u))return;let pinchOwned=this.pinchSession,p=!this.penOff()",
);
const brokenNativeRelease = "this.finishFingerInkPreparation();if(pinchOwned||this.pinchSession){d.preventDefault(),d.stopPropagation();return}if(this.penOff())";
const fixedNativeRelease = "this.finishFingerInkPreparation();if(pinchOwned||this.pinchSession){d.preventDefault(),d.stopPropagation();return}}if(this.penOff())";
if (bundle.includes(brokenNativeRelease)) bundle = bundle.replace(brokenNativeRelease, fixedNativeRelease);
replaceOnce(
  "native touch pinch ownership release",
  "this.finishFingerInkPreparation()}if(this.penOff())",
  "this.finishFingerInkPreparation();if(pinchOwned||this.pinchSession){d.preventDefault(),d.stopPropagation();return}}if(this.penOff())",
);
replaceOnce(
  "pinch all contacts callback",
  "!s&&!o&&!a&&this.touchPos.size===0&&this.guardTouches.size===0&&this.cb.onAllContactsLifted?.()",
  "!o&&!a&&this.touchPos.size===0&&this.guardTouches.size===0&&this.cb.onAllContactsLifted?.()",
);
replaceOnce(
  "pinch pointer release consumption",
  "(o||a||n)&&(e.preventDefault(),e.stopPropagation())",
  "(s||o||a||n)&&(e.preventDefault(),e.stopPropagation())",
);

fs.writeFileSync(file, bundle);
console.log("Updated main.js to retain pinch ownership through all touch releases");
