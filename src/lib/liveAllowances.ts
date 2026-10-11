import {
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  maxUint256,
  zeroAddress,
} from "viem";
import type { Address, Chain, Client, Transport } from "viem";
import { getBlockNumber, getCode, readContract } from "viem/actions";
import { baseSepolia } from "viem/chains";

export type WalletScope = { chainId: number; owner: Address; key: string };
export type CheckedPair = {
  key: string;
  chainId: number;
  owner: Address;
  token: Address;
  spender: Address;
  blockNumber: bigint;
  balance: bigint;
  allowance: bigint;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
};

export function walletScope(
  owner: string | undefined,
  chainId: number | undefined,
  connected: boolean,
): WalletScope | null {
  if (!connected || !owner || chainId !== baseSepolia.id) return null;
  return {
    owner: getAddress(owner),
    chainId,
    key: `${chainId}:${owner.toLowerCase()}`,
  };
}

export function validateContractAddress(value: string, label: string): Address {
  const address = value.trim();
  if (!isAddress(address))
    throw new Error(
      `${label} must be a valid Ethereum address. Check its length and checksum.`,
    );
  if (address.toLowerCase() === zeroAddress)
    throw new Error(`${label} cannot be the zero address.`);
  return getAddress(address);
}

export function pairKey(scope: WalletScope, token: Address, spender: Address) {
  return `${scope.key}:${token.toLowerCase()}:${spender.toLowerCase()}`;
}

export function exposure(balance: bigint, allowance: bigint) {
  return {
    active: allowance > 0n,
    unlimited: allowance === maxUint256,
    aboveBalance: allowance > balance,
  };
}

export function displayTokenAmount(
  value: bigint,
  decimals: number | null,
): string {
  return decimals === null
    ? `${value.toString()} raw units`
    : formatUnits(value, decimals);
}

function readError(error: unknown, method: string): Error {
  let cause = error;
  const seen = new Set<unknown>();
  while (cause && typeof cause === "object" && !seen.has(cause)) {
    seen.add(cause);
    const entry = cause as { name?: string; cause?: unknown };
    if (
      [
        "ContractFunctionRevertedError",
        "ContractFunctionZeroDataError",
        "AbiDecodingZeroDataError",
        "AbiDecodingDataSizeTooSmallError",
      ].includes(entry.name ?? "")
    ) {
      return new Error(
        `${method} failed: the contract reverted or returned invalid ERC20 data. Check the token address.`,
      );
    }
    cause = entry.cause;
  }
  return new Error(
    `${method} failed. The Base Sepolia RPC may be unavailable, rate-limited, or unable to serve this block. Try again.`,
  );
}

export async function readAllowancePair(
  client: Client<Transport, Chain>,
  scope: WalletScope,
  token: Address,
  spender: Address,
  atBlock?: bigint,
): Promise<CheckedPair> {
  if (scope.chainId !== baseSepolia.id || client.chain.id !== baseSepolia.id)
    throw new Error("Select Base Sepolia before checking an allowance.");
  let blockNumber: bigint;
  let code: `0x${string}` | undefined;
  try {
    blockNumber = atBlock ?? (await getBlockNumber(client, { cacheTime: 0 }));
    code = await getCode(client, { address: token, blockNumber });
  } catch (error) {
    throw readError(error, "Token contract verification");
  }
  if (!code || code === "0x")
    throw new Error(
      "No contract code was found at the token address on Base Sepolia at this block.",
    );

  // Separate eth_call requests, all pinned to the same block. No multicall dependency.
  const common = { address: token, abi: erc20Abi, blockNumber } as const;
  const [balance, allowance, name, symbol, decimals] = await Promise.allSettled(
    [
      readContract(client, {
        ...common,
        functionName: "balanceOf",
        args: [scope.owner],
      }),
      readContract(client, {
        ...common,
        functionName: "allowance",
        args: [scope.owner, spender],
      }),
      readContract(client, { ...common, functionName: "name" }),
      readContract(client, { ...common, functionName: "symbol" }),
      readContract(client, { ...common, functionName: "decimals" }),
    ],
  );
  if (balance.status === "rejected")
    throw readError(balance.reason, "balanceOf");
  if (allowance.status === "rejected")
    throw readError(allowance.reason, "allowance");
  return {
    key: pairKey(scope, token, spender),
    chainId: scope.chainId,
    owner: scope.owner,
    token,
    spender,
    blockNumber,
    balance: balance.value,
    allowance: allowance.value,
    name:
      name.status === "fulfilled" && name.value.trim()
        ? name.value.slice(0, 120)
        : null,
    symbol:
      symbol.status === "fulfilled" && symbol.value.trim()
        ? symbol.value.slice(0, 32)
        : null,
    decimals:
      decimals.status === "fulfilled" &&
      Number.isInteger(decimals.value) &&
      decimals.value >= 0 &&
      decimals.value <= 255
        ? decimals.value
        : null,
  };
}

type Snapshot = {
  scope: WalletScope | null;
  results: readonly CheckedPair[];
  pending: boolean;
  error: string;
  message: string;
};
type Reader = (
  scope: WalletScope,
  token: Address,
  spender: Address,
) => Promise<CheckedPair>;

// A generation changes even for A → B → A, so requests from the first A stay invalid.
export class AllowanceSession {
  private generation = 0;
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = {
    scope: null,
    results: [],
    pending: false,
    error: "",
    message: "",
  };
  constructor(private readonly reader: Reader) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }
  setScope(scope: WalletScope | null) {
    if (scope?.key === this.snapshot.scope?.key) return;
    this.generation += 1;
    this.publish({
      scope,
      results: [],
      pending: false,
      error: "",
      message: "",
    });
  }
  accept(result: CheckedPair) {
    if (
      `${result.chainId}:${result.owner.toLowerCase()}` !==
      this.snapshot.scope?.key
    )
      return;
    const previous = this.snapshot.results.find(
      (item) => item.key === result.key,
    );
    // A late scan snapshot must never replace a newer manual/post-transaction read.
    if (previous && previous.blockNumber > result.blockNumber) return;
    const results = this.snapshot.results.filter(
      (item) => item.key !== result.key,
    );
    this.publish({
      ...this.snapshot,
      results: [result, ...results],
      error: this.snapshot.pending ? this.snapshot.error : "",
      message: this.snapshot.pending
        ? this.snapshot.message
        : `Onchain values verified at block ${result.blockNumber}. Selected pair only.`,
    });
  }
  async check(tokenInput: string, spenderInput: string) {
    const { scope, pending } = this.snapshot;
    if (!scope || pending) return;
    let token: Address;
    let spender: Address;
    try {
      token = validateContractAddress(tokenInput, "Token address");
      spender = validateContractAddress(spenderInput, "Spender address");
    } catch (error) {
      this.publish({
        ...this.snapshot,
        error: (error as Error).message,
        message: "",
      });
      return;
    }
    const generation = this.generation;
    const key = pairKey(scope, token, spender);
    this.publish({
      ...this.snapshot,
      pending: true,
      error: "",
      message: "Reading the selected pair from Base Sepolia…",
    });
    try {
      const result = await this.reader(scope, token, spender);
      if (generation !== this.generation) return;
      this.accept(result);
      const latest = this.snapshot.results.find((item) => item.key === key)!;
      this.publish({
        ...this.snapshot,
        pending: false,
        error: "",
        message: latest.blockNumber > result.blockNumber
          ? `Check complete. A newer verified snapshot at block ${latest.blockNumber} was retained. Selected pair only.`
          : `Check complete at block ${result.blockNumber}. Selected pair only.`,
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.publish({
        ...this.snapshot,
        pending: false,
        error:
          error instanceof Error
            ? error.message
            : "The allowance check failed. Try again.",
        message: "",
      });
    }
  }
}
