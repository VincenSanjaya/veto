import { expect, test } from "@playwright/test";
import {
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  maxUint256,
} from "viem";
import type { Hex } from "viem";
import { injectWallet } from "./fixtures/wallet";

test("manual reads: network gating, validation, snapshots, refresh, failures and account-change race", async ({
  page,
}, testInfo) => {
  await injectWallet(page, true);
  let allowance = 9007199254740994n;
  let decimalsMissing = true;
  let noCode = false;
  let fail = false;
  let gate: Promise<void> | null = null;
  let release = () => {};
  let blockRequests = 0;
  const blockTags: string[] = [];
  const owners: string[] = [];
  await page.route("https://sepolia.base.org/**", async (route) => {
    const payload = route.request().postDataJSON();
    const response = async (request: {
      id: number;
      method: string;
      params: unknown[];
    }) => {
      let result: unknown;
      if (request.method === "eth_blockNumber") {
        blockRequests += 1;
        if (gate) await gate;
        result = "0x7b";
      } else if (request.method === "eth_getCode") {
        blockTags.push(request.params[1] as string);
        result = noCode ? "0x" : "0x6000";
      } else if (request.method === "eth_call") {
        blockTags.push(request.params[1] as string);
        const call = decodeFunctionData({
          abi: erc20Abi,
          data: (request.params[0] as { data: Hex }).data,
        });
        if (fail || (decimalsMissing && call.functionName === "decimals"))
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: { code: 3, message: "execution reverted" },
          };
        if (call.functionName === "balanceOf") {
          owners.push(call.args![0]);
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "balanceOf",
            result: 9007199254740993n,
          });
        }
        if (call.functionName === "allowance")
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "allowance",
            result: allowance,
          });
        if (call.functionName === "name") result = "0x";
        if (call.functionName === "symbol")
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "symbol",
            result: "CHECK",
          });
        if (call.functionName === "decimals")
          result = encodeFunctionResult({
            abi: erc20Abi,
            functionName: "decimals",
            result: 6,
          });
      } else
        throw new Error(`Unexpected public RPC request: ${request.method}`);
      return { jsonrpc: "2.0", id: request.id, result };
    };
    const responses = Array.isArray(payload)
      ? await Promise.all(payload.map(response))
      : await response(payload);
    await route.fulfill({ json: responses });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Injected", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Switch to Base Sepolia", exact: true })
    .click();
  const tokenInput = page.getByLabel("Token contract address", { exact: true });
  const spenderInput = page.getByLabel("Spender address", { exact: true });
  const check = page.getByRole("button", { name: "Check", exact: true });
  await tokenInput.fill("bad");
  await spenderInput.fill("0x2222222222222222222222222222222222222222");
  await check.click();
  await expect(page.getByRole("alert")).toContainText("valid Ethereum address");
  expect(blockRequests).toBe(0);
  await tokenInput.fill("0x0000000000000000000000000000000000000000");
  await check.click();
  await expect(page.getByRole("alert")).toContainText("zero address");
  await tokenInput.fill("0x1111111111111111111111111111111111111111");
  noCode = true;
  await check.click();
  await expect(page.getByRole("alert")).toContainText("No contract code");
  noCode = false;
  await check.click();
  await expect(page.locator(".checked-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".checked-table")).toContainText(
    "9007199254740993 raw units",
  );
  await expect(page.locator(".checked-table")).toContainText(
    "9007199254740994 raw units",
  );
  await expect(page.locator(".checked-table")).toContainText(
    "Decimals unavailable",
  );
  await expect(page.locator(".checked-table")).toContainText(
    "Exceeds balance: Yes",
  );
  await expect(page.locator(".checked-block")).toHaveText("123");
  await expect(
    page
      .locator(".checked-table")
      .getByRole("button", { name: "Edit", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .locator(".checked-table")
      .getByRole("button", { name: "Revoke", exact: true }),
  ).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({
    path: testInfo.outputPath("live-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("live-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1050 });
  expect(blockTags.every((tag) => tag === "0x7b")).toBe(true);
  expect(
    owners.every(
      (value) =>
        value.toLowerCase() === "0x1234567890123456789012345678901234567890",
    ),
  ).toBe(true);
  allowance = 0n;
  decimalsMissing = false;
  await page.getByRole("button", { name: /^Refresh allowance/ }).click();
  await expect(page.locator(".checked-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".checked-table")).toContainText(
    "No spending permission",
  );
  await expect(page.locator(".checked-table")).toContainText("Decimals: 6");
  await expect(page.locator(".live-summary .summary-value").first()).toHaveText(
    "0",
  );
  allowance = maxUint256;
  await page.getByRole("button", { name: /^Refresh allowance/ }).click();
  await expect(
    page.locator(".checked-table .checked-amount").last(),
  ).toHaveText("Unlimited");
  fail = true;
  await page.getByRole("button", { name: /^Refresh allowance/ }).click();
  await expect(page.getByRole("alert")).toContainText("reverted");
  await expect(page.locator(".checked-table tbody tr")).toHaveCount(1);
  fail = false;
  gate = new Promise((resolve) => {
    release = resolve;
  });
  const before = blockRequests;
  const ownerReadsBeforeRace = owners.length;
  await check.click();
  await expect.poll(() => blockRequests).toBeGreaterThan(before);
  await page.evaluate(
    "walletFixture.state.accounts = ['0x3333333333333333333333333333333333333333']; walletFixture.emit('accountsChanged', walletFixture.state.accounts)",
  );
  await expect(page.locator(".checked-table")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "No pairs checked yet." }),
  ).toBeVisible();
  release();
  gate = null;
  // Let the old pinned reads finish; their result must still be discarded.
  await expect.poll(() => owners.length).toBeGreaterThan(ownerReadsBeforeRace);
  await expect(page.locator(".checked-table")).toHaveCount(0);
  await check.click();
  await expect(page.locator(".checked-table tbody tr")).toHaveCount(1);
  await page.evaluate(
    "walletFixture.state.chain = '0x1'; walletFixture.emit('chainChanged', '0x1')",
  );
  await expect(page.locator(".checked-table")).toHaveCount(0);
  await expect(check).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
