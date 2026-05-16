export function initGifBackground(container, url) {
  const img = document.createElement("img");
  img.src = url;
  img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block";
  container.innerHTML = "";
  container.appendChild(img);
}
