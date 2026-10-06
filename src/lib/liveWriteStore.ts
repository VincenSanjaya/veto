import { erc20Abi } from "viem";
import {
  getAddresses,
  getChainId,
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import { getConnection, getConnectorClient } from "wagmi/actions";
import { baseSepolia } from "viem/chains";
import type { CheckedPair } from "./liveAllowances";
import { readAllowancePair } from "./liveAllowances";
import { AllowanceWrites } from "./allowanceWrites";
import { walletConfig } from "./wagmi";

const publicClient = () => walletConfig.getClient({ chainId: baseSepolia.id });
const observers = new Set<(pair: CheckedPair) => void>();
export function subscribeVerifiedAllowance(
  callback: (pair: CheckedPair) => void,
) {
  observers.add(callback);
  return () => {
    observers.delete(callback);
  };
}

function contextError(message: string) {
  return Object.assign(new Error(message), {
    name: "WalletContextChangedError",
  });
}

function assertConnection(pair: CheckedPair) {
  const connection = getConnection(walletConfig);
  if (
    !connection.isConnected ||
    !connection.address ||
    connection.chainId !== baseSepolia.id ||
    pair.chainId !== baseSepolia.id ||
    connection.address.toLowerCase() !== pair.owner.toLowerCase()
  )
    throw contextError(
      "Account or network changed. Writes require the original owner on Base Sepolia. Start a new confirmation.",
    );
}

async function assertWallet(pair: CheckedPair) {
  assertConnection(pair);
  const client = await getConnectorClient(walletConfig, {
    chainId: baseSepolia.id,
    account: pair.owner,
  });
  const [accounts, chainId] = await Promise.all([
    getAddresses(client),
    getChainId(client),
  ]);
  if (
    chainId !== baseSepolia.id ||
    accounts[0]?.toLowerCase() !== pair.owner.toLowerCase()
  )
    throw contextError(
      "The wallet account or network changed. No transaction will be requested.",
    );
  assertConnection(pair);
  return client;
}

// One in-memory store survives live-page navigation and demo mode. Activity is filtered by scope.
export const liveWriteStore = new AllowanceWrites({
  read: (pair, blockNumber) =>
    readAllowancePair(
      publicClient(),
      {
        chainId: pair.chainId,
        owner: pair.owner,
        key: `${pair.chainId}:${pair.owner.toLowerCase()}`,
      },
      pair.token,
      pair.spender,
      blockNumber,
    ),
  assertWallet: async (pair) => {
    await assertWallet(pair);
  },
  prepare: async (pair, amount) => {
    assertConnection(pair);
    const simulation = await simulateContract(publicClient(), {
      address: pair.token,
      abi: erc20Abi,
      functionName: "approve",
      args: [pair.spender, amount],
      account: pair.owner,
    });
    if (simulation.result !== true)
      throw new Error(
        "approve returned false during simulation. No transaction was requested.",
      );
    return async () => {
      const walletClient = await assertWallet(pair);
      assertConnection(pair);
      // Explicit JSON-RPC account; no private key, signing shortcut, or chain auto-switch.
      return writeContract(walletClient, {
        ...simulation.request,
        account: pair.owner,
        chain: baseSepolia,
      });
    };
  },
  receipt: async (hash) => {
    let replacement = false;
    const receipt = await waitForTransactionReceipt(publicClient(), {
      hash,
      confirmations: 1,
      timeout: 120_000,
      onReplaced: (result) => {
        if (result.reason !== "repriced") replacement = true;
      },
    });
    return {
      hash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      status: replacement ? "replaced" : receipt.status,
    };
  },
  observed: (pair) => observers.forEach((observer) => observer(pair)),
});
