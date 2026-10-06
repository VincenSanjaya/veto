import { createPublicClient, http, parseAbiItem } from "viem";
import { getBlockNumber, getLogs } from "viem/actions";
import { baseSepolia } from "viem/chains";
import { SCAN_TOKEN } from "./approvalScan";
import type { ScanDependencies } from "./approvalScan";
import { readAllowancePair } from "./liveAllowances";

// Same public Base Sepolia endpoint; retries are bounded by the scanner, not the transport.
const client = createPublicClient({
  chain: baseSepolia,
  transport: http(undefined, { retryCount: 0, timeout: 12_000 }),
});
const approval = parseAbiItem(
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
);
export const scanReader: Omit<ScanDependencies, "accept"> = {
  block: () => getBlockNumber(client, { cacheTime: 0 }),
  logs: async (scope, fromBlock, toBlock) => {
    const logs = await getLogs(client, {
      address: SCAN_TOKEN,
      event: approval,
      args: { owner: scope.owner },
      fromBlock,
      toBlock,
      strict: true,
    });
    return logs.filter((log) => !log.removed).map((log) => log.args);
  },
  read: (scope, spender, block) =>
    readAllowancePair(client, scope, SCAN_TOKEN, spender, block),
};
