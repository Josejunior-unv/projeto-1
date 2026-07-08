// Aplica o tema salvo ANTES do primeiro paint (evita flash de tema errado).
// Fica num arquivo próprio (e não inline no index.html) para permitir uma
// Content-Security-Policy sem 'unsafe-inline' em script-src.
(function () {
  try {
    var t = localStorage.getItem("tema");
    document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
