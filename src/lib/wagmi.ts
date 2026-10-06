import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { baseSepolia } from "viem/chains";

export const walletConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected({ shimDisconnect: true, unstable_shimAsyncInject: true }),
  ],
  multiInjectedProviderDiscovery: true,
  // Each page load starts disconnected. No saved wallet is reconnected silently.
  storage: null,
  transports: { [baseSepolia.id]: http() },
});

declare module "wagmi" {
  interface Register {
    config: typeof walletConfig;
  }
}
