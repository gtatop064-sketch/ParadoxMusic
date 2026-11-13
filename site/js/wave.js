// Between the features and the screens: grey smoke and a sound wave made of white flame.
// Scroll brings it in from the corner, it grows and swings with the soundtrack, then bursts
// into light that turns into the paper-coloured screens section.
import * as THREE from "three";
import { NOISE, reduceMotion, weakDevice, stickyProgress, smooth, level, loopWhileVisible } from "./shared.js";

const section = document.querySelector(".surge");

function start() {
  const stick = section.querySelector(".surge-stick");
  const text = section.querySelector(".surge-text");
  const flash = section.querySelector(".surge-flash");
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, weakDevice ? 1 : 1.5));
  renderer.setClearColor(0x070707, 1);
  renderer.domElement.className = "surge-gl";
  stick.prepend(renderer.domElement);
  document.documentElement.classList.add("fx-surge");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40);
  camera.position.z = 5;
  const u = {
    t: { value: 0 }, grow: { value: 0 }, amp: { value: 0.2 }, burst: { value: 0 },
    lvl: { value: 0 }, res: { value: new THREE.Vector2() }, dpr: { value: renderer.getPixelRatio() },
  };

  const smoke = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: u, depthTest: false, depthWrite: false,
    vertexShader: "varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,.999,1.);}",
    fragmentShader: NOISE + `
      uniform float t,burst;uniform vec2 res;varying vec2 v;
      void main(){
        vec2 q=v*vec2(res.x/res.y,1.)*2.2;
        float s=fbm(q+vec2(t*.04,-t*.03)+fbm(q*1.6-t*.02));
        vec3 c=mix(vec3(.027),vec3(.17,.155,.15),smoothstep(.35,.95,s));
        c+=vec3(.25,.02,.03)*smoothstep(.55,0.,v.y)*.35;
        c=mix(c,vec3(.93,.92,.9),burst*.35);
        gl_FragColor=vec4(c,1.);
      }`,
  }));
  smoke.frustumCulled = false;
  smoke.renderOrder = -1;
  scene.add(smoke);

  const N = weakDevice ? 18000 : 60000;
  const a = new Float32Array(N * 3), r = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    a[i * 3] = Math.random() * 2 - 1;
    r[i * 3] = Math.random(); r[i * 3 + 1] = Math.random(); r[i * 3 + 2] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(a, 3));
  geo.setAttribute("rnd", new THREE.BufferAttribute(r, 3));
  const flame = new THREE.Points(geo, new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float t,grow,amp,burst,lvl,dpr;attribute vec3 rnd;
      varying float vA,vCore;
      void main(){
        float x=position.x;
        float env=pow(1.-abs(x),1.4);
        float wav=sin(x*9.+t*1.7)*.5+sin(x*23.-t*2.6)*.22+sin(x*4.-t*.8)*.38;
        float y=wav*env*amp*(1.+lvl*1.6);
        float fill=rnd.x*2.-1.;
        float life=fract(t*(.22+rnd.y*.45)+rnd.z);
        vec3 p=vec3(x*2.1,y*fill+life*.22*env,(rnd.z-.5)*.35);
        p=p*mix(.18,1.,grow)+vec3(mix(2.3,0.,grow),mix(-1.5,0.,grow),0.);
        vec3 dir=normalize(vec3(rnd.x-.5,rnd.y-.5,rnd.z-.5)+1e-4);
        p+=dir*burst*burst*(3.+rnd.y*4.);
        vCore=1.-abs(fill);
        vA=(1.-life)*(.25+.75*env)*(.35+.65*grow);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        gl_PointSize=(1.2+rnd.y*1.8)*dpr*(1.+burst*2.5);
      }`,
    fragmentShader: `
      uniform float burst;varying float vA,vCore;
      void main(){
        float d=length(gl_PointCoord-.5);if(d>.5)discard;
        float soft=1.-d*2.;
        vec3 c=mix(vec3(1.,.22,.18),vec3(1.,.96,.9),clamp(vCore*1.4+burst,0.,1.));
        gl_FragColor=vec4(c*soft*vA*(1.+burst*3.),1.);
      }`,
  }));
  flame.frustumCulled = false;
  scene.add(flame);

  let w = 0, h = 0;
  loopWhileVisible(section, (t) => {
    const cw = stick.clientWidth, ch = stick.clientHeight;
    if (cw !== w || ch !== h) {
      w = cw; h = ch;
      renderer.setSize(w, h, false);
      renderer.getDrawingBufferSize(u.res.value);
      camera.aspect = w / h;
      camera.position.z = w / h < 0.9 ? 9 : 5;
      camera.updateProjectionMatrix();
    }
    const pr = stickyProgress(section);
    u.t.value = t;
    u.lvl.value += (level() - u.lvl.value) * 0.2;
    u.grow.value = smooth(0, 0.42, pr);
    u.amp.value = 0.12 + 0.5 * smooth(0.18, 0.55, pr);
    u.burst.value = smooth(0.66, 0.96, pr);
    text.style.opacity = String(smooth(0.2, 0.38, pr) * (1 - smooth(0.6, 0.72, pr)));
    text.style.transform = `translateY(${(1 - smooth(0.2, 0.45, pr)) * 30}px)`;
    flash.style.opacity = String(smooth(0.8, 0.985, pr));
    renderer.render(scene, camera);
  });
}

if (section && !reduceMotion) {
  try { start(); } catch (e) { console.warn("wave scene disabled:", e); document.documentElement.classList.remove("fx-surge"); }
}
