(function(root) {
  'use strict';
  const keys = ['pan', 'tilt', 'roll', 'fov'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const wrap = v => ((v + 180) % 360 + 360) % 360 - 180;
  function pose(p) {
    if (!p || keys.some(k => typeof p[k] !== 'number' || !Number.isFinite(p[k]))) throw Error('PTZ_INVALID_POSE');
    return {pan:wrap(p.pan), tilt:clamp(p.tilt,-90,90), roll:wrap(p.roll), fov:clamp(p.fov,10,150)};
  }
  function blend(a,b,t) {
    t=clamp(t,0,1); const s=t*t*(3-2*t);
    const za=Math.log(Math.tan(a.fov*Math.PI/360)), zb=Math.log(Math.tan(b.fov*Math.PI/360));
    return pose({pan:a.pan+wrap(b.pan-a.pan)*s, tilt:a.tilt+(b.tilt-a.tilt)*s,
      roll:a.roll+wrap(b.roll-a.roll)*s, fov:Math.atan(Math.exp(za+(zb-za)*s))*360/Math.PI});
  }
  function drag(p,dx,dy,width,height) {
    if(width<=0||height<=0) return pose(p);
    const t=Math.tan(p.fov*Math.PI/360), r=p.roll*Math.PI/180;
    const x=Math.atan(2*dx/width*t)*180/Math.PI;
    const y=Math.atan(2*dy/height*t/(16/9))*180/Math.PI;
    // Grab-and-drag; roll rotates the screen axes. Sensitivity follows FOV.
    return pose({...p,pan:p.pan-x*Math.cos(r)-y*Math.sin(r),tilt:p.tilt+y*Math.cos(r)-x*Math.sin(r)});
  }
  function zoom(p,delta) {
    return pose({...p,fov:Math.atan(Math.tan(p.fov*Math.PI/360)*Math.exp(clamp(delta,-240,240)*0.0015))*360/Math.PI});
  }
  const api={keys,clamp,wrap,pose,blend,drag,zoom};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PTZ=api;
})(globalThis);
