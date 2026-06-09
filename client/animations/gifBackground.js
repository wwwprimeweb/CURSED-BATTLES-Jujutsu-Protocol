const GIF_PENDING = {};
const DURATION_DEFAULT = 5000;
const FADE_MS = 400;

function parseGifDuration(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  if (magic !== "GIF") return DURATION_DEFAULT;
  let total = 0;
  for (let i = 0; i < bytes.length - 3; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9 && bytes[i + 2] === 0x04) {
      const delay = (bytes[i + 5] << 8 | bytes[i + 4]) * 10;
      if (delay > 0) total += delay;
    }
  }
  return total > 0 ? total : DURATION_DEFAULT;
}

export function initGifBackground(container, url) {
  const img = document.createElement("img");
  img.src = url;
  img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
  container.innerHTML = "";
  container.appendChild(img);
}

export async function initCyclingBackground(container, urls) {
  const durations = await Promise.all(urls.map(async (url) => {
    const cached = GIF_PENDING[url];
    if (cached) return cached;
    try {
      const resp = await fetch(url);
      const buf = await resp.arrayBuffer();
      const dur = parseGifDuration(buf);
      GIF_PENDING[url] = dur;
      return dur;
    } catch {
      return DURATION_DEFAULT;
    }
  }));

  container.innerHTML = "";

  const img = document.createElement("img");
  img.style.cssText =
    "width:100%;height:100%;object-fit:cover;display:block;" +
    "position:absolute;inset:0;transition:opacity " + FADE_MS + "ms ease";
  container.appendChild(img);

  let index = 0;
  let timer = null;
  let fading = false;

  function show(i) {
    img.style.opacity = "0";
    img.src = urls[i];
    index = i;
    fading = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        img.style.opacity = "1";
      });
    });
    scheduleNext(i);
  }

  function scheduleNext(i) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (fading) return;
      fading = true;
      img.style.opacity = "0";
      const next = (i + 1) % urls.length;
      setTimeout(() => show(next), FADE_MS);
    }, durations[i] - FADE_MS);
  }

  img.style.opacity = "0";
  img.src = urls[0];
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      img.style.opacity = "1";
    });
  });
  scheduleNext(0);
}
