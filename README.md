# Veto

**Your wallet. Your permissions.**

A local prototype for understanding ERC20 token allowances. Built with React, TypeScript, Vite, and plain CSS. The original interactive demo remains available without a wallet. A separate live mode now supports browser-wallet connection on Base Sepolia.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).

```sh
npm run typecheck
npm run build
npm run dev -- --host 0.0.0.0
```

The final command optionally makes the development server accessible from another device on your local network. The production build is written to `dist/`.

## Explore the prototype

- Overview shows active, unlimited, and above-balance approval counts. Click a summary card or filter tab to filter the table. Unlimited allowances are included in the above-balance count.
- Search by token, token name, spender name, or sample address. Click a spender or its details button to inspect the permission in plain language.
- Edit an allowance to a precise non-negative token amount or select unlimited. A zero allowance removes spending permission. Invalid precision and values above the ERC20 uint256 maximum are rejected using bigint arithmetic.
- Revoke requires confirmation and sets the sample allowance to zero. Revoked records stay visible and can be edited again.
- Activity records simulated changes, with before/after amounts and local timestamps. Unchanged values do not create activity entries.
- Reset demo restores the original six approvals and clears activity, search, and filters. On mobile, the reset control appears in the page footer.
- A skippable 1.5-second wordmark entrance appears once per browser session, using sessionStorage. It is omitted when reduced motion is requested. If sessionStorage is blocked, the animation may reappear on reload.

## Limitations and data

All spender names and addresses are synthetic examples, including the sample wallet. Valid-format addresses do not represent verified deployments. Token symbols are familiar examples; balances and allowances are invented. Mock approvals are kept in `src/data/approvals.ts`, independently of the UI. Amount comparison and validation are in `src/lib/allowances.ts`.

Demo changes live only in React state in the current browser tab; reloading restores the demo. Simulated updates and revocations do not affect real assets or move sample balances. Live mode connects an actual browser wallet, but does not fetch token balances, scan approvals, read contracts, request signatures, submit transactions, or display transaction hashes. Live mode never displays sample approvals, balances, activity, or summary counts.

Unlimited and above-balance allowances describe spending exposure, including possible future deposits. They do not establish whether a spender is malicious. Veto assigns no safety scores. This prototype does not model spender behavior, token-specific contract rules, or network differences.

Dialogs use native HTML dialog focus containment, Escape dismissal, and accessible labels. Controls support keyboard navigation and visible focus styles. The responsive table scrolls horizontally on small screens so all fields and actions remain accessible.

Typography uses Google Fonts with system sans-serif fallbacks; the dashboard remains functional when offline. No paid services, API keys, WalletConnect project ID, or environment files are required.

## Browser wallets and live mode

The connection layer uses **wagmi 3.7.7**, **viem 2.57.3**, and **TanStack Query 5.104.1**, pinned in `package.json` and the lockfile. TypeScript was upgraded to **5.9.3** to satisfy Wagmi's peer requirement. Implementation follows the current official [Wagmi setup](https://wagmi.sh/react/getting-started), [injected discovery configuration](https://wagmi.sh/react/api/createConfig#multiinjectedproviderdiscovery), [connection hook](https://wagmi.sh/react/api/hooks/useConnection), [network switch hook](https://wagmi.sh/react/api/hooks/useSwitchChain), [Viem chain exports](https://viem.sh/op-stack/chains), and [TanStack Query provider setup](https://tanstack.com/query/latest/docs/framework/react/quick-start).

- Click **Connect wallet**, then choose an installed wallet discovered through EIP-6963. A legacy `window.ethereum` provider is also offered when it does not duplicate a discovered wallet. No wallet installation links or remote connection services are required. Missing-wallet and refresh states explain what to do.
- Approve or decline the account access request in your wallet. Pending requests disable duplicate actions. Veto handles rejection and unavailable/unsupported providers with clear messages. Account access permissions are distinct from token spending approvals; connection requests only account access.
- A successful connection opens **Live wallet · Connection only**. The full actual address, copy-address action, network and chain ID, and Disconnect button appear in the wallet panel. The header address button also opens wallet management. The full address remains selectable if clipboard access is unavailable.
- **Base Sepolia (chain ID 84532)** is the only supported network. Connecting does not supply a target chain ID or switch networks. If connected elsewhere, the wallet's actual chain ID is shown with an explicit **Switch to Base Sepolia** button. Unsupported network names are labeled by chain ID rather than guessed. Switching (and adding the testnet if the wallet needs it) occurs only after that button is clicked; rejection keeps the current network.
- Account changes, chain changes, empty-account events, and provider disconnects are tracked through Wagmi's injected connector. A disconnected wallet stays in the empty live view until you reconnect or choose **Return to demo mode**. No fallback to sample data occurs silently.
- **Return to demo mode** disconnects Veto's wallet connection and reveals your previous local demo state. It does not reset simulated changes. Reset demo remains a separate action available in demo mode.
- Wallet connections are not persisted or automatically restored on page load. Some injected wallets cannot fully remove their account authorization programmatically; Disconnect removes Veto's active connection, and you can also manage site permissions in your wallet. It does not revoke token allowances.

The connection config is in `src/lib/wagmi.ts`, connection/discovery state in `src/hooks/useBrowserWallet.ts`, wallet error messages in `src/lib/walletErrors.ts`, and wallet UI in `src/components/WalletUI.tsx`. The configured HTTP transport uses Viem's built-in Base Sepolia public RPC URL for future reads; this stage invokes no balance or approval reads. Mobile wallet connection requires a browser or in-app browser that injects an Ethereum provider; an ordinary mobile browser without one shows the missing-wallet state.

## Validation

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm run test:browser
```

Alternatively, with Google Chrome installed:

```sh
PLAYWRIGHT_CHANNEL=chrome npm run test:browser
```

Browser tests use explicitly synthetic EIP-1193/EIP-6963 providers. They exercise discovery and legacy injection, missing wallets, pending/rejected connections, explicit network switching and rejection, account/network changes, empty-account disconnection, copying, Disconnect, return to demo, live/sample isolation, mobile overflow, keyboard dialog focus, and the preserved demo search/filter/edit/revoke/activity/reset flow. They assert that wallet requests are limited to account access, account/chain metadata, explicit network selection, and disconnecting account access; no signing, token permission, or transaction methods are called.

Manual verification with real installed wallets is still required for extension-specific account selection and unlock prompts, approve/reject behavior, pending requests, multiple installed wallets, adding/switching Base Sepolia, wallet-side permission removal and account/network changes, clipboard restrictions, and mobile in-app injection. No real wallet was used during automated verification. No approval scanner, landing page, contract integration, or transaction functionality is implemented.
