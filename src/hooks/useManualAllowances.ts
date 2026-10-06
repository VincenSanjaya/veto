import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useClient, useConnection } from "wagmi";
import { getConnection } from "wagmi/actions";
import { baseSepolia } from "viem/chains";
import { walletConfig } from "../lib/wagmi";
import { subscribeVerifiedAllowance } from "../lib/liveWriteStore";
import { ApprovalScan } from "../lib/approvalScan";
import { scanReader } from "../lib/scanClient";
import {
  AllowanceSession,
  readAllowancePair,
  walletScope,
} from "../lib/liveAllowances";

export function useManualAllowances() {
  const client = useClient({ chainId: baseSepolia.id });
  const connection = useConnection();
  const session = useMemo(
    () =>
      new AllowanceSession(async (scope, token, spender) => {
        if (!client)
          throw new Error("Base Sepolia RPC client is unavailable. Try again.");
        return readAllowancePair(client, scope, token, spender);
      }),
    [client],
  );
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const scanner = useMemo(
    () =>
      new ApprovalScan({
        ...scanReader,
        accept: (pair) => session.accept(pair),
      }),
    [session],
  );
  const scan = useSyncExternalStore(scanner.subscribe, scanner.getSnapshot);

  useEffect(() => {
    const update = () => {
      const current = getConnection(walletConfig);
      const scope = walletScope(
        current.address,
        current.chainId,
        current.isConnected,
      );
      session.setScope(scope);
      scanner.setScope(scope);
    };
    update();
    // Invalidate synchronously on wallet state updates, before late RPC promises resolve.
    const unsubscribe = walletConfig.subscribe((state) => state, update);
    const unsubscribeVerified = subscribeVerifiedAllowance((result) =>
      session.accept(result),
    );
    return () => {
      unsubscribe();
      unsubscribeVerified();
      session.setScope(null);
      scanner.setScope(null);
    };
  }, [session, scanner]);

  const current = walletScope(
    connection.address,
    connection.chainId,
    connection.isConnected,
  );
  const matching = current?.key === snapshot.scope?.key;
  return {
    results: matching ? snapshot.results : [],
    pending: matching && snapshot.pending,
    error: matching ? snapshot.error : "",
    message: matching ? snapshot.message : "",
    enabled: Boolean(current && matching),
    scan: matching
      ? scan
      : {
          ...scan,
          status: "idle" as const,
          from: null,
          to: null,
          coveredTo: null,
          message: "",
          error: "",
          discovered: 0,
          verified: 0,
          failedPairs: 0,
        },
    startScan: () => scanner.start(),
    cancelScan: () => scanner.cancel(),
    check: (token: string, spender: string) => session.check(token, spender),
  };
}
