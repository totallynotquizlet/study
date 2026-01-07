fetch("/study/Shared/nav.html")
  .then(r => r.text())
  .then(html => {
    const nav = document.querySelector("nav");
    if (!nav) return;
    nav.innerHTML = html;
  });
