import { expect, test } from "@playwright/test";
import { injectWallet } from "./fixtures/wallet";

test("landing is wallet-free, has honest scope and keyboard FAQ, and Try demo opens the isolated dashboard", async ({
  page,
}) => {
  await injectWallet(page, true);
  const rpc: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("sepolia.base.org")) rpc.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your wallet. Your permissions.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Landing navigation" }),
  ).toBeVisible();
  await expect(page.locator(".landing-scope")).toContainText(
    "Base Sepolia only",
  );
  await expect(page.locator(".landing-scope")).toContainText(
    "not your entire wallet",
  );
  await expect(page.locator(".preview-demo")).toHaveText("Demo · Sample data");
  await expect(page.locator(".landing-preview")).toContainText(
    "Synthetic spender",
  );
  const question = page
    .locator("summary")
    .filter({ hasText: "Do I need to pay gas?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(question.locator("..")).toHaveAttribute("open", "");
  await expect(question.locator("..")).toContainText(
    "two separate transactions",
  );
  await expect
    .poll(() => page.evaluate("walletFixture.state.calls"))
    .toEqual([]);
  expect(rpc).toEqual([]);
  await page
    .locator(".landing-hero")
    .getByRole("link", { name: "Try demo", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app\?mode=demo$/);
  await expect(
    page.getByText("Demo mode · Sample data", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate("walletFixture.state.calls")).toEqual([]);
  await page.reload();
  await expect(
    page.getByText("Demo mode · Sample data", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Veto", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: "Your wallet. Your permissions.",
      exact: true,
    }),
  ).toBeVisible();
});

test("single session entrance is skippable and never blocks Launch app or direct /app refresh", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Skip animation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Launch app", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByText("Demo mode · Sample data", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".entrance, [inert]")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Veto", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Skip animation", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".landing")).toHaveClass(/landing-settled/);
  await page.evaluate(() => sessionStorage.removeItem("veto-entered"));
  await page.reload();
  await page
    .getByRole("button", { name: "Skip animation", exact: true })
    .click();
  await expect(page.locator(".landing")).toHaveClass(/landing-settled/);
});

test("glass entrance settles in under three seconds; WebGL or decorative fallback remains behind usable content", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto("/");
  await expect(page.locator(".landing")).toHaveClass(/landing-settled/, {
    timeout: 4500,
  });
  await expect(page.locator(".liquid-scene")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  expect(
    await page
      .locator(".liquid-scene")
      .evaluate((node) => getComputedStyle(node).pointerEvents),
  ).toBe("none");
  await expect(page.locator(".hero-content h1")).toBeVisible();
  await page
    .locator(".landing-hero")
    .screenshot({ path: testInfo.outputPath("glass-desktop.png") });
  await page.screenshot({
    path: testInfo.outputPath("landing-desktop.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  if (await page.locator(".glass-webgl").count()) {
    await page
      .locator("canvas")
      .evaluate((node) =>
        node.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
      );
    await expect(page.locator(".glass-fallback")).toHaveCount(1);
  }
});

test("no-WebGL fallback, reduced motion, narrow mobile layout and keyboard navigation stay usable", async ({
  page,
}, testInfo) => {
  await page.addInitScript(`const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return original.call(this, type, ...args);
    };`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".glass-fallback")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Skip animation", exact: true }),
  ).toHaveCount(0);
  expect(
    await page
      .locator(".glass-left")
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("link", { name: "How it works", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#how-it-works$/);
  await page.screenshot({
    path: testInfo.outputPath("landing-mobile-fallback.png"),
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  }
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Launch app", exact: true })
    .click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(
    page.getByText("Demo mode · Sample data", { exact: true }),
  ).toBeVisible();
});
