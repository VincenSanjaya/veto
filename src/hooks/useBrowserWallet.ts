import { useEffect, useState } from "react";
import {
  useConnect,
  useConnection,
  useConnectionEffect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import type { Connector } from "wagmi";
import { baseSepolia } from "viem/chains";
import { walletErrorMessage } from "../lib/walletErrors";

export function useBrowserWallet(onConnected: () => void) {
  const connection = useConnection();
  // Also cover connections initiated from the wallet's own permissions UI.
  useConnectionEffect({ onConnect: onConnected });
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [available, setAvailable] = useState<readonly Connector[]>([]);
  const [discovering, setDiscovering] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setDiscovering(true);
    Promise.all(
      connectors.map(async (connector) => {
        try {
          const provider = await connector.getProvider();
          return provider ? { connector, provider } : null;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const installed = results.filter((item) => item !== null);
      // Hide a generic entry only when it points to an already-discovered provider.
      const named = installed.filter(
        (item) => item.connector.id !== "injected",
      );
      const unique = installed.filter(
        (item) =>
          item.connector.id !== "injected" ||
          !named.some((other) => other.provider === item.provider),
      );
      setAvailable(unique.map((item) => item.connector));
      setDiscovering(false);
    });
    return () => {
      cancelled = true;
    };
  }, [connectors, refresh]);

  useEffect(() => {
    setMessage("");
    setCopyMessage("");
  }, [connection.address, connection.chainId, connection.status]);

  const busy =
    connect.isPending || disconnect.isPending || switchChain.isPending;
  function connectWallet(connector: Connector) {
    if (busy) return;
    setMessage("");
    // No chainId: connecting must not implicitly switch the wallet's network.
    connect.mutate(
      { connector },
      {
        onError: (error) => setMessage(walletErrorMessage(error, "connect")),
      },
    );
  }
  function requestSwitch() {
    if (!connection.isConnected || busy) return;
    setMessage("");
    switchChain.mutate(
      { chainId: baseSepolia.id },
      {
        onError: (error) => setMessage(walletErrorMessage(error, "switch")),
      },
    );
  }
  function disconnectWallet(onSuccess?: () => void) {
    if (busy) return;
    setMessage("");
    disconnect.mutate(
      {},
      {
        onSuccess,
        onError: (error) => setMessage(walletErrorMessage(error, "disconnect")),
      },
    );
  }
  async function copyAddress() {
    if (!connection.address) return;
    try {
      await navigator.clipboard.writeText(connection.address);
      setCopyMessage("Address copied.");
    } catch {
      setCopyMessage(
        "Clipboard unavailable. Select and copy the full address below.",
      );
    }
  }

  return {
    ...connection,
    available,
    discovering,
    busy,
    message,
    copyMessage,
    pendingWallet: connect.isPending
      ? connect.variables?.connector?.name
      : undefined,
    connecting:
      connect.isPending || connection.isConnecting || connection.isReconnecting,
    disconnecting: disconnect.isPending,
    switching: switchChain.isPending,
    supported: connection.chainId === baseSepolia.id,
    networkLabel:
      connection.chain?.name ??
      (connection.chainId === undefined
        ? "Network unavailable"
        : `Unsupported network (chain ID ${connection.chainId})`),
    connectWallet,
    requestSwitch,
    disconnectWallet,
    copyAddress,
    refreshWallets: () => {
      setMessage("");
      window.dispatchEvent(new Event("eip6963:requestProvider"));
      setRefresh((value) => value + 1);
    },
  };
}

export type BrowserWallet = ReturnType<typeof useBrowserWallet>;
