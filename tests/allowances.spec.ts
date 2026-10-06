import { expect, test } from "@playwright/test";
import {
  createPublicClient,
  custom,
  decodeFunctionData,
  encodeFunctionResult,
  erc20Abi,
  maxUint256,
} from "viem";
import type { Address, Hex } from "viem";
import { baseSepolia } from "viem/chains";
import {
  AllowanceSession,
  displayTokenAmount,
  exposure,
  pairKey,
  readAllowancePair,
  validateContractAddress,
  walletScope,
} from "../src/lib/liveAllowances";
import type { CheckedPair, WalletScope } from "../src/lib/liveAllowances";

const owner: Address = "0x1234567890123456789012345678901234567890";
const token: Address = "0x1111111111111111111111111111111111111111";
const spender: Address = "0x2222222222222222222222222222222222222222";
const scope = walletScope(owner, baseSepolia.id, true)!;

test("address validation rejects malformed, zero, and incorrect checksums; EOA spenders are accepted", () => {
  expect(validateContractAddress(` ${token} `, "Token address")).toBe(token);
  expect(validateContractAddress(spender, "Spender address")).toBe(spender);
  expect(() => validateContractAddress("0x1234", "Token address")).toThrow(
    /valid Ethereum/,
  );
  expect(() =>
    validateContractAddress(
      "0x0000000000000000000000000000000000000000",
      "Spender address",
    ),
  ).toThrow(/zero address/);
  expect(() =>
    validateContractAddress(
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcD",
      "Token address",
    ),
  ).toThrow(/checksum/);
  expect(walletScope(owner, 1, true)).toBeNull();
  expect(walletScope(owner, baseSepolia.id, false)).toBeNull();
});

test("bigint exposure is exact, zero allowance is successful, and decimals are never guessed", () => {
  const huge = 9007199254740993n;
  expect(exposure(huge, huge + 1n)).toEqual({
    active: true,
    aboveBalance: true,
    unlimited: false,
  });
  expect(exposure(huge, huge)).toEqual({
    active: true,
    aboveBalance: false,
    unlimited: false,
  });
  expect(exposure(0n, 0n)).toEqual({
    active: false,
    aboveBalance: false,
    unlimited: false,
  });
  expect(exposure(0n, maxUint256 - 1n).unlimited).toBe(false);
  expect(exposure(maxUint256, maxUint256)).toEqual({
    active: true,
    aboveBalance: false,
    unlimited: true,
  });
  expect(displayTokenAmount(huge, null)).toBe("9007199254740993 raw units");
  expect(displayTokenAmount(0n, null)).toBe("0 raw units");
  expect(displayTokenAmount(1234567n, 6)).toBe("1.234567");
  expect(displayTokenAmount(123n, 0)).toBe("123");
});

function rpcFixture({
  decimalsMissing = false,
  balanceReverts = false,
  noCode = false,
  offline = false,
} = {}) {
  const calls: { method: string; params: readonly unknown[] }[] = [];
  const client = createPublicClient({
    chain: baseSepolia,
    transport: custom(
      {
        async request({ method, params }) {
          const args = (params ?? []) as readonly unknown[];
          calls.push({ method, params: args });
          if (offline) throw new Error("RPC offline");
          if (method === "eth_blockNumber") return "0x7b";
          if (method === "eth_getCode") return noCode ? "0x" : "0x6000";
          if (method === "eth_call") {
            const decoded = decodeFunctionData({
              abi: erc20Abi,
              data: (args[0] as { data: Hex }).data,
            });
            if (
              (decimalsMissing && decoded.functionName === "decimals") ||
              (balanceReverts && decoded.functionName === "balanceOf")
            )
              throw Object.assign(new Error("execution reverted"), { code: 3 });
            if (decoded.functionName === "balanceOf") {
              expect(decoded.args).toEqual([owner]);
              return encodeFunctionResult({
                abi: erc20Abi,
                functionName: "balanceOf",
                result: 9007199254740993n,
              });
            }
            if (decoded.functionName === "allowance") {
              expect(decoded.args).toEqual([owner, spender]);
              return encodeFunctionResult({
                abi: erc20Abi,
                functionName: "allowance",
                result: 0n,
              });
            }
            if (decoded.functionName === "name") return "0x"; // Missing name does not hide symbol or amounts.
            if (decoded.functionName === "symbol")
              return encodeFunctionResult({
                abi: erc20Abi,
                functionName: "symbol",
                result: "TEST",
              });
            if (decoded.functionName === "decimals")
              return encodeFunctionResult({
                abi: erc20Abi,
                functionName: "decimals",
                result: 6,
              });
          }
          throw new Error(`Unexpected RPC method ${method}`);
        },
      },
      { retryCount: 0 },
    ),
  });
  return { client, calls };
}

test("code and every read use one block; zero allowance succeeds with independent missing metadata", async () => {
  const { client, calls } = rpcFixture({ decimalsMissing: true });
  const result = await readAllowancePair(client, scope, token, spender);
  expect(result).toMatchObject({
    balance: 9007199254740993n,
    allowance: 0n,
    blockNumber: 123n,
    name: null,
    symbol: "TEST",
    decimals: null,
  });
  expect(calls.filter((call) => call.method === "eth_call")).toHaveLength(5);
  for (const call of calls.filter(
    (call) => call.method === "eth_call" || call.method === "eth_getCode",
  ))
    expect(call.params[1]).toBe("0x7b");
  expect(
    calls.some(
      (call) =>
        call.method.startsWith("eth_send") || call.method.includes("sign"),
    ),
  ).toBe(false);
});

test("invalid token code, required contract reverts and RPC failures produce errors", async () => {
  const noCode = rpcFixture({ noCode: true });
  await expect(
    readAllowancePair(noCode.client, scope, token, spender),
  ).rejects.toThrow(/No contract code/);
  expect(noCode.calls.some((call) => call.method === "eth_call")).toBe(false);
  const reverted = rpcFixture({ balanceReverts: true });
  await expect(
    readAllowancePair(reverted.client, scope, token, spender),
  ).rejects.toThrow(/balanceOf failed.*reverted/);
  const offline = rpcFixture({ offline: true });
  await expect(
    readAllowancePair(offline.client, scope, token, spender),
  ).rejects.toThrow(/RPC may be unavailable/);
});

function sampleResult(current: WalletScope): CheckedPair {
  return {
    key: pairKey(current, token, spender),
    chainId: current.chainId,
    owner: current.owner,
    token,
    spender,
    balance: 1n,
    allowance: 0n,
    blockNumber: 123n,
    name: null,
    symbol: null,
    decimals: null,
  };
}

test("session refresh replaces a pair; account/network changes clear results and invalidate even A → B → A", async () => {
  const requests: {
    scope: WalletScope;
    resolve: (result: CheckedPair) => void;
    reject: (error: Error) => void;
  }[] = [];
  const session = new AllowanceSession(
    (current) =>
      new Promise((resolve, reject) =>
        requests.push({ scope: current, resolve, reject }),
      ),
  );
  session.setScope(scope);
  let request = session.check(token, spender);
  requests[0].resolve(sampleResult(scope));
  await request;
  expect(session.getSnapshot().results).toHaveLength(1);
  request = session.check(token, spender);
  requests[1].resolve({ ...sampleResult(scope), blockNumber: 124n });
  await request;
  expect(session.getSnapshot().results).toHaveLength(1);
  expect(session.getSnapshot().results[0].blockNumber).toBe(124n);
  request = session.check(token, spender);
  session.setScope(walletScope(spender, baseSepolia.id, true));
  expect(session.getSnapshot().results).toHaveLength(0);
  session.setScope(scope);
  requests[2].resolve(sampleResult(scope));
  await request;
  expect(session.getSnapshot().results).toHaveLength(0);
  request = session.check(token, spender);
  session.setScope(null); // Unsupported network or disconnect.
  requests[3].reject(new Error("late RPC error"));
  await request;
  expect(session.getSnapshot()).toMatchObject({
    results: [],
    pending: false,
    error: "",
  });
});
