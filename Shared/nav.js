fetch("/study/Shared/nav.html")
  .then(r => r.text())
  .then(html => {
    document.body.insertAdjacentHTML("afterbegin", html);
  });
