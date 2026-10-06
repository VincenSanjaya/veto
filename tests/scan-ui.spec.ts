import { expect, test } from "@playwright/test";
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionResult,
  erc20Abi,
  toHex,
} from "viem";
import type { Address, Hex } from "viem";
import { injectWallet } from "./fixtures/wallet";
import { SCAN_TOKEN } from "../src/lib/approvalScan";

const owner: Address = "0x1234567890123456789012345678901234567890";
const spender: Address = "0x2222222222222222222222222222222222222222";
const revoked: Address = "0x3333333333333333333333333333333333333333";

test("scan UI uses owner-filtered USDC logs, merges manual pairs, hides revoked, reports partial RPC failure and ignores an account-change race", async ({
  page,
}) => {
  await injectWallet(page, true);
  let fail = false;
  let release!: () => void;
  let gate: Promise<void> | null = null;
  let logsCalls = 0;
  const tags: string[] = [];
  await page.route("https://sepolia.base.org/**", async (route) => {
    const request = route.request().postDataJSON();
    async function respond(rpc: {
      id: number;
      method: string;
      params: unknown[];
    }) {
      let result: unknown;
      if (rpc.method === "eth_blockNumber") result = toHex(60_000n);
      else if (rpc.method === "eth_getCode") result = "0x6000";
      else if (rpc.method === "eth_getLogs") {
        logsCalls++;
        const params = rpc.params[0] as {
          address: string;
          fromBlock: Hex;
          toBlock: Hex;
          topics: Hex[];
        };
        expect(params.address.toLowerCase()).toBe(SCAN_TOKEN.toLowerCase());
        expect(params.topics[1].slice(-40)).toBe(owner.slice(2));
        expect(BigInt(params.toBlock) - BigInt(params.fromBlock)).toBeLessThan(
          2_000n,
        );
        if (gate) await gate;
        if (fail && BigInt(params.fromBlock) > 10_001n)
          return {
            jsonrpc: "2.0",
            id: rpc.id,
            error: { code: -32000, message: "RPC temporarily unavailable" },
          };
        result = [spender, spender, revoked].map((address, index) => ({
          address: SCAN_TOKEN,
          blockNumber: params.fromBlock,
          transactionHash: `0x${"1".repeat(64)}`,
          blockHash: `0x${"2".repeat(64)}`,
          logIndex: toHex(index),
          transactionIndex: "0x0",
          removed: false,
          topics: encodeEventTopics({
            abi: erc20Abi,
            eventName: "Approval",
            args: { owner, spender: address },
          }),
          data: encodeAbiParameters([{ type: "uint256" }], [999_000n]),
        }));
      } else if (rpc.method === "eth_call") {
        tags.push(rpc.params[1] as string);
        const decoded = decodeFunctionData({
          abi: erc20Abi,
          data: (rpc.params[0] as { data: Hex }).data,
        });
        const value =
          decoded.functionName === "allowance"
            ? decoded.args[1].toLowerCase() === revoked
              ? 0n
              : 42n
            : decoded.functionName === "balanceOf"
              ? 100n
              : decoded.functionName === "name"
                ? "USD Coin"
                : decoded.functionName === "symbol"
                  ? "USDC"
                  : 6;
        result = encodeFunctionResult({
          abi: erc20Abi,
          functionName: decoded.functionName,
          result: value,
        });
      } else throw new Error(`Unexpected public RPC method ${rpc.method}`);
      return { jsonrpc: "2.0", id: rpc.id, result };
    }
    const result = Array.isArray(request)
      ? await Promise.all(request.map(respond))
      : await respond(request);
    await route.fulfill({ json: result });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page.getByRole("button", { name: "Injected", exact: true }).click();
  await page
    .getByRole("button", { name: "Switch to Base Sepolia", exact: true })
    .click();
  await page
    .getByLabel("Token contract address", { exact: true })
    .fill(SCAN_TOKEN);
  await page.getByLabel("Spender address", { exact: true }).fill(spender);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator(".checked-table tbody tr")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Scan approvals", exact: true })
    .click();
  await expect(page.locator(".scan-status")).toContainText("range complete");
  expect(logsCalls).toBe(25);
  expect(tags.every((tag) => tag === toHex(60_000n))).toBe(true);
  await expect(page.locator(".checked-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".live-summary .summary-value").first()).toHaveText(
    "1",
  );
  await expect(page.locator(".scan-coverage")).toContainText("10001–60000");
  await page.getByLabel("Show revoked", { exact: true }).check();
  await expect(page.locator(".checked-table tbody tr")).toHaveCount(2);
  await expect(
    page.locator(".checked-table tbody tr").filter({ hasText: revoked }),
  ).toContainText("No spending permission");
  await expect(
    page
      .locator(".checked-table tbody tr")
      .filter({ hasText: revoked })
      .getByRole("button", { name: "Edit", exact: true }),
  ).toBeEnabled();
  await expect(
    page
      .locator(".checked-table tbody tr")
      .filter({ hasText: revoked })
      .getByRole("button", { name: "Revoke", exact: true }),
  ).toBeDisabled();
  fail = true;
  await page.getByRole("button", { name: "Scan again", exact: true }).click();
  await expect(page.locator(".scan-status")).toContainText("Partial results");
  await expect(page.locator(".scan-coverage")).toContainText("10001–12000");
  await expect(
    page.locator(".approval-scan-panel").getByRole("alert"),
  ).toContainText("bounded retries");
  fail = false;
  gate = new Promise((resolve) => {
    release = resolve;
  });
  const before = logsCalls;
  await page.getByRole("button", { name: "Retry scan", exact: true }).click();
  await expect.poll(() => logsCalls).toBeGreaterThan(before);
  await page.evaluate(
    "walletFixture.state.accounts = ['0x4444444444444444444444444444444444444444']; walletFixture.emit('accountsChanged', walletFixture.state.accounts)",
  );
  release();
  gate = null;
  await expect(page.locator(".checked-table")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Scan approvals", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".scan-coverage")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const calls = (await page.evaluate("walletFixture.state.calls")) as string[];
  expect(
    calls.filter((method) => /sign|sendTransaction/i.test(method)),
  ).toEqual([]);
});
