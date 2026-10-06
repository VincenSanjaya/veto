import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useClient, useConnection } from "wagmi";
import { getConnection } from "wagmi/actions";
import { baseSepolia } from "viem/chains";
import { walletConfig } from "../lib/wagmi";
import { subscribeVerifiedAllowance } from "../lib/liveWriteStore";
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

  useEffect(() => {
    const update = () => {
      const current = getConnection(walletConfig);
      session.setScope(
        walletScope(current.address, current.chainId, current.isConnected),
      );
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
    };
  }, [session]);

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
    check: (token: string, spender: string) => session.check(token, spender),
  };
}
