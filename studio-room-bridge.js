// Explicit connection between the lazy room and the project workbench.
// The room retains its own camera but never renders behind an active project.
export const roomBridge = {
  managed: false,
  active: false,
  controller: null,
  onSelect: null,
  onResume: null,
  onStatus: null,
  onFrame: null,
  onLighting: null,
  configure(callbacks = {}) {
    this.managed = true;
    for (const name of ['onSelect', 'onResume', 'onStatus', 'onFrame', 'onLighting']) {
      this[name] = typeof callbacks[name] === 'function' ? callbacks[name] : null;
    }
  },
  attach(controller) {
    this.controller = controller;
    controller.setActive(this.active);
  },
  setActive(active) {
    this.active = Boolean(active);
    this.controller?.setActive(this.active);
  },
  status(state, message = '') { this.onStatus?.({state, message}); },
};
