// ParadoxMusic site: latest installer link, screenshot slider, reveal on scroll.
// Everything degrades gracefully: without JS the buttons point to the Releases page.
const REPO = "ParadoxStudioApp/ParadoxMusic";
document.documentElement.classList.add("js");

// 1. Latest Windows installer from GitHub Releases (pre-releases included, since the app is in beta).
(async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const releases = await res.json();
    for (const release of releases) {
      if (release.draft) continue;
      const asset = (release.assets || []).find((a) => /Setup\.exe$/i.test(a.name));
      if (!asset) continue;
      const version = String(release.tag_name || "").replace(/^v/, "");
      const size = Math.round(asset.size / 1048576);
      const date = new Date(release.published_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
      document.querySelectorAll("[data-download]").forEach((a) => {
        a.href = asset.browser_download_url;
        a.setAttribute("download", "");
      });
      document.querySelectorAll("[data-release-meta]").forEach((p) => {
        p.textContent = `Версия ${version} · ${size} МБ · ${date} · Windows 10 / 11 x64`;
      });
      return;
    }
  } catch {
    // Offline or rate-limited: keep the Releases page link.
  }
})();

// 2. Screenshot slider.
const slider = document.querySelector("[data-slider]");
if (slider) {
  const slides = [...slider.querySelectorAll(".slide")];
  const current = slider.querySelector("[data-current]");
  let index = 0;
  const show = (next) => {
    slides[index].classList.remove("is-active");
    index = (next + slides.length) % slides.length;
    slides[index].classList.add("is-active");
    current.textContent = String(index + 1).padStart(2, "0");
  };
  slider.querySelector("[data-prev]").addEventListener("click", () => show(index - 1));
  slider.querySelector("[data-next]").addEventListener("click", () => show(index + 1));
}

// 3. App clips: play only while on screen; with reduced motion keep the poster frame.
const clips = document.querySelectorAll("video[data-clip]");
const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
if ("IntersectionObserver" in window && !still) {
  const vio = new IntersectionObserver((entries) => entries.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { v.preload = "auto"; v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.25 });
  clips.forEach((v) => vio.observe(v));
}

// 4. Reveal sections once as they enter the viewport.
const items = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }),
    { rootMargin: "0px 0px -8% 0px" },
  );
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add("in"));
}

// Plus plans: payment is not connected yet, so every plan opens a placeholder.
(() => {
  const dialog = document.querySelector(".pay-dialog");
  if (!dialog) return;
  document.querySelectorAll("[data-plan]").forEach((button) => button.addEventListener("click", () => {
    dialog.querySelector("[data-pay-plan]").textContent = button.dataset.plan;
    dialog.showModal();
  }));
})();
