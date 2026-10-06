import type { Page } from "@playwright/test";

// EIP-1193/6963 fixture only. These are not real installed wallets or RPC responses.
export async function injectWallet(page: Page, legacy = false) {
  await page.addInitScript(
    ({ legacy }) => {
      const state = {
        accounts: ["0x1234567890123456789012345678901234567890"],
        chain: "0x1",
        reject: false,
        rejectSwitch: false,
        pending: false,
        calls: [] as string[],
      };
      const listeners = new Map<string, Set<(value: unknown) => void>>();
      const emit = (event: string, value: unknown) =>
        listeners.get(event)?.forEach((fn) => fn(value));
      const provider = {
        on(event: string, fn: (value: unknown) => void) {
          if (!listeners.has(event)) listeners.set(event, new Set());
          listeners.get(event)!.add(fn);
        },
        removeListener(event: string, fn: (value: unknown) => void) {
          listeners.get(event)?.delete(fn);
        },
        async request({
          method,
          params,
        }: {
          method: string;
          params?: { chainId: string }[];
        }) {
          state.calls.push(method);
          if (
            method === "eth_requestAccounts" ||
            method === "wallet_requestPermissions"
          ) {
            while (state.pending)
              await new Promise((resolve) => setTimeout(resolve, 20));
            if (state.reject)
              throw Object.assign(new Error("User rejected"), { code: 4001 });
            return method === "wallet_requestPermissions"
              ? [
                  {
                    parentCapability: "eth_accounts",
                    caveats: [
                      {
                        type: "restrictReturnedAccounts",
                        value: state.accounts,
                      },
                    ],
                  },
                ]
              : state.accounts;
          }
          if (method === "eth_accounts") return state.accounts;
          if (method === "eth_chainId") return state.chain;
          if (method === "wallet_switchEthereumChain") {
            if (state.rejectSwitch)
              throw Object.assign(new Error("User rejected"), { code: 4001 });
            state.chain = params![0].chainId;
            emit("chainChanged", state.chain);
            return null;
          }
          if (method === "wallet_revokePermissions") return null;
          throw new Error(`Unexpected wallet method: ${method}`);
        },
      };
      Object.assign(window, { walletFixture: { state, emit, provider } });
      if (legacy) Object.assign(window, { ethereum: provider });
      else {
        Object.assign(window, { ethereum: provider });
        const secondProvider = { ...provider };
        const announce = () => {
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: {
                  uuid: "f58eacdb-d512-4baa-a49a-51dcaf888731",
                  name: "Fixture Wallet",
                  icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
                  rdns: "test.veto.fixture",
                },
                provider,
              },
            }),
          );
          window.dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: {
                  uuid: "f58eacdb-d512-4baa-a49a-51dcaf888732",
                  name: "Second Fixture Wallet",
                  icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
                  rdns: "test.veto.second",
                },
                provider: secondProvider,
              },
            }),
          );
        };
        window.addEventListener("eip6963:requestProvider", announce);
        announce();
      }
    },
    { legacy },
  );
}
