// Own exactly one pending frame, including when asynchronous initialization
// finishes in a hidden tab. Visibility changes never spawn a second chain.
export function createFrameLoop(render, {
  request = callback => requestAnimationFrame(callback),
  cancel = id => cancelAnimationFrame(id),
  hidden = () => document.hidden,
} = {}) {
  let pending = null, disposed = false;
  function start() {
    if (!disposed && !hidden() && pending === null) pending = request(tick);
  }
  function stop() {
    if (pending !== null) cancel(pending);
    pending = null;
  }
  function tick(now) {
    pending = null;
    if (disposed || hidden()) return;
    render(now);
    start();
  }
  return { start, stop, dispose() { disposed = true; stop(); } };
}
