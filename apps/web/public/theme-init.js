;(function () {
  try {
    var stored = localStorage.getItem("glichess-theme")
    var dark =
      stored === "dark" ||
      ((stored === null || stored === "system") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList.toggle("dark", dark)
  } catch (_) {}
})()
