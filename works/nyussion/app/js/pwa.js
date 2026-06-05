if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // PWA registration is optional; the app still works as a normal page.
    });
  });
}
