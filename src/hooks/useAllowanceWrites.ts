import { useEffect, useSyncExternalStore } from "react";
import { useConnection } from "wagmi";
import { getConnection } from "wagmi/actions";
import { walletConfig } from "../lib/wagmi";
import { walletScope } from "../lib/liveAllowances";
import { liveWriteStore } from "../lib/liveWriteStore";
import { unresolvedTransaction } from "../lib/allowanceWrites";

export function useAllowanceWrites() {
  const connection = useConnection();
  const snapshot = useSyncExternalStore(
    liveWriteStore.subscribe,
    liveWriteStore.getSnapshot,
  );
  useEffect(() => {
    const update = () => {
      const current = getConnection(walletConfig);
      liveWriteStore.setScope(
        walletScope(current.address, current.chainId, current.isConnected),
      );
    };
    update();
    const unsubscribe = walletConfig.subscribe((state) => state, update);
    return () => {
      unsubscribe();
      liveWriteStore.setScope(null);
    };
  }, []);
  const scope = walletScope(
    connection.address,
    connection.chainId,
    connection.isConnected,
  );
  return {
    ...snapshot,
    dialog: snapshot.scope?.key === scope?.key ? snapshot.dialog : null,
    activity: snapshot.activity.filter(
      (entry) => entry.scopeKey === scope?.key,
    ),
    blocked: liveWriteStore.isBlocked(),
    blockers: snapshot.activity.filter(unresolvedTransaction),
    store: liveWriteStore,
  };
}
