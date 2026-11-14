// First screen: red silk and a ribbon of ParadoxMusic screens flowing through a twisted
// figure-eight, pulsing with the optional soundtrack. Under the cursor (or a finger) the
// ribbon crumbles into sand that blows away and gathers back. Scrolling burns the whole
// scene away with a glowing edge and shows the next scene underneath.
import * as THREE from "three";
import {
  NOISE, BURN, SCREENS, loadImage, reduceMotion, weakDevice,
  stickyProgress, smooth, level, loopWhileVisible,
} from "./shared.js";

const section = document.querySelector(".hero");
const ready = () => window.dispatchEvent(new Event("pm:hero-ready"));

const CURVE = `
vec3 curve(float u){
  float s=sin(u),c=cos(u),d=1.+s*s;
  return vec3(2.5*c/d,1.45*s*c/d,.65*sin(2.*u+.6));
}
vec3 ribbonPoint(vec2 uv,float t,float beat,out vec3 tg,out vec3 w){
  float u=uv.x*6.2831853;
  vec3 p=curve(u);
  tg=normalize(curve(u+.004)-curve(u-.004));
  vec3 n=normalize(cross(tg,vec3(0.,0.,1.)));
  vec3 b=cross(n,tg);
  float tw=u*2.+t*.22;
  w=n*cos(tw)+b*sin(tw);
  return p+w*(uv.y-.5)*.44*(1.+beat*.22);
}
`;

const ATLAS_TILES = 6;

async function buildAtlas() {
  const imgs = await Promise.all(SCREENS.map(loadImage));
  const icon = await loadImage("assets/icon-256.png");
  const tw = 640, th = 400;
  const c = document.createElement("canvas");
  c.width = tw * ATLAS_TILES;
  c.height = th;
  const g = c.getContext("2d");
  const tile = (i, draw) => { g.save(); g.translate(i * tw, 0); draw(); g.restore(); };
  tile(0, () => g.drawImage(imgs[0], 0, 0, tw, th));
  tile(1, () => {
    const gr = g.createLinearGradient(0, 0, tw, th);
    gr.addColorStop(0, "#e3172b"); gr.addColorStop(1, "#5e0710");
    g.fillStyle = gr; g.fillRect(0, 0, tw, th);
    g.drawImage(icon, 48, 48, 96, 96);
    g.fillStyle = "#f3efe9";
    g.font = "600 76px 'Cormorant Garamond', serif";
    g.fillText("ParadoxMusic", 48, 300);
    g.font = "500 16px Unbounded, sans-serif";
    g.fillText("+ ПЛЕЕР ДЛЯ WINDOWS", 52, 350);
  });
  tile(2, () => g.drawImage(imgs[1], 0, 0, tw, th));
  tile(3, () => {
    g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, tw, th);
    g.fillStyle = "#f3efe9";
    for (let i = 0; i < 64; i++) {
      const h = 18 + Math.abs(Math.sin(i * 0.42) * 120 + Math.sin(i * 1.7) * 50);
      g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.3));
      g.fillRect(40 + i * 8.9, 210 - h / 2, 5, h);
    }
    g.globalAlpha = 1;
    g.font = "600 54px 'Cormorant Garamond', serif";
    g.fillText("Моё пространство", 40, 90);
    g.fillStyle = "#e3172b";
    g.font = "500 15px Unbounded, sans-serif";
    g.fillText("+ ЛАЙКИ · ДОСЛУШИВАНИЯ · ПРОПУСКИ", 42, 360);
  });
  tile(4, () => g.drawImage(imgs[2], 0, 0, tw, th));
  tile(5, () => {
    g.fillStyle = "#ecebe8"; g.fillRect(0, 0, tw, th);
    g.fillStyle = "#0d0d0d";
    g.font = "600 64px 'Cormorant Garamond', serif";
    ["Spotify", "SoundCloud", "YouTube"].forEach((s, i) => g.fillText(s, 44, 110 + i * 92));
    g.fillStyle = "#e3172b";
    ["01", "02", "03"].forEach((s, i) => { g.font = "500 15px Unbounded, sans-serif"; g.fillText(s, 560, 80 + i * 92); });
  });
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

async function start() {
  const stick = section.querySelector(".hero-stick");
  const copy = section.querySelector(".hero-copy");
  const under = section.querySelector(".hero-under");
  const renderer = new THREE.WebGLRenderer({ antialias: !weakDevice, alpha: true, premultipliedAlpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, weakDevice ? 1.25 : 2));
  renderer.domElement.className = "hero-gl";
  renderer.setClearColor(0x000000, 0);
  stick.prepend(renderer.domElement);
  D.classList.add("fx-hero");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.z = 6;
  const res = new THREE.Vector2();
  const shared = {
    t: { value: 0 }, beat: { value: 0 }, bp: { value: 0 }, res: { value: res },
    bc: { value: new THREE.Vector2(0.5, 0.55) },
  };

  // Red silk background.
  const silk = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: shared,
      depthTest: false,
      depthWrite: false,
      vertexShader: "varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,.999,1.);}",
      fragmentShader: NOISE + BURN + `
        uniform float t,beat;varying vec2 v;
        void main(){
          float k=burnK(); if(k<0.) discard;
          vec2 q=(v-.5)*vec2(res.x/res.y,1.)*2.;
          float f=fbm(q*1.1+vec2(t*.025,t*.018));
          float folds=sin(q.x*2.6+f*4.2+t*.12)*.6+sin(q.y*4.2-f*3.+t*.09)*.4;
          float sh=pow(.5+.5*folds,1.7);
          vec3 c=mix(vec3(.07,.0,.006),vec3(.52,.025,.06),sh);
          c=mix(c,vec3(.98,.2,.24),pow(sh,7.)*.55);
          c*=1.-.5*length(v-vec2(.5,.55));
          c*=1.+beat*.12;
          gl_FragColor=vec4(burnEdge(c,k),1.);
        }`,
    }),
  );
  silk.frustumCulled = false;
  silk.renderOrder = -1;
  scene.add(silk);

  const atlas = await buildAtlas();
  const group = new THREE.Group();
  scene.add(group);
  const ptr = { value: new THREE.Vector3(99, 99, 0) }, ptrS = { value: 0 };
  // Ribbon length decides how many times the atlas repeats, so tiles keep their aspect.
  let len = 0;
  const cv = (u) => { const s = Math.sin(u), c = Math.cos(u), d = 1 + s * s; return [2.5 * c / d, 1.45 * s * c / d, 0.65 * Math.sin(2 * u + 0.6)]; };
  for (let i = 0, a = cv(0); i < 400; i++) { const b = cv(((i + 1) / 400) * Math.PI * 2); len += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); a = b; }
  const rep = Math.max(1, Math.round(len / (0.44 * 1.6) / ATLAS_TILES));
  const ribbonUniforms = { ...shared, map: { value: atlas }, rep: { value: rep }, ptr, ptrS };

  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1, weakDevice ? 360 : 720, 1),
    new THREE.ShaderMaterial({
      uniforms: ribbonUniforms,
      side: THREE.DoubleSide,
      vertexShader: CURVE + `
        uniform float t,beat,rep;uniform vec3 ptr;
        varying vec2 vUv,vRaw;varying float vD,vShade;
        void main(){
          vec3 tg,w;vec3 p=ribbonPoint(uv,t,beat,tg,w);
          vec3 nrm=normalize(cross(tg,w));
          vShade=.45+.55*abs(dot(nrm,normalize(vec3(.3,.6,1.))));
          vUv=vec2(uv.x*rep*${ATLAS_TILES}.0/${ATLAS_TILES}.0+t*.012,uv.y);
          vRaw=uv;vD=distance(p.xy,ptr.xy);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader: NOISE + BURN + `
        uniform sampler2D map;uniform float ptrS;
        varying vec2 vUv,vRaw;varying float vD,vShade;
        void main(){
          float k=burnK(); if(k<0.) discard;
          float rr=.62*ptrS*(.65+.7*vn(vRaw*vec2(420.,9.)));
          float s=vD-rr; if(s<0.) discard;
          vec3 c=texture2D(map,vec2(fract(vUv.x),1.-vUv.y)).rgb*vShade;
          if(!gl_FrontFacing) c*=.55;
          c+=(1.-smoothstep(0.,.05,s))*step(.02,ptrS)*vec3(1.,.55,.35)*.9;
          gl_FragColor=vec4(burnEdge(c,k),1.);
        }`,
    }),
  );
  ribbon.frustumCulled = false;
  group.add(ribbon);

  // Sand: points spread over the ribbon, visible only where the pointer crumbled it.
  const N = weakDevice ? 14000 : 42000;
  const pos = new Float32Array(N * 3), rnd = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = Math.random(); pos[i * 3 + 1] = Math.random();
    rnd[i * 3] = Math.random(); rnd[i * 3 + 1] = Math.random(); rnd[i * 3 + 2] = Math.random();
  }
  const sandGeo = new THREE.BufferGeometry();
  sandGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  sandGeo.setAttribute("rnd", new THREE.BufferAttribute(rnd, 3));
  const sand = new THREE.Points(sandGeo, new THREE.ShaderMaterial({
    uniforms: { ...ribbonUniforms, dpr: { value: renderer.getPixelRatio() } },
    transparent: true,
    depthWrite: false,
    vertexShader: NOISE + CURVE + `
      uniform float t,beat,ptrS,rep,dpr;uniform vec3 ptr;attribute vec3 rnd;
      varying vec2 vUv;varying float vA;
      void main(){
        vec2 uv=position.xy;vec3 tg,w;vec3 p=ribbonPoint(uv,t,beat,tg,w);
        float rr=.62*ptrS*(.65+.7*vn(uv*vec2(420.,9.)));
        float d=distance(p.xy,ptr.xy);
        if(d>rr||ptrS<.02){gl_Position=vec4(2.,2.,2.,1.);gl_PointSize=0.;return;}
        float a=1.-d/rr;
        vec2 dir=normalize(p.xy-ptr.xy+(rnd.xy-.5)*.4);
        p.xy+=dir*a*(.25+.5*rnd.z)+vec2(.55,.3)*a*a*(.4+rnd.x)*ptrS;
        p.z+=(rnd.y-.5)*a*.8;
        vUv=vec2(uv.x*rep+t*.012,uv.y);vA=.35+.65*(1.-a);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        gl_PointSize=(1.4+rnd.z*1.6)*dpr;
      }`,
    fragmentShader: NOISE + BURN + `
      uniform sampler2D map;varying vec2 vUv;varying float vA;
      void main(){
        float k=burnK(); if(k<0.) discard;
        vec3 c=texture2D(map,vec2(fract(vUv.x),1.-vUv.y)).rgb;
        c=mix(c,vec3(1.,.82,.7),.35);
        gl_FragColor=vec4(burnEdge(c,k),vA);
      }`,
  }));
  sand.frustumCulled = false;
  group.add(sand);

  // Pointer → ribbon-local plane z=0. The crumble fades back when the pointer rests.
  const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3(), target = new THREE.Vector3(99, 99, 0);
  let lastMove = -1e9;
  const onPointer = (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) { target.copy(group.worldToLocal(hit.clone())); lastMove = performance.now(); }
  };
  stick.addEventListener("pointermove", onPointer, { passive: true });
  stick.addEventListener("pointerdown", onPointer, { passive: true });

  let w = 0, h = 0;
  const layout = () => {
    const cw = stick.clientWidth, ch = stick.clientHeight;
    if (cw === w && ch === h) return;
    w = cw; h = ch;
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(res);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const portrait = w / h < 0.9;
    group.rotation.z = portrait ? Math.PI / 2 : -0.08;
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z, halfW = halfH * camera.aspect;
    group.scale.setScalar(portrait ? Math.min(halfH * 1.05 / 2.5, halfW / 1.5) : Math.min(1, (halfW * 0.62) / 2.5));
    group.position.set(portrait ? 0 : halfW * 0.33, portrait ? halfH * 0.22 : 0.05, 0);
  };

  ready();
  loopWhileVisible(section, (t) => {
    layout();
    const pr = stickyProgress(section);
    const beat = level();
    shared.t.value = t;
    shared.beat.value += (beat - shared.beat.value) * 0.25;
    shared.bp.value = smooth(0.12, 0.85, pr) * 1.02;
    const active = performance.now() - lastMove < 650;
    ptrS.value += ((active ? 1 : 0) - ptrS.value) * (active ? 0.12 : 0.025);
    ptr.value.lerp(target, 0.25);
    group.rotation.y = Math.sin(t * 0.2) * 0.12;
    copy.style.opacity = String(1 - smooth(0.02, 0.3, pr));
    copy.style.transform = `translateY(${-pr * 80}px)`;
    under.style.opacity = String(smooth(0.35, 0.8, pr));
    renderer.render(scene, camera);
  });
}

const D = document.documentElement;
if (!section || reduceMotion) ready();
else start().catch((e) => { console.warn("hero scene disabled:", e); D.classList.remove("fx-hero"); ready(); });
