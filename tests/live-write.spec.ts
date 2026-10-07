import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { decodeFunctionData, encodeFunctionResult, erc20Abi } from "viem";
import type { Hex } from "viem";
import { injectWallet } from "./fixtures/wallet";

const owner = "0x1234567890123456789012345678901234567890";
const token = "0x1111111111111111111111111111111111111111";
const spender = "0x2222222222222222222222222222222222222222";

async function fixture(page: Page) {
  await injectWallet(page, true);
  const state = {
    allowance: 1_000_000n,
    simulate: true,
    reject: false,
    reverted: false,
    submissions: [] as bigint[],
    simulations: [] as bigint[],
  };
  const txs = new Map<string, { data: Hex; status: string }>();
  await page.exposeFunction(
    "mockVetoSubmit",
    (request: { from: string; to: string; data: Hex }) => {
      if (state.reject) return { rejected: true };
      expect(request.from.toLowerCase()).toBe(owner);
      expect(request.to.toLowerCase()).toBe(token);
      const decoded = decodeFunctionData({ abi: erc20Abi, data: request.data });
      expect(decoded.functionName).toBe("approve");
      if (decoded.functionName !== "approve")
        throw new Error("Only approve may be requested");
      expect(decoded.args[0].toLowerCase()).toBe(spender);
      state.submissions.push(decoded.args[1]);
      if (!state.reverted) state.allowance = decoded.args[1];
      const hash = `0x${state.submissions.length.toString(16).padStart(64, "0")}`;
      txs.set(hash, {
        data: request.data,
        status: state.reverted ? "0x0" : "0x1",
      });
      return { hash };
    },
  );
  await page.route("https://sepolia.base.org/**", async (route) => {
    const response = (request: {
      id: number;
      method: string;
      params: unknown[];
    }) => {
      let result: unknown;
      if (request.method === "eth_blockNumber") result = "0x7b";
      else if (request.method === "eth_getCode") result = "0x6000";
      else if (request.method === "eth_chainId") result = "0x14a34";
      else if (request.method === "eth_call") {
        const call = decodeFunctionData({
          abi: erc20Abi,
          data: (request.params[0] as { data: Hex }).data,
        });
        if (call.functionName === "balanceOf")
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "balanceOf",
            result: 4_000_000n,
          });
        if (call.functionName === "allowance")
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "allowance",
            result: state.allowance,
          });
        if (call.functionName === "name")
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "name",
            result: "Fixture units",
          });
        if (call.functionName === "symbol")
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "symbol",
            result: "UNIT",
          });
        if (call.functionName === "decimals")
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "decimals",
            result: 6,
          });
        if (call.functionName === "approve") {
          state.simulations.push(call.args[1]);
          expect(
            (request.params[0] as { from: string }).from.toLowerCase(),
          ).toBe(owner);
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "approve",
            result: state.simulate,
          });
        }
      } else if (request.method === "eth_getTransactionReceipt") {
        const hash = request.params[0] as string;
        const tx = txs.get(hash);
        result = tx
          ? {
              transactionHash: hash,
              transactionIndex: "0x0",
              blockHash: `0x${"b".repeat(64)}`,
              blockNumber: "0x7b",
              from: owner,
              to: token,
              cumulativeGasUsed: "0x5208",
              gasUsed: "0x5208",
              contractAddress: null,
              logs: [],
              logsBloom: `0x${"0".repeat(512)}`,
              status: tx.status,
              type: "0x2",
              effectiveGasPrice: "0x1",
            }
          : null;
      } else if (request.method === "eth_getTransactionByHash") {
        const hash = request.params[0] as string;
        const tx = txs.get(hash);
        result = tx
          ? {
              hash,
              blockHash: `0x${"b".repeat(64)}`,
              blockNumber: "0x7b",
              from: owner,
              to: token,
              input: tx.data,
              nonce: "0x0",
              gas: "0x5208",
              gasPrice: "0x1",
              value: "0x0",
              transactionIndex: "0x0",
              type: "0x2",
              chainId: "0x14a34",
              v: "0x0",
              r: "0x1",
              s: "0x1",
            }
          : null;
      } else throw new Error(`Unexpected RPC method ${request.method}`);
      return { id: request.id, jsonrpc: "2.0", result };
    };
    const payload = route.request().postDataJSON();
    await route.fulfill({
      json: Array.isArray(payload) ? payload.map(response) : response(payload),
    });
  });
  await page.goto("/app");
  await page.evaluate(() => {
    const fixture = window as unknown as {
      walletFixture: {
        provider: {
          request: (request: {
            method: string;
            params?: unknown[];
          }) => Promise<unknown>;
        };
        state: { calls: string[] };
      };
      mockVetoSubmit: (
        request: unknown,
      ) => Promise<{ hash?: string; rejected?: boolean }>;
    };
    const original = fixture.walletFixture.provider.request;
    fixture.walletFixture.provider.request = async (request) => {
      if (request.method === "eth_sendTransaction") {
        fixture.walletFixture.state.calls.push(request.method);
        const response = await fixture.mockVetoSubmit(request.params![0]);
        if (response.rejected)
          throw Object.assign(new Error("User rejected"), { code: 4001 });
        return response.hash;
      }
      return original(request);
    };
  });
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Injected", exact: true }).click();
  await page
    .getByRole("button", { name: "Switch to Base Sepolia", exact: true })
    .click();
  await page.getByLabel("Show revoked", { exact: true }).check();
  await page.getByLabel("Token contract address", { exact: true }).fill(token);
  await page.getByLabel("Spender address", { exact: true }).fill(spender);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(".checked-table tbody tr")).toHaveCount(1);
  return state;
}

async function reviewEdit(page: Page) {
  await page
    .locator(".checked-table")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await page.getByLabel("New finite allowance (UNIT)").fill("2");
  await page.getByRole("button", { name: "Review change" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(owner);
  await expect(dialog).toContainText(token);
  await expect(dialog).toContainText(spender);
  await expect(dialog).toContainText("Base Sepolia · 84532");
  await expect(dialog).toContainText("Two separate transactions");
}

test("real adapters with mocked transport: explicit reset and Continue, actual Activity hashes and explorer links", async ({
  page,
}) => {
  const state = await fixture(page);
  await reviewEdit(page);
  expect(state.submissions).toEqual([]);
  await page
    .getByRole("button", { name: "Confirm reset to zero", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue · Submit new allowance" }),
  ).toBeVisible();
  expect(state.simulations).toEqual([0n]);
  expect(state.submissions).toEqual([0n]);
  await page
    .getByRole("button", { name: "Continue · Submit new allowance" })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Receipt confirmed. The displayed allowance", {
        exact: false,
      }),
  ).toBeVisible();
  expect(state.submissions).toEqual([0n, 2_000_000n]);
  expect(state.simulations).toEqual([0n, 2_000_000n]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.locator(".checked-table")).toContainText(
    "Exceeds balance: No",
  );
  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(
    page.locator(".live-transactions .activity-list li"),
  ).toHaveCount(2);
  await expect(page.locator(".transaction-link").first()).toHaveAttribute(
    "href",
    /https:\/\/sepolia\.basescan\.org\/tx\/0x0+2$/,
  );
  await expect(page.locator(".live-transactions")).toContainText(
    "Verified allowance: 2",
  );
  await page.evaluate(
    "walletFixture.state.accounts = ['0x3333333333333333333333333333333333333333']; walletFixture.emit('accountsChanged', walletFixture.state.accounts)",
  );
  await expect(
    page.locator(".live-transactions .activity-list li"),
  ).toHaveCount(0);
});

test("wallet rejection after reset leaves zero, with no fabricated rejection hash", async ({
  page,
}) => {
  const state = await fixture(page);
  await reviewEdit(page);
  await page
    .getByRole("button", { name: "Confirm reset to zero", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue · Submit new allowance" }),
  ).toBeVisible();
  state.reject = true;
  await page
    .getByRole("button", { name: "Continue · Submit new allowance" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Request rejected in the wallet",
  );
  expect(state.submissions).toEqual([0n]);
  await page
    .getByRole("button", { name: "Stop after reset", exact: true })
    .click();
  await expect(page.locator(".checked-table")).toContainText(
    "No spending permission",
  );
  await expect(
    page
      .locator(".checked-table")
      .getByRole("button", { name: "Edit", exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .locator(".checked-table")
      .getByRole("button", { name: "Revoke", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(
    page.locator(".live-transactions .activity-list li"),
  ).toHaveCount(2);
  await expect(page.locator(".transaction-link")).toHaveCount(1);
  await expect(page.locator(".transaction-tag.status-rejected")).toBeVisible();
});

test("false approve simulation blocks the actual wallet adapter; reverted receipts stop the flow", async ({
  page,
}) => {
  const state = await fixture(page);
  state.simulate = false;
  await page
    .locator(".checked-table")
    .getByRole("button", { name: "Revoke", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm revoke", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "approve returned false",
  );
  expect(state.submissions).toEqual([]);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  state.simulate = true;
  state.reverted = true;
  await reviewEdit(page);
  await page
    .getByRole("button", { name: "Confirm reset to zero", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Transaction reverted");
  await expect(
    page.getByRole("button", { name: "Continue · Submit new allowance" }),
  ).toHaveCount(0);
  expect(state.submissions).toEqual([0n]);
});

test("mobile live Edit/Revoke dialogs, approval table and Activity keep all content reachable", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const state = await fixture(page);
  const noOverflow = async () => {
    const overflowing = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((node) => {
          const box = node.getBoundingClientRect();
          return box.right > innerWidth && !node.closest(".checked-table");
        })
        .map(
          (node) =>
            `${node.tagName}.${node.className}: ${node.getBoundingClientRect().right}`,
        ),
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      ),
      overflowing.join("\n"),
    ).toBe(false);
    if (await page.getByRole("dialog").count()) {
      const box = await page.getByRole("dialog").boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
      expect(
        await page
          .getByRole("dialog")
          .evaluate((node) => node.scrollWidth > node.clientWidth),
      ).toBe(false);
    }
  };
  await noOverflow();
  await page.locator(".checked-table").evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  await reviewEdit(page);
  await noOverflow();
  await page
    .getByRole("button", { name: "Confirm reset to zero", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mobile-edit.png") });
  await page
    .getByRole("button", { name: "Confirm reset to zero", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Continue · Submit new allowance" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue · Submit new allowance" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Receipt confirmed. The displayed allowance",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .locator(".checked-table")
    .getByRole("button", { name: "Revoke", exact: true })
    .click();
  await noOverflow();
  await page
    .getByRole("button", { name: "Confirm revoke", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("mobile-revoke.png") });
  await page
    .getByRole("button", { name: "Confirm revoke", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Receipt confirmed. The displayed allowance",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  expect(state.submissions).toEqual([0n, 2_000_000n, 0n]);
  await expect(
    page
      .locator(".checked-table")
      .getByRole("button", { name: "Edit", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(page.locator(".transaction-link")).toHaveCount(3);
  await noOverflow();
  await page.screenshot({
    path: testInfo.outputPath("mobile-live-activity.png"),
    fullPage: true,
  });
  await expect(
    page.locator(".glass-canvas, .liquid-scene, .landing"),
  ).toHaveCount(0);
});
