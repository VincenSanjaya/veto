# Veto

**Your wallet. Your permissions.**

A local prototype for understanding ERC20 token allowances. Built with React, TypeScript, Vite, and plain CSS. The original interactive demo remains available without a wallet. A separate live mode supports browser-wallet connection and read-only manual ERC20 allowance checks on Base Sepolia.

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

Demo changes live only in React state in the current browser tab; reloading restores the demo. Simulated updates and revocations do not affect real assets or move sample balances. Live mode connects an actual browser wallet and reads balances and allowances for explicitly selected token/spender pairs. It does not scan the whole wallet, request signatures, submit transactions, or display transaction hashes. Live mode never displays sample approvals, balances, activity, or fabricated summary counts. Live Edit and Revoke remain disabled with a “Coming next” explanation.

Unlimited and above-balance allowances describe spending exposure, including possible future deposits. They do not establish whether a spender is malicious. Veto assigns no safety scores. This prototype does not model spender behavior, token-specific contract rules, or network differences.

Dialogs use native HTML dialog focus containment, Escape dismissal, and accessible labels. Controls support keyboard navigation and visible focus styles. The responsive table scrolls horizontally on small screens so all fields and actions remain accessible.

Typography uses Google Fonts with system sans-serif fallbacks; demo mode remains functional when offline; live reads require a working network connection. No paid services, API keys, WalletConnect project ID, or environment files are required.

## Browser wallets and live mode

The connection layer uses **wagmi 3.7.7**, **viem 2.57.3**, and **TanStack Query 5.104.1**, pinned in `package.json` and the lockfile. TypeScript was upgraded to **5.9.3** to satisfy Wagmi's peer requirement. Implementation follows the current official [Wagmi setup](https://wagmi.sh/react/getting-started), [injected discovery configuration](https://wagmi.sh/react/api/createConfig#multiinjectedproviderdiscovery), [connection hook](https://wagmi.sh/react/api/hooks/useConnection), [network switch hook](https://wagmi.sh/react/api/hooks/useSwitchChain), [Viem chain exports](https://viem.sh/op-stack/chains), and [TanStack Query provider setup](https://tanstack.com/query/latest/docs/framework/react/quick-start).

- Click **Connect wallet**, then choose an installed wallet discovered through EIP-6963. A legacy `window.ethereum` provider is also offered when it does not duplicate a discovered wallet. No wallet installation links or remote connection services are required. Missing-wallet and refresh states explain what to do.
- Approve or decline the account access request in your wallet. Pending requests disable duplicate actions. Veto handles rejection and unavailable/unsupported providers with clear messages. Account access permissions are distinct from token spending approvals; connection requests only account access.
- A successful connection opens **Live wallet · Read-only**. The full actual address, copy-address action, network and chain ID, and Disconnect button appear in the wallet panel. The header address button also opens wallet management. The full address remains selectable if clipboard access is unavailable.
- **Base Sepolia (chain ID 84532)** is the only supported network. Connecting does not supply a target chain ID or switch networks. If connected elsewhere, the wallet's actual chain ID is shown with an explicit **Switch to Base Sepolia** button. Unsupported network names are labeled by chain ID rather than guessed. Switching (and adding the testnet if the wallet needs it) occurs only after that button is clicked; rejection keeps the current network.
- Account changes, chain changes, empty-account events, and provider disconnects are tracked through Wagmi's injected connector. A disconnected wallet stays in the empty live view until you reconnect or choose **Return to demo mode**. No fallback to sample data occurs silently.
- **Return to demo mode** disconnects Veto's wallet connection and reveals your previous local demo state. It does not reset simulated changes. Reset demo remains a separate action available in demo mode.
- Wallet connections are not persisted or automatically restored on page load. Some injected wallets cannot fully remove their account authorization programmatically; Disconnect removes Veto's active connection, and you can also manage site permissions in your wallet. It does not revoke token allowances.

The connection config is in `src/lib/wagmi.ts`, connection/discovery state in `src/hooks/useBrowserWallet.ts`, wallet error messages in `src/lib/walletErrors.ts`, and wallet UI in `src/components/WalletUI.tsx`. The configured HTTP transport uses Viem's built-in Base Sepolia public RPC URL for read-only allowance checks. This public endpoint can be rate-limited or unavailable; failed reads are shown as errors rather than zero balances. Mobile wallet connection requires a browser or in-app browser that injects an Ethereum provider; an ordinary mobile browser without one shows the missing-wallet state.

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

Manual verification with real installed wallets is still required for extension-specific account selection and unlock prompts, approve/reject behavior, pending requests, multiple installed wallets, adding/switching Base Sepolia, wallet-side permission removal and account/network changes, clipboard restrictions, and mobile in-app injection. No real wallet was used during automated verification. No whole-wallet approval scanner, landing page, contract writes, or transaction functionality is implemented.

## Manual allowance checks

In live Overview, **Check allowance** accepts a token contract address and spender address. The owner is always the currently connected account. The scope label is **Manual check · Selected token and spender only.** No token discovery or historical approval scan is performed.

Both addresses must be valid nonzero Ethereum addresses; invalid mixed-case checksums are rejected. Addresses are normalized for deduplication. The token must have deployed bytecode on Base Sepolia at the selected block. A spender may be a contract or an externally owned account; Veto does not require spender bytecode.

The reader in `src/lib/liveAllowances.ts` fetches a fresh block number, verifies token code at that block, and reads `balanceOf(owner)` and `allowance(owner, spender)` using the same explicit block number. It independently attempts `name()`, `symbol()`, and `decimals()` at that block, without depending on Multicall. Every row displays its block number. Reorgs or RPC providers that cannot serve the block can cause failures; rows are point-in-time snapshots, not continuously refreshed values.

Amounts and exposure comparisons use bigint. An allowance of **zero is a successful result**, with no spending permission. **Unlimited** means the raw allowance is exactly `maxUint256` (2^256 − 1); near-maximum values are not labeled unlimited. Above-balance exposure is the strict raw comparison `allowance > balance`. Missing name/symbol show explicit labels. If decimals fail, both values are displayed as **raw units**, with no assumed 18-decimal scaling. Legacy bytes32 metadata is not decoded; unreadable metadata remains unavailable. Contract code and readable ERC20 methods do not prove that a token or spender is trustworthy.

Only successfully checked pairs contribute to summaries. The unique row key contains chain ID, owner, token, and spender. Checking the same pair again or clicking **Refresh** replaces its snapshot rather than adding a duplicate. Failed refreshes preserve the previous successful row at its displayed block and show an error. RPC failures and required-method reverts are never interpreted as zero allowance. Loading, invalid-input, missing-contract, unavailable-RPC, reverted-call, and empty-list states are explicit.

`src/hooks/useManualAllowances.ts` subscribes to wallet state changes. Account/network changes or disconnection immediately clear the session and invalidate pending responses, including switching A → B → A while a read is pending. Results remain available when navigating between Overview and Activity, but are cleared on reload or leaving live mode. The demo's sample state remains independent. Read-only checks do not create Activity entries. No signatures, token approvals, token revokes, transfers, or deployments are requested.

## Test manually

1. Run `npm run dev`, open the local URL, connect an installed browser wallet, and explicitly switch to **Base Sepolia** if necessary. No gas or funded account is needed for these reads.
2. For a known deployed test token, use Circle's Base Sepolia USDC address, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, verified against [Circle's official contract list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Enter your own connected address, or another nonzero address, as spender. This checks only that selected pair; it does not grant access. Click **Check** and verify the full token/spender addresses, fetched metadata, amounts, and block number. A zero balance or allowance is valid.
3. Click **Refresh** and recheck the same pair. Confirm that one row remains and its block snapshot updates. Check another spender to add a separate row. Summaries must describe only these checked pairs.
4. Try a malformed address, zero address, and an EOA as the token: each should show an error without creating a row. An EOA as the spender is accepted. A non-ERC20 contract with code should fail if `balanceOf` or `allowance` is unreadable.
5. Change the wallet account while a check is loading, or switch away from Base Sepolia. Results must clear and late responses must not appear. Checks are disabled off Base Sepolia. Switch back and check again explicitly.
6. Use browser developer tools to block `https://sepolia.base.org/` and check/refresh. Expect an RPC error; existing snapshots remain labeled with their original block. Retry after unblocking. A token lacking readable decimals should show raw integers, never implicitly scaled amounts.
7. Confirm live Edit/Revoke remain unavailable and no wallet signing or spending-permission popup appears during reads. Return to demo mode and verify its simulated edit/revoke/activity/reset interactions still work.

The automated suite additionally exercises values beyond JavaScript's safe integer range, exact maxUint256 detection, zero allowance, missing decimals and independent metadata, pinned block parameters, duplicate refreshes, stale successes and failures, and an actual UI account-change race with a delayed mock RPC response. Wallet/browser and RPC fixtures are synthetic; real extension prompts and deployed-token behavior still require the manual checks above.
