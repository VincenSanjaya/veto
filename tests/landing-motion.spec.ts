import { expect, test } from "@playwright/test";

test("scroll layers reverse smoothly, reveals run once with 80ms stagger, and fallback stops offscreen or in a hidden tab", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(`sessionStorage.setItem('veto-entered', 'true');
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return original.call(this, type, ...args);
    };`);
  await page.goto("/");
  const hero = page.locator(".landing-hero");
  const progress = () =>
    hero.evaluate((node) =>
      Number(
        getComputedStyle(node).getPropertyValue("--glass-scroll-progress"),
      ),
    );
  await expect.poll(progress).toBe(0);
  await page.evaluate(() => scrollTo(0, 500));
  await expect.poll(progress).toBeGreaterThan(0.3);
  const expectedProgress = await hero.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return Math.max(0, Math.min(1, -rect.top / rect.height));
  });
  await expect.poll(progress).toBeCloseTo(expectedProgress, 3);
  const offsets = await hero.evaluate((node) => {
    const css = getComputedStyle(node);
    return {
      glass: parseFloat(css.getPropertyValue("--glass-scroll-x")),
      text: Math.abs(parseFloat(css.getPropertyValue("--hero-text-y"))),
    };
  });
  expect(offsets.glass).toBeGreaterThan(offsets.text * 4);
  expect(
    await page
      .locator(".glass-left")
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("glassFloatLeft");
  await page.evaluate(() => scrollTo(0, 0));
  await expect.poll(progress).toBeLessThan(0.01);
  const how = page.locator("#how-it-works");
  await how.scrollIntoViewIfNeeded();
  await expect(how.locator("h2")).toHaveClass(/is-revealed/);
  await expect(how.locator("article.is-revealed")).toHaveCount(3);
  expect(
    await how
      .locator("article")
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          (node as HTMLElement).style.getPropertyValue("--reveal-delay"),
        ),
      ),
  ).toEqual(["0ms", "80ms", "160ms"]);
  await expect(hero).toHaveAttribute("data-motion-paused", "true");
  expect(
    await page
      .locator(".glass-left")
      .evaluate((node) => getComputedStyle(node).animationPlayState),
  ).toBe("paused");
  await page.evaluate(() => scrollTo(0, 0));
  await expect(hero).toHaveAttribute("data-motion-paused", "false");
  await expect(how.locator("h2")).toHaveClass(/is-revealed/);
  await expect.poll(progress).toBeLessThan(0.01);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(hero).toHaveAttribute("data-motion-paused", "true");
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(hero).toHaveAttribute("data-motion-paused", "false");
});

test("enlarged glass stays cropped and readable on mobile; reduced motion removes scroll and reveal animation", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".liquid-scene")).toBeVisible();
  await page
    .locator(".landing-hero")
    .screenshot({ path: testInfo.outputPath("glass-mobile.png") });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page
    .locator(".landing-hero")
    .screenshot({ path: testInfo.outputPath("glass-desktop-static.png") });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.evaluate(() => scrollTo(0, 300));
  expect(
    await page
      .locator(".landing-hero")
      .evaluate((node) =>
        getComputedStyle(node).getPropertyValue("--glass-scroll-progress"),
      ),
  ).toBe("0.0000");
  expect(
    await page
      .locator(".hero-content")
      .evaluate((node) => getComputedStyle(node).translate),
  ).toBe("none");
  const title = page.locator("#how-it-works h2");
  await title.scrollIntoViewIfNeeded();
  expect(await title.evaluate((node) => getComputedStyle(node).opacity)).toBe(
    "1",
  );
  expect(await title.evaluate((node) => getComputedStyle(node).transform)).toBe(
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("#how-it-works h2")).toHaveClass(/is-revealed/);
  await page.evaluate(() => scrollTo(0, 0));
  await page
    .locator(".landing-hero")
    .getByRole("link", { name: "Try demo", exact: true })
    .click();
  await expect(
    page.getByText("Demo mode · Sample data", { exact: true }),
  ).toBeVisible();
});

test("glass wrapper and drawing buffer reach the viewport edges across content padding, max-width and resize", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  for (const width of [1920, 1440, 900, 390, 320]) {
    await page.setViewportSize({ width, height: width > 700 ? 1050 : 844 });
    const dimensions = () =>
      page.locator(".liquid-scene").evaluate((scene) => {
        const rect = scene.getBoundingClientRect();
        const canvas = scene.querySelector("canvas")!;
        const canvasRect = canvas.getBoundingClientRect();
        const ratio = Math.min(
          devicePixelRatio || 1,
          matchMedia("(max-width: 700px)").matches ? 0.85 : 1.25,
        );
        return {
          left: Math.abs(rect.left),
          right: Math.abs(rect.right - document.documentElement.clientWidth),
          cssWidth: Math.abs(rect.width - document.documentElement.clientWidth),
          canvasLeft: Math.abs(canvasRect.left),
          canvasWidth: Math.abs(canvasRect.width - rect.width),
          bufferWidth: scene.classList.contains("glass-webgl")
            ? Math.abs(canvas.width - Math.round(rect.width * ratio))
            : 0,
          bufferHeight: scene.classList.contains("glass-webgl")
            ? Math.abs(canvas.height - Math.round(rect.height * ratio))
            : 0,
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          pointer: getComputedStyle(scene).pointerEvents,
        };
      });
    await expect
      .poll(async () => {
        const d = await dimensions();
        return Math.max(
          d.left,
          d.right,
          d.cssWidth,
          d.canvasLeft,
          d.canvasWidth,
          d.bufferWidth,
          d.bufferHeight,
          d.overflow,
        );
      })
      .toBeLessThan(0.5);
    expect((await dimensions()).pointer).toBe("none");
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: testInfo.outputPath(`glass-viewport-${width}.png`),
      });
  }
  await page
    .locator(".landing-hero")
    .getByRole("link", { name: "Try demo", exact: true })
    .click();
  await expect(
    page.getByText("Demo mode · Sample data", { exact: true }),
  ).toBeVisible();
});
