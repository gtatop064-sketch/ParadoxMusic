// Loader: counts real loading progress on a spinning record, then a tilted wall of
// ParadoxMusic screens burns away from the middle with a glowing edge.
// Full version once per tab session, a short burn on later visits.
import { NOISE, BURN, SCREENS, loadImage, quadProgram, smooth } from "./shared.js";

const D = document.documentElement;
const root = document.getElementById("intro");
const full = D.classList.contains("intro");
const short = D.classList.contains("intro-short");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function finish() {
  D.classList.add("intro-done");
  try { sessionStorage.setItem("pm-intro", "1"); } catch {}
  window.dispatchEvent(new Event("pm:intro-done"));
}

async function progress(images) {
  const num = document.getElementById("ldN");
  const tasks = [
    document.fonts?.ready ?? Promise.resolve(),
    ...images,
    new Promise((r) => {
      window.addEventListener("pm:hero-ready", r, { once: true });
      setTimeout(r, 6000);
    }),
  ];
  let done = 0, shown = 0;
  tasks.forEach((p) => p.then(() => done++, () => done++));
  const started = performance.now();
  while (shown < 100) {
    const target = (done / tasks.length) * 100;
    const minTime = Math.min(100, ((performance.now() - started) / 1600) * 100); // never faster than 1.6 s
    shown = Math.min(100, shown + Math.max(0.6, (Math.min(target, minTime) - shown) * 0.12));
    num.textContent = String(Math.floor(shown));
    await new Promise(requestAnimationFrame);
  }
  await wait(250);
}

function paintWall(canvas, images) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#070707";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-0.2);
  const tw = Math.max(260, w / 4.2), th = tw / 1.6, gap = tw * 0.06;
  const span = Math.hypot(w, h);
  let i = 0;
  for (let y = -span / 2, row = 0; y < span / 2; y += th + gap, row++)
    for (let x = -span / 2 - (row % 2) * tw * 0.5; x < span / 2; x += tw + gap) {
      const img = images[i++ % images.length];
      if (img) ctx.drawImage(img, x, y, tw, th);
    }
  ctx.restore();
  ctx.fillStyle = "rgba(7,7,7,.28)";
  ctx.fillRect(0, 0, w, h);
}

async function burn(images, duration) {
  const canvas = root.querySelector(".intro-gl");
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  const wall = document.createElement("canvas");
  wall.width = canvas.width;
  wall.height = canvas.height;
  paintWall(wall, images);
  const gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true });
  if (!gl) throw new Error("no webgl");
  const q = quadProgram(gl, NOISE + BURN + `
    uniform sampler2D tex;
    void main(){
      float k=burnK();
      if(k<0.){gl_FragColor=vec4(0.);return;}
      vec3 c=texture2D(tex,v).rgb;
      gl_FragColor=vec4(burnEdge(c,k),1.);
    }`);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wall);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(q.uniform("res"), canvas.width, canvas.height);
  gl.uniform2f(q.uniform("bc"), 0.5, 0.5);
  root.classList.add("burning");
  const start = performance.now();
  for (;;) {
    const p = (performance.now() - start) / duration;
    gl.uniform1f(q.uniform("bp"), smooth(0, 1, p) * 1.05);
    q.draw();
    if (p >= 1) break;
    await new Promise(requestAnimationFrame);
  }
  gl.getExtension("WEBGL_lose_context")?.loseContext();
}

if (root && (full || short)) {
  const images = SCREENS.map(loadImage);
  (async () => {
    try {
      if (full) {
        await progress(images);
        root.classList.add("counted");
        await wait(350);
      }
      const loaded = (await Promise.allSettled(images)).map((r) => (r.status === "fulfilled" ? r.value : null));
      await burn(loaded.filter(Boolean), full ? 1700 : 900);
    } catch {
      root.classList.add("fade");
      await wait(400);
    }
    finish();
  })();
}
