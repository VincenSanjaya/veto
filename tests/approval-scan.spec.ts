import { expect, test } from "@playwright/test";
import { getAddress } from "viem";
import type { Address } from "viem";
import { ApprovalScan, SCAN_TOKEN } from "../src/lib/approvalScan";
import type { ScanDependencies } from "../src/lib/approvalScan";
import {
  AllowanceSession,
  pairKey,
  walletScope,
} from "../src/lib/liveAllowances";
import type { CheckedPair } from "../src/lib/liveAllowances";

const owner: Address = "0x1234567890123456789012345678901234567890";
const spender: Address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const second: Address = "0x3333333333333333333333333333333333333333";
const scope = walletScope(owner, 84532, true)!;
const pair = (
  address = spender,
  allowance = 42n,
  block = 60_000n,
): CheckedPair => ({
  key: pairKey(scope, SCAN_TOKEN, address),
  owner,
  chainId: 84532,
  token: SCAN_TOKEN,
  spender: address,
  balance: 10n,
  allowance,
  blockNumber: block,
  name: "USDC",
  symbol: "USDC",
  decimals: 6,
});

function fixture(overrides: Partial<ScanDependencies> = {}) {
  const accepted: CheckedPair[] = [];
  const scanner = new ApprovalScan({
    block: async () => 60_000n,
    logs: async () => [],
    read: async (_scope, spender, block) =>
      pair(spender, spender === second ? 0n : 42n, block),
    accept: (result) => accepted.push(result),
    ...overrides,
  });
  scanner.setScope(scope);
  return { scanner, accepted };
}

test("scan deduplicates case-insensitive spenders, ignores event amounts, and pins every actual read to one block including zero allowance", async () => {
  const blocks: bigint[] = [];
  const { scanner, accepted } = fixture({
    logs: async () => [
      { owner, spender, value: 9999n },
      { owner, spender: getAddress(spender), value: 0n },
      { owner, spender: second, value: 9000n },
      { owner: second, spender: owner, value: 1n },
    ],
    read: async (_scope, address, block) => {
      blocks.push(block);
      return pair(address, address === second ? 0n : 42n, block);
    },
  });
  await scanner.start();
  expect(scanner.getSnapshot()).toMatchObject({
    status: "complete",
    from: 10_001n,
    to: 60_000n,
    coveredTo: 60_000n,
    discovered: 2,
    verified: 2,
  });
  expect(accepted.map((result) => result.allowance)).toEqual([42n, 0n]);
  expect(blocks).toEqual([60_000n, 60_000n]);
});

test("RPC range limits shrink contiguous chunks; persistent RPC errors stop after five attempts with explicit partial coverage", async () => {
  const calls: [bigint, bigint][] = [];
  const { scanner } = fixture({
    logs: async (_scope, from, to) => {
      calls.push([from, to]);
      if (to - from + 1n > 500n)
        throw new Error("RPC block range limit exceeded");
      return [];
    },
  });
  await scanner.start();
  expect(calls.slice(0, 3)).toEqual([
    [10_001n, 12_000n],
    [10_001n, 11_000n],
    [10_001n, 10_500n],
  ]);
  expect(scanner.getSnapshot().status).toBe("complete");
  let failures = 0;
  const partial = fixture({
    logs: async (_scope, from) => {
      if (from > 10_001n) {
        failures++;
        throw new Error("RPC unavailable");
      }
      return [{ owner, spender, value: 1n }];
    },
  });
  await partial.scanner.start();
  expect(failures).toBe(5);
  expect(partial.scanner.getSnapshot()).toMatchObject({
    status: "partial",
    coveredTo: 12_000n,
    verified: 1,
  });
  expect(partial.scanner.getSnapshot().error).toContain("bounded retries");
  const failed = fixture({
    block: async () => {
      throw new Error("RPC unavailable");
    },
  });
  await failed.scanner.start();
  expect(failed.scanner.getSnapshot().status).toBe("failed");
});

test("failed verification excludes a pair, preserves successful log coverage, and labels results partial", async () => {
  const { scanner, accepted } = fixture({
    logs: async () => [{ owner, spender, value: 1n }],
    read: async () => {
      throw new Error("allowance reverted");
    },
  });
  await scanner.start();
  expect(accepted).toEqual([]);
  expect(scanner.getSnapshot()).toMatchObject({
    status: "partial",
    coveredTo: 60_000n,
    verified: 0,
    failedPairs: 1,
  });
});

test("cancel and account/network changes discard delayed logs and reads, including A → B → A; retry starts a fresh snapshot", async () => {
  for (const change of ["cancel", "account", "network"]) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { scanner, accepted } = fixture({
      logs: async () => {
        await gate;
        return [{ owner, spender, value: 1n }];
      },
    });
    const running = scanner.start();
    await expect.poll(() => scanner.getSnapshot().from).toBe(10_001n);
    if (change === "cancel") scanner.cancel();
    else {
      scanner.setScope(
        change === "account" ? walletScope(second, 84532, true) : null,
      );
      scanner.setScope(scope);
    }
    release();
    await running;
    expect(accepted).toEqual([]);
    expect(scanner.getSnapshot().status).toBe(
      change === "cancel" ? "cancelled" : "idle",
    );
    await scanner.start();
    expect(accepted).toHaveLength(1);
  }
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reading = false;
  const h = fixture({
    logs: async () => [{ owner, spender, value: 1n }],
    read: async () => {
      reading = true;
      await gate;
      return pair();
    },
  });
  const run = h.scanner.start();
  await expect.poll(() => reading).toBe(true);
  h.scanner.setScope(null);
  release();
  await run;
  expect(h.accepted).toHaveLength(0);
});

test("manual, scan, and transaction verification merge one unique row and reject older scan snapshots", async () => {
  const session = new AllowanceSession(async () => pair());
  session.setScope(scope);
  await session.check(SCAN_TOKEN, spender);
  session.accept(pair(spender, 5n));
  expect(session.getSnapshot().results).toHaveLength(1);
  session.accept(pair(spender, 0n, 60_010n)); // Actual post-revoke result updates summary source.
  session.accept(pair(spender, 42n, 60_000n)); // Delayed scan must not restore the old allowance.
  expect(session.getSnapshot().results).toHaveLength(1);
  expect(session.getSnapshot().results[0].allowance).toBe(0n);
});
