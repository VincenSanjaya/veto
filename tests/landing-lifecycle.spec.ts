import { expect, test } from "@playwright/test";

test("landing unmount releases animation frames, observers, GPU resources and owned listeners", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/app");
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  await page.evaluate(`(() => {
    const frames = new Set(), observers = new Set(), resources = new Set(), listeners = [];
    const request = window.requestAnimationFrame, cancel = window.cancelAnimationFrame;
    window.requestAnimationFrame = fn => { const id = request(time => { frames.delete(id); fn(time); }); frames.add(id); return id; };
    window.cancelAnimationFrame = id => { frames.delete(id); cancel(id); };
    for (const name of ['ResizeObserver', 'IntersectionObserver']) {
      const Original = window[name];
      window[name] = class extends Original {
        observe(...args) { observers.add(this); return super.observe(...args); }
        disconnect() { observers.delete(this); return super.disconnect(); }
      };
    }
    const owned = (target, type) =>
      ((target === window || target === document) && ['scroll', 'resize', 'visibilitychange'].includes(type)) ||
      (target instanceof HTMLCanvasElement && type === 'webglcontextlost') ||
      (target instanceof HTMLElement && target.matches('.landing-hero') && ['pointermove', 'pointerleave'].includes(type)) ||
      (target instanceof MediaQueryList && type === 'change');
    const add = EventTarget.prototype.addEventListener, remove = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function(type, fn, options) {
      if (owned(this, type) && !listeners.some(x => x.target === this && x.type === type && x.fn === fn)) listeners.push({target:this, type, fn});
      return add.call(this, type, fn, options);
    };
    EventTarget.prototype.removeEventListener = function(type, fn, options) {
      const index = listeners.findIndex(x => x.target === this && x.type === type && x.fn === fn);
      if (index >= 0) listeners.splice(index, 1);
      return remove.call(this, type, fn, options);
    };
    for (const kind of ['Program', 'Shader', 'Buffer']) {
      const proto = WebGLRenderingContext.prototype, create = proto['create'+kind], destroy = proto['delete'+kind];
      proto['create'+kind] = function(...args) { const value = create.apply(this,args); if(value) resources.add(value); return value; };
      proto['delete'+kind] = function(value) { resources.delete(value); return destroy.call(this,value); };
    }
    window.lifecycleCounts = () => ({frames:frames.size, observers:observers.size, resources:resources.size, listeners:listeners.length});
  })()`);
  await page.evaluate(`(async () => {
    const path = '/tests/fixtures/landingLifecycle.tsx';
    window.unmountLanding = (await import(path)).mountProbe();
  })()`);
  await expect(page.locator(".liquid-scene")).toBeVisible();
  await expect
    .poll(() => page.evaluate("lifecycleCounts().observers"))
    .toBeGreaterThan(0);
  await page.evaluate("unmountLanding()");
  await expect(page.locator(".landing, .glass-canvas")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate("lifecycleCounts()"))
    .toEqual({ frames: 0, observers: 0, resources: 0, listeners: 0 });
});
