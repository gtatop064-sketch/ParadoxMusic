// Between sections: a sheet lies over the join and burns away as you scroll,
// with a glowing crumbling edge, a charred margin and sparks. One small canvas per join.
import { NOISE, quadProgram, fitCanvas, reduceMotion, clamp01, loopWhileVisible } from "./shared.js";

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);

for (const el of document.querySelectorAll(".burn")) {
  if (reduceMotion) break;
  const canvas = document.createElement("canvas");
  el.append(canvas);
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false });
  if (!gl) break;
  let q;
  try {
    q = quadProgram(gl, NOISE + `
      uniform float p,t,asp;uniform vec3 col;
      void main(){
        vec2 s=v*vec2(asp,1.);
        float f=fbm(s*2.6+3.)*.55+(1.-v.y)*.55+fbm(s*9.)*.08;
        float k=f-p*1.35+.12;
        if(k<0.){
          float spark=step(.992,h21(floor(gl_FragCoord.xy/2.)+floor(t*14.)))*(1.-smoothstep(0.,.18,-k));
          gl_FragColor=vec4(vec3(1.,.55,.2)*spark,spark);return;
        }
        vec3 c=col*(.92+.16*fbm(s*14.));
        float charred=1.-smoothstep(0.,.09,k),glow=1.-smoothstep(0.,.025,k);
        c=mix(c,vec3(.05,.015,.008),charred*.9);
        c+=glow*vec3(1.,.38,.1)*1.7+pow(glow,5.)*vec3(1.,.85,.6);
        gl_FragColor=vec4(c,1.);
      }`);
  } catch { break; }
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.uniform3fv(q.uniform("col"), hex(el.dataset.color || "#070707"));
  el.classList.add("on");
  loopWhileVisible(el, (t) => {
    if (fitCanvas(canvas, 1.5)) gl.viewport(0, 0, canvas.width, canvas.height);
    const r = el.getBoundingClientRect();
    const p = clamp01((innerHeight * 0.92 - r.top) / (innerHeight * 0.62));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(q.uniform("p"), p);
    gl.uniform1f(q.uniform("t"), t);
    gl.uniform1f(q.uniform("asp"), canvas.width / canvas.height);
    q.draw();
  });
}
