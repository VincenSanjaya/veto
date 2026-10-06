import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// EIP-1193/6963 fixture only. These are not real installed wallets or RPC responses.
async function injectWallet(page: Page, legacy = false) {
  await page.addInitScript(
    ({ legacy }) => {
      const state = {
        accounts: ["0x1234567890123456789012345678901234567890"],
        chain: "0x1",
        reject: false,
        rejectSwitch: false,
        pending: false,
        calls: [] as string[],
      };
      const listeners = new Map<string, Set<(value: unknown) => void>>();
      const emit = (event: string, value: unknown) =>
        listeners.get(event)?.forEach((fn) => fn(value));
      const provider = {
        on(event: string, fn: (value: unknown) => void) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event)!.add(fn);
        },
        removeListener(event: string, fn: (value: unknown) => void) {
          listeners.get(event)?.delete(fn);
        },
        async request({
          method,
          params,
        }: {
          method: string;
          params?: { chainId: string }[];
        }) {
          state.calls.push(method);
          if (
            method === "eth_requestAccounts" ||
            method === "wallet_requestPermissions"
          ) {
            while (state.pending)
              await new Promise((resolve) => setTimeout(resolve, 20));
            if (state.reject)
              throw Object.assign(new Error("User rejected"), { code: 4001 });
            return method === "wallet_requestPermissions"
              ? [
                  {
                    parentCapability: "eth_accounts",
                    caveats: [
                      {
                        type: "restrictReturnedAccounts",
                        value: state.accounts,
                      },
                    ],
                  },
                ]
              : state.accounts;
          }
          if (method === "eth_accounts") return state.accounts;
          if (method === "eth_chainId") return state.chain;
          if (method === "wallet_switchEthereumChain") {
            if (state.rejectSwitch)
              throw Object.assign(new Error("User rejected"), { code: 4001 });
            state.chain = params![0].chainId;
            emit("chainChanged", state.chain);
            return null;
          }
          if (method === "wallet_revokePermissions") return null;
          throw new Error(`Unexpected wallet method: ${method}`);
        },
      };
      Object.assign(window, { walletFixture: { state, emit } });
      if (legacy) Object.assign(window, { ethereum: provider });
      else {
        Object.assign(window, { ethereum: provider });
        const secondProvider = { ...provider };
        const announce = () => {
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: {
                  uuid: "f58eacdb-d512-4baa-a49a-51dcaf888731",
                  name: "Fixture Wallet",
                  icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
                  rdns: "test.veto.fixture",
                },
                provider,
              },
            }),
          );
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: {
                  uuid: "f58eacdb-d512-4baa-a49a-51dcaf888732",
                  name: "Second Fixture Wallet",
                  icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
                  rdns: "test.veto.second",
                },
                provider: secondProvider,
              },
            }),
          );
        };
        window.addEventListener("eip6963:requestProvider", announce);
        announce();
      }
    },
    { legacy },
  );
}

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
    page.getByText("Live wallet · Connection only", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Approval scanning is not implemented yet.", {
      exact: true,
    }),
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
    page.getByText("Approval scanning is not implemented yet."),
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
