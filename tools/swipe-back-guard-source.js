/*
 * Suppress Obsidian's mobile two-finger backward navigation gesture.
 *
 * Obsidian dispatches the gesture through workspace.trigger("swipe", event)
 * before it shows the Navigate back popup and executes app:go-back. Keeping
 * this filter in a small source file makes the bundle patch reproducible and
 * keeps plugin unload able to restore the workspace dispatcher.
 */
var HandwritingSwipeBackGuard=(()=>{
  const isMobileApp=()=>typeof S!=="undefined"&&S?.Platform?.isMobileApp===true;
  const isRtl=()=>{
    if(typeof document==="undefined")return!1;
    const direction=document.documentElement?.dir?.toLowerCase?.();
    return direction==="rtl"||(!direction&&document.body?.classList?.contains?.("mod-rtl"));
  };
  const isBackwardSwipe=event=>{
    if(!event||event.points!==2||event.direction!=="x")return!1;
    if(!Number.isFinite(event.startX)||!Number.isFinite(event.x))return!1;
    return event.x>event.startX!==isRtl();
  };

  class SwipeBackGuard{
    constructor(app,{mobile=null}={}){
      this.app=app;
      this.workspace=app?.workspace??null;
      this.mobile=mobile;
      this.originalTrigger=null;
      this.wrappedTrigger=null;
      this.installed=!1;
    }

    install(){
      if(this.installed)return!0;
      if(this.mobile===!1||(this.mobile===null&&!isMobileApp()))return!1;
      const workspace=this.workspace;
      if(!workspace||typeof workspace.trigger!=="function")return!1;
      const original=workspace.trigger;
      const guard=this;
      const wrapped=function(event,...args){
        if(guard.installed&&event==="swipe"&&isBackwardSwipe(args[0]))return;
        return original.call(this,event,...args);
      };
      this.originalTrigger=original;
      this.wrappedTrigger=wrapped;
      workspace.trigger=wrapped;
      this.installed=!0;
      return!0;
    }

    destroy(){
      const workspace=this.workspace;
      if(this.installed&&workspace?.trigger===this.wrappedTrigger)workspace.trigger=this.originalTrigger;
      this.installed=!1;
      this.originalTrigger=null;
      this.wrappedTrigger=null;
    }
  }

  return SwipeBackGuard;
})();
