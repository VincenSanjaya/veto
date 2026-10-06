import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { injectWallet } from "./fixtures/wallet";

async function fixture(page: Page, script: string) {
  return page.evaluate(script);
}

test("missing-wallet state and demo interactions remain functional", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.getByRole("button", { name: "Unlimited", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Above balance", exact: true })
    .click();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await page
    .getByRole("button", { name: "All approvals", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Search by token" }).fill("Orbit");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Edit USDC allowance for Orbit Swap" })
    .click();
  await page.getByLabel("Allow unlimited spending").uncheck();
  await page.getByLabel("New allowance (USDC)").fill("0.0000001");
  await page.getByRole("button", { name: "Simulate update" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("New allowance (USDC)").fill("100");
  await page.getByRole("button", { name: "Simulate update" }).click();
  await expect(page.locator("tbody")).toContainText("100 USDC");
  await page
    .getByRole("button", { name: "Revoke USDC allowance for Orbit Swap" })
    .click();
  await page.getByRole("button", { name: "Simulate revoke" }).click();
  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(page.locator(".activity-list li")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await expect(page.getByText("No browser wallet found")).toBeVisible();
  await page.getByRole("button", { name: "Refresh wallets" }).click();
  await expect(page.getByText("No browser wallet found")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Reset demo", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset demo", exact: true })
    .click();
  await expect(page.locator(".activity-list li")).toHaveCount(0);
});

test("discovery, pending/rejection, live isolation, explicit switching, wallet events, copy and disconnect", async ({
  page,
  context,
}) => {
  await injectWallet(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await fixture(
    page,
    "walletFixture.state.pending = true; walletFixture.state.reject = true",
  );
  await expect(
    page.getByRole("button", { name: "Second Fixture Wallet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Injected", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Fixture Wallet", exact: true })
    .click();
  await expect(page.getByText(/Waiting for Fixture Wallet/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fixture Wallet", exact: true }),
  ).toBeDisabled();
  await fixture(page, "walletFixture.state.pending = false");
  await expect(page.getByRole("alert")).toContainText("Connection declined");
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await fixture(page, "walletFixture.state.reject = false");
  await page
    .getByRole("button", { name: "Fixture Wallet", exact: true })
    .click();
  await expect(
    page.getByText("Live wallet · Read-only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Check allowance", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(
      "tbody, .summary-grid, .wallet-chip, .activity-list, .nav-count",
    ),
  ).toHaveCount(0);
  expect(
    await fixture(
      page,
      "walletFixture.state.calls.includes('wallet_switchEthereumChain')",
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Copy address", exact: true }).click();
  await expect(page.getByText("Address copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "0x1234567890123456789012345678901234567890",
  );
  await fixture(page, "walletFixture.state.rejectSwitch = true");
  await page
    .getByRole("button", { name: "Switch to Base Sepolia", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Network switch declined",
  );
  await fixture(page, "walletFixture.state.rejectSwitch = false");
  await page
    .getByRole("button", { name: "Switch to Base Sepolia", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Switch to Base Sepolia", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".wallet-network")).toContainText("84532");
  await fixture(
    page,
    "walletFixture.state.accounts = ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd']; walletFixture.emit('accountsChanged', walletFixture.state.accounts)",
  );
  await expect(page.locator(".full-wallet-address")).toHaveText(/0xabcdef/i);
  await fixture(
    page,
    "walletFixture.state.chain = '0xa'; walletFixture.emit('chainChanged', '0xa')",
  );
  await expect(page.locator(".wallet-network")).toContainText("chain ID 10");
  await expect(
    page.getByRole("button", { name: "Switch to Base Sepolia", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(
    page.locator(".activity-list, .summary-grid, tbody"),
  ).toHaveCount(0);
  await fixture(
    page,
    "walletFixture.state.accounts = []; walletFixture.emit('accountsChanged', [])",
  );
  await expect(
    page.getByRole("heading", { name: "Wallet disconnected" }),
  ).toBeVisible();
  await expect(page.getByText("Demo mode · Sample data")).toHaveCount(0);
  await page.getByRole("button", { name: "Return to demo mode" }).click();
  await expect(page.getByText("Demo mode · Sample data")).toBeVisible();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await fixture(
    page,
    "walletFixture.state.accounts = ['0x1234567890123456789012345678901234567890']",
  );
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Fixture Wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Wallet disconnected" }),
  ).toBeVisible();
  const calls = (await fixture(page, "walletFixture.state.calls")) as string[];
  expect(
    calls.every((method) =>
      [
        "eth_requestAccounts",
        "wallet_requestPermissions",
        "eth_accounts",
        "eth_chainId",
        "wallet_switchEthereumChain",
        "wallet_revokePermissions",
      ].includes(method),
    ),
  ).toBe(true);
});

test("legacy injection, explicit return disconnects, mobile layout, keyboard dialog focus", async ({
  page,
}) => {
  await injectWallet(page, true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.keyboard.press("Tab");
  expect(
    await page.evaluate(
      () => document.activeElement?.closest("dialog") !== null,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Injected", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Check allowance" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Return to demo mode" }).click();
  await expect(page.getByText("Demo mode · Sample data")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(6);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Connect wallet", exact: true }),
  ).toBeVisible();
});
