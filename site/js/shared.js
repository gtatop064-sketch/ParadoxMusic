// Shared helpers for the site's WebGL scenes (no dependencies).

export const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const weakDevice = (navigator.hardwareConcurrency || 8) <= 4 || innerWidth < 700;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Current loudness of the optional site soundtrack, 0..1 (see sound.js). */
export const level = () => window.pmLevel || 0;

/** Scroll progress of a tall sticky section: 0 when it reaches the top, 1 when its end leaves. */
export function stickyProgress(section) {
  const r = section.getBoundingClientRect();
  return clamp01(-r.top / Math.max(1, r.height - innerHeight));
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export const SCREENS = ["assets/screen-home.png", "assets/screen-customize.png", "assets/screen-audio.png"];

/** Value noise + fbm, shared by every shader. */
export const NOISE = `
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+17.;a*=.5;}return s;}
`;

/**
 * Burn chunk: a ragged hole that opens from a centre point as `bp` goes 0..1.
 * burnK() < 0 means burned; small positive values are the glowing, charred edge.
 */
export const BURN = `
uniform float bp;
uniform vec2 res;
uniform vec2 bc;
float burnK(){
  vec2 s=gl_FragCoord.xy/res;
  float asp=res.x/res.y;
  vec2 d=(s-bc)*vec2(asp,1.);
  float f=length(d)*.75+fbm(s*vec2(asp,1.)*3.2)*.5;
  return f-bp*1.3+.04;
}
vec3 burnEdge(vec3 col,float k){
  float charred=1.-smoothstep(0.,.13,k);
  float glow=1.-smoothstep(0.,.035,k);
  col=mix(col,vec3(.04,.012,.006),charred*.85);
  col+=glow*vec3(1.,.36,.1)*1.8+pow(glow,5.)*vec3(1.,.85,.6);
  return col;
}
`;

/** Minimal full-screen-quad WebGL1 program for scenes that do not need three.js. */
export function quadProgram(gl, fragment) {
  const vs = "attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}";
  const make = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, make(gl.FRAGMENT_SHADER, "precision highp float;varying vec2 v;" + fragment));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  gl.useProgram(p);
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(p, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = {};
  return {
    program: p,
    uniform(name) {
      return (u[name] ??= gl.getUniformLocation(p, name));
    },
    draw() {
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

/** Resize a canvas to its CSS box at a capped pixel ratio; returns true when it changed. */
export function fitCanvas(canvas, maxDpr) {
  const dpr = Math.min(devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

/** Runs `frame(t)` on rAF only while `el` is on screen and the tab is visible. */
export function loopWhileVisible(el, frame) {
  let on = false, raf = 0, start = performance.now();
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    frame((now - start) / 1000);
  };
  const set = (v) => {
    if (v === on) return;
    on = v;
    if (on) raf = requestAnimationFrame(tick);
    else cancelAnimationFrame(raf);
  };
  let inView = false;
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    set(inView && !document.hidden);
  }, { rootMargin: "100px 0px" }).observe(el);
  document.addEventListener("visibilitychange", () => set(inView && !document.hidden));
}
