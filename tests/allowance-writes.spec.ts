import { expect, test } from "@playwright/test";
import { maxUint256 } from "viem";
import type { Address, Hash } from "viem";
import { baseSepolia } from "viem/chains";
import {
  AllowanceWrites,
  parseFiniteAllowance,
} from "../src/lib/allowanceWrites";
import type { ReceiptOutcome } from "../src/lib/allowanceWrites";
import { walletScope } from "../src/lib/liveAllowances";
import type { CheckedPair } from "../src/lib/liveAllowances";

const owner: Address = "0x1234567890123456789012345678901234567890";
const scope = walletScope(owner, baseSepolia.id, true)!;
const pair: CheckedPair = {
  key: `${scope.key}:token:spender`,
  chainId: baseSepolia.id,
  owner,
  token: "0x1111111111111111111111111111111111111111",
  spender: "0x2222222222222222222222222222222222222222",
  allowance: 100n,
  balance: 300n,
  blockNumber: 5n,
  decimals: 0,
  symbol: "UNIT",
  name: "Test token",
};
const hash = `0x${"a".repeat(64)}` as Hash; // Test fixture only; never displayed by production logic.

test("finite amounts are exact bigint; reject negatives, exponents, precision, missing decimals and uint256 overflow", () => {
  expect(parseFiniteAllowance("9007199254740993.123456", 6)).toBe(
    9007199254740993123456n,
  );
  expect(parseFiniteAllowance("0", 0)).toBe(0n);
  expect(parseFiniteAllowance((maxUint256 - 1n).toString(), 0)).toBe(
    maxUint256 - 1n,
  );
  for (const value of ["-1", "+1", "1e18", "Infinity", "NaN", "", ".5", "1."])
    expect(() => parseFiniteAllowance(value, 18)).toThrow();
  expect(() => parseFiniteAllowance("0.0000001", 6)).toThrow(/decimal places/);
  expect(() => parseFiniteAllowance("1", null)).toThrow(/unavailable/);
  expect(() => parseFiniteAllowance((maxUint256 + 1n).toString(), 0)).toThrow(
    /outside uint256/,
  );
  expect(() => parseFiniteAllowance(maxUint256.toString(), 0)).toThrow(
    /Unlimited approval/,
  );
});

function harness(initial = pair) {
  let allowance = initial.allowance;
  let reject = false;
  let reverted = false;
  let unknown = false;
  let verificationFail = false;
  let actualOverride: bigint | null = null;
  let simulationFalse = false;
  let insufficient = false;
  const amounts: bigint[] = [];
  const observed: CheckedPair[] = [];
  const verifiedBlocks: (bigint | undefined)[] = [];
  const store = new AllowanceWrites({
    read: async (current, block) => {
      if (block !== undefined && verificationFail)
        throw new Error("RPC verification unavailable");
      verifiedBlocks.push(block);
      return { ...current, allowance, balance: 299n, blockNumber: block ?? 6n };
    },
    assertWallet: async () => {},
    prepare: async (_pair, amount) => {
      if (simulationFalse)
        throw new Error("approve returned false during simulation");
      return async () => {
        if (insufficient)
          throw Object.assign(new Error("insufficient funds"), {
            name: "InsufficientFundsError",
          });
        if (reject) throw Object.assign(new Error("rejected"), { code: 4001 });
        amounts.push(amount);
        if (!reverted) allowance = actualOverride ?? amount;
        return hash;
      };
    },
    receipt: async () => {
      if (unknown) throw new Error("receipt timed out");
      return {
        hash,
        status: reverted ? "reverted" : "success",
        blockNumber: 7n,
      };
    },
    observed: (current) => observed.push(current),
  });
  store.setScope(scope);
  return {
    store,
    amounts,
    observed,
    verifiedBlocks,
    setAllowance: (value: bigint) => {
      allowance = value;
    },
    reject: () => {
      reject = true;
    },
    revert: () => {
      reverted = true;
    },
    unknown: (value: boolean) => {
      unknown = value;
    },
    verificationFail: (value: boolean) => {
      verificationFail = value;
    },
    actualOverride: (value: bigint) => {
      actualOverride = value;
    },
    simulationFalse: () => {
      simulationFalse = true;
    },
    insufficient: () => {
      insufficient = true;
    },
  };
}

test("nonzero → nonzero resets first and waits for a separate explicit Continue; zero → nonzero sends one transaction", async () => {
  const h = harness();
  h.store.begin(pair, "edit");
  h.store.review("250");
  await h.store.confirm();
  expect(h.amounts).toEqual([0n]);
  expect(h.store.getSnapshot().dialog).toMatchObject({
    phase: "reset-ready",
    resetVerified: true,
  });
  expect(h.observed.at(-1)?.allowance).toBe(0n);
  expect(h.verifiedBlocks).toContain(7n);
  await h.store.confirm();
  expect(h.amounts).toEqual([0n, 250n]);
  expect(h.store.getSnapshot().dialog?.phase).toBe("confirmed");
  const zero = { ...pair, allowance: 0n };
  const single = harness(zero);
  single.store.begin(zero, "edit");
  single.store.review("5");
  await single.store.confirm();
  expect(single.amounts).toEqual([5n]);
});

test("rejection or cancellation after reset leaves verified zero; no automatic second transaction", async () => {
  const h = harness();
  h.store.begin(pair, "edit");
  h.store.review("250");
  await h.store.confirm();
  h.reject();
  await h.store.confirm();
  expect(h.amounts).toEqual([0n]);
  expect(h.store.getSnapshot().dialog).toMatchObject({
    phase: "rejected",
    resetVerified: true,
    pair: { allowance: 0n },
  });
  expect(h.store.getSnapshot().activity.map((entry) => entry.status)).toEqual([
    "rejected",
    "confirmed",
  ]);
  h.store.close();
  expect(h.store.getSnapshot().message).toContain("verified allowance is zero");
});

test("revoke submits zero even without decimals; unchanged input submits nothing", async () => {
  const raw = { ...pair, decimals: null };
  const h = harness(raw);
  h.store.begin(raw, "revoke");
  await h.store.confirm();
  expect(h.amounts).toEqual([0n]);
  const same = harness();
  same.store.begin(pair, "edit");
  same.store.review("100");
  await same.store.confirm();
  expect(same.amounts).toEqual([]);
  expect(same.store.getSnapshot().dialog?.phase).toBe("unchanged");
});

test("changed current allowance updates review and requires confirmation again", async () => {
  const h = harness();
  h.store.begin(pair, "revoke");
  h.setAllowance(42n);
  await h.store.confirm();
  expect(h.amounts).toEqual([]);
  expect(h.store.getSnapshot().dialog?.pair.allowance).toBe(42n);
  expect(h.store.getSnapshot().dialog?.message).toContain("confirm again");
  await h.store.confirm();
  expect(h.amounts).toEqual([0n]);
});

test("false simulation and reverted receipts do not continue; actual results are not assumed", async () => {
  const f = harness();
  f.store.begin(pair, "revoke");
  f.simulationFalse();
  await f.store.confirm();
  expect(f.amounts).toEqual([]);
  expect(f.store.getSnapshot().dialog?.phase).toBe("failed");
  const r = harness();
  r.store.begin(pair, "edit");
  r.store.review("250");
  r.revert();
  await r.store.confirm();
  expect(r.amounts).toEqual([0n]);
  expect(r.store.getSnapshot().dialog?.phase).toBe("reverted");
  expect(r.store.getSnapshot().activity[0].status).toBe("reverted");
  const actual = harness({ ...pair, allowance: 0n });
  actual.actualOverride(3n);
  actual.store.begin({ ...pair, allowance: 0n }, "edit");
  actual.store.review("5");
  await actual.store.confirm();
  expect(actual.store.getSnapshot().dialog?.pair.allowance).toBe(3n);
  expect(actual.store.getSnapshot().dialog?.message).toContain("differs");
});

test("unknown confirmation blocks duplicate submissions; explicit receipt checks never resubmit", async () => {
  const h = harness();
  h.store.begin(pair, "edit");
  h.store.review("250");
  h.unknown(true);
  await h.store.confirm();
  expect(h.store.getSnapshot().dialog?.phase).toBe("confirmation-unknown");
  expect(h.store.isBlocked()).toBe(true);
  await h.store.confirm();
  expect(h.amounts).toEqual([0n]);
  h.unknown(false);
  await h.store.checkReceipt(h.store.getSnapshot().activity[0].id);
  expect(h.amounts).toEqual([0n]);
  expect(h.store.getSnapshot().dialog?.phase).toBe("reset-ready");
});

test("verification failure after reset blocks writes until explicit successful verification", async () => {
  const h = harness();
  h.store.begin(pair, "edit");
  h.store.review("250");
  h.verificationFail(true);
  await h.store.confirm();
  expect(h.store.isBlocked()).toBe(true);
  await h.store.confirm();
  expect(h.amounts).toEqual([0n]);
  h.verificationFail(false);
  await h.store.checkReceipt(h.store.getSnapshot().activity[0].id);
  expect(h.store.getSnapshot().dialog?.phase).toBe("reset-ready");
  expect(h.amounts).toEqual([0n]);
});

test("account/network changes during simulation prevent submission, including A → B → A; duplicate clicks are ignored", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  const store = new AllowanceWrites({
    read: async () => pair,
    assertWallet: async () => {},
    prepare: async () => {
      await gate;
      return async () => {
        submissions++;
        return hash;
      };
    },
    receipt: async (): Promise<ReceiptOutcome> => ({
      hash,
      status: "success",
      blockNumber: 7n,
    }),
    observed: () => {},
  });
  store.setScope(scope);
  store.begin(pair, "revoke");
  const first = store.confirm();
  await store.confirm();
  store.setScope(null);
  store.setScope(walletScope(pair.spender, baseSepolia.id, true));
  store.setScope(scope);
  release();
  await first;
  expect(submissions).toBe(0);
  expect(store.getSnapshot().dialog?.phase).toBe("invalidated");
});

test("insufficient testnet ETH is a definitive pre-broadcast failure; account changes after a hash keep activity with the original owner", async () => {
  const funds = harness();
  funds.store.begin(pair, "revoke");
  funds.insufficient();
  await funds.store.confirm();
  expect(funds.amounts).toEqual([]);
  expect(funds.store.getSnapshot().dialog?.phase).toBe("failed");
  expect(funds.store.getSnapshot().dialog?.message).toContain(
    "Insufficient Base Sepolia ETH",
  );
  expect(funds.store.isBlocked()).toBe(false);
  let release!: (value: ReceiptOutcome) => void;
  const receipt = new Promise<ReceiptOutcome>((resolve) => {
    release = resolve;
  });
  const observed: CheckedPair[] = [];
  const store = new AllowanceWrites({
    read: async (current, block) => ({
      ...current,
      allowance: block ? 0n : current.allowance,
    }),
    assertWallet: async () => {},
    prepare: async () => async () => hash,
    receipt: () => receipt,
    observed: (value) => observed.push(value),
  });
  store.setScope(scope);
  store.begin(pair, "revoke");
  const pending = store.confirm();
  await expect
    .poll(() => store.getSnapshot().activity[0]?.status)
    .toBe("pending");
  store.setScope(walletScope(pair.spender, baseSepolia.id, true));
  release({ hash, status: "success", blockNumber: 7n });
  await pending;
  expect(store.getSnapshot().activity[0]).toMatchObject({
    scopeKey: scope.key,
    hash,
    status: "confirmed",
    actual: { allowance: 0n },
  });
  expect(observed).toHaveLength(1); // Initial re-read only; no old-owner result enters the new scope.
  expect(store.getSnapshot().dialog?.phase).toBe("invalidated");
});

test("final submit guard invalidates account A → B → A during wallet queries, and terminal outcomes release the lock", async () => {
  let release!: () => void;
  let querying = false;
  let submissions = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const store = new AllowanceWrites({
    read: async () => pair,
    assertWallet: async () => {},
    prepare: async () => async (validate) => {
      querying = true;
      await gate;
      validate();
      submissions++;
      return hash;
    },
    receipt: async () => ({ hash, status: "success", blockNumber: 7n }),
    observed: () => {},
  });
  store.setScope(scope);
  store.begin(pair, "revoke");
  const running = store.confirm();
  await expect.poll(() => querying).toBe(true);
  store.setScope(null);
  store.setScope(scope);
  release();
  await running;
  expect(submissions).toBe(0);
  expect(store.getSnapshot().activity[0].status).toBe("failed");
  expect(store.isBlocked()).toBe(false);
  for (const outcome of ["confirmed", "rejected", "reverted"] as const) {
    const h = harness();
    h.store.begin(pair, "revoke");
    if (outcome === "rejected") h.reject();
    if (outcome === "reverted") h.revert();
    await h.store.confirm();
    expect(h.store.getSnapshot().activity[0].status).toBe(outcome);
    expect(h.store.getSnapshot().busy).toBe(false);
    expect(h.store.isBlocked()).toBe(false);
  }
});
