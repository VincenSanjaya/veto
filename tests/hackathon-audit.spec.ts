import { expect, test } from "@playwright/test";
import { AllowanceWrites } from "../src/lib/allowanceWrites";
import { AllowanceSession, pairKey, walletScope } from "../src/lib/liveAllowances";
import type { CheckedPair } from "../src/lib/liveAllowances";
import { createPublicClient, custom, erc20Abi } from "viem";
import { baseSepolia } from "viem/chains";

const scope = walletScope("0x1234567890123456789012345678901234567890", 84532, true)!;
const token = "0x1111111111111111111111111111111111111111";
const spender = "0x2222222222222222222222222222222222222222";
const pair: CheckedPair = {
  key: pairKey(scope, token, spender), owner: scope.owner, chainId: scope.chainId,
  token, spender, blockNumber: 10n, allowance: 100n, balance: 200n,
  decimals: 0, name: "Audit fixture", symbol: "TEST",
};

// Audit regression proofs for receipt verification and manual-read isolation.
test("AUDIT-M1: a confirmed receipt with unavailable verification must not label the transaction failed", async () => {
  let unavailable = true;
  let submissions = 0;
  let simulations = 0;
  let receipts = 0;
  const store = new AllowanceWrites({
    assertWallet: async () => {},
    read: async (current, block) => {
      if (block !== undefined && unavailable) throw new Error("RPC unavailable");
      return { ...current, allowance: block === undefined ? 100n : 0n, blockNumber: block ?? 11n };
    },
    prepare: async () => { simulations++; return async () => { submissions++; return `0x${"a".repeat(64)}`; }; },
    receipt: async (hash) => { receipts++; return { hash, status: "success", blockNumber: 12n }; },
    observed: () => {},
  });
  store.setScope(scope); store.begin(pair, "revoke"); await store.confirm();
  expect(store.getSnapshot().activity[0].status).toBe("confirmed");
  expect(store.isBlocked()).toBe(true);
  expect(store.getSnapshot().activity[0].verification).toBe("unavailable");
  const originalHash = store.getSnapshot().activity[0].hash;
  const phaseBeforeRecovery = store.getSnapshot().dialog?.phase;
  unavailable = false; await store.checkReceipt(store.getSnapshot().activity[0].id);
  expect(store.getSnapshot().activity[0].actual?.allowance).toBe(0n);
  expect(store.isBlocked()).toBe(false);
  expect(phaseBeforeRecovery).not.toBe("failed");
  expect(phaseBeforeRecovery).toBe("verification-unavailable");
  expect(store.getSnapshot().activity[0].verification).toBe("matched");
  expect(store.getSnapshot().activity[0].hash).toBe(originalHash);
  expect({ submissions, simulations, receipts }).toEqual({ submissions: 1, simulations: 1, receipts: 1 });
});

test("AUDIT-M2: verification of another pair must not discard an in-flight manual check", async () => {
  let resolveRead!: (value: CheckedPair) => void;
  const session = new AllowanceSession(() => new Promise((resolve) => { resolveRead = resolve; }));
  session.setScope(scope);
  const checking = session.check(token, spender);
  const otherSpender = "0x3333333333333333333333333333333333333333";
  session.accept({ ...pair, spender: otherSpender, key: pairKey(scope, token, otherSpender), blockNumber: 12n });
  expect(session.getSnapshot().pending).toBe(true);
  resolveRead({ ...pair, blockNumber: 11n }); await checking;
  expect(session.getSnapshot().results.map((result) => result.key)).toContain(pair.key);
  expect(session.getSnapshot().results).toHaveLength(2);
});

test("stale same-pair manual response cannot replace newer verification; refresh keeps a unique row", async () => {
  let resolveRead!: (value: CheckedPair) => void;
  const session = new AllowanceSession(() => new Promise((resolve) => { resolveRead = resolve; }));
  session.setScope(scope);
  let checking = session.check(token, spender);
  session.accept({ ...pair, blockNumber: 20n, allowance: 0n });
  expect(session.getSnapshot().pending).toBe(true);
  resolveRead({ ...pair, blockNumber: 19n, allowance: 100n }); await checking;
  expect(session.getSnapshot().results).toEqual([{ ...pair, blockNumber: 20n, allowance: 0n }]);
  expect(session.getSnapshot().pending).toBe(false);
  checking = session.check(token, spender);
  resolveRead({ ...pair, blockNumber: 21n, allowance: 5n }); await checking;
  session.accept({ ...pair, blockNumber: 18n });
  expect(session.getSnapshot().results).toEqual([{ ...pair, blockNumber: 21n, allowance: 5n }]);
});

test("confirmed revoke/finite/reset mismatches report actual values and never advance reset", async () => {
  for (const kind of ["revoke", "set", "reset"] as const) {
    const initial = { ...pair, allowance: kind === "set" ? 0n : 100n };
    const amounts: bigint[] = [];
    const store = new AllowanceWrites({
      assertWallet: async () => {},
      read: async (current, block) => ({ ...current, blockNumber: block ?? 11n, allowance: block === undefined ? initial.allowance : 3n }),
      prepare: async (_pair, amount) => async () => { amounts.push(amount); return `0x${"a".repeat(64)}`; },
      receipt: async (hash) => ({ hash, status: "success", blockNumber: 12n }),
      observed: () => {},
    });
    store.setScope(scope); store.begin(initial, kind === "revoke" ? "revoke" : "edit");
    if (kind !== "revoke") store.review("5");
    await store.confirm();
    const entry = store.getSnapshot().activity[0];
    expect(entry).toMatchObject({ status: "confirmed", verification: "mismatch", requested: kind === "set" ? 5n : 0n });
    expect(entry.actual?.allowance).toBe(3n);
    expect(store.getSnapshot().dialog).toMatchObject({ phase: "mismatch", resetVerified: false });
    if (kind === "revoke") expect(entry.message).toContain("Revoke did not remove the permission");
    await store.confirm();
    expect(amounts).toEqual([kind === "set" ? 5n : 0n]);
  }
});

test("hashless unknown stays locked across account changes and receipt recovery submits nothing", async () => {
  let submissions = 0; let receipts = 0;
  const store = new AllowanceWrites({
    assertWallet: async () => {}, read: async () => pair,
    prepare: async () => async () => { submissions++; throw new Error("Wallet outcome unknown"); },
    receipt: async () => { receipts++; throw new Error("No receipt"); }, observed: () => {},
  });
  store.setScope(scope); store.begin(pair, "revoke"); await store.confirm();
  expect(store.getSnapshot().activity[0]).toMatchObject({ status: "confirmation-unknown", pair: { owner: scope.owner } });
  expect(store.getSnapshot().activity[0].hash).toBeUndefined();
  await store.checkReceipt(store.getSnapshot().activity[0].id);
  store.setScope(walletScope("0x3333333333333333333333333333333333333333", 84532, true));
  expect(store.isBlocked()).toBe(true);
  store.setScope(scope); await store.confirm();
  expect(store.isBlocked()).toBe(true);
  expect({ submissions, receipts }).toEqual({ submissions: 1, receipts: 0 });
});

test("manual write compatibility: approve without return data fails the configured ERC20 simulation", async () => {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: custom({ request: async ({ method }) => {
      if (method === "eth_call") return "0x";
      throw new Error(`Unexpected RPC method ${method}`);
    } }),
  });
  await expect(client.simulateContract({
    address: token, abi: erc20Abi, functionName: "approve",
    args: [spender, 0n], account: scope.owner,
  })).rejects.toThrow(/returned no data|zero data/i);
});
