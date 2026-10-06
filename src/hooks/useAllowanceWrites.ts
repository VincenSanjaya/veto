import { useEffect, useSyncExternalStore } from "react";
import { useConnection } from "wagmi";
import { getConnection } from "wagmi/actions";
import { walletConfig } from "../lib/wagmi";
import { walletScope } from "../lib/liveAllowances";
import { liveWriteStore } from "../lib/liveWriteStore";

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
    return walletConfig.subscribe((state) => state, update);
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
    store: liveWriteStore,
  };
}
