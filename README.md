# Veto

**Your wallet. Your permissions.**

A local prototype for understanding ERC20 token allowances. Built with React, TypeScript, Vite, and plain CSS. The original interactive demo remains available without a wallet. A separate live mode supports browser-wallet connection, a limited USDC Approval-event scan, manual ERC20 allowance checks, and explicitly confirmed allowance changes on Base Sepolia only.

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

## Explore demo mode

- Overview shows active, unlimited, and above-balance approval counts. Click a summary card or filter tab to filter the table. Unlimited allowances are included in the above-balance count.
- Search by token, token name, spender name, or sample address. Click a spender or its details button to inspect the permission in plain language.
- Edit an allowance to a precise non-negative token amount or select unlimited. A zero allowance removes spending permission. Invalid precision and values above the ERC20 uint256 maximum are rejected using bigint arithmetic.
- Revoke requires confirmation and sets the sample allowance to zero. Revoked records stay visible and can be edited again.
- Activity records simulated changes, with before/after amounts and local timestamps. Unchanged values do not create activity entries.
- Reset demo restores the original six approvals and clears activity, search, and filters. On mobile, the reset control appears in the page footer.
- A skippable 1.5-second wordmark entrance appears once per browser session, using sessionStorage. It is omitted when reduced motion is requested. If sessionStorage is blocked, the animation may reappear on reload.

## Limitations and data

All spender names and addresses are synthetic examples, including the sample wallet. Valid-format addresses do not represent verified deployments. Token symbols are familiar examples; balances and allowances are invented. Mock approvals are kept in `src/data/approvals.ts`, independently of the UI. Amount comparison and validation are in `src/lib/allowances.ts`.

Demo changes live only in React state in the current browser tab; reloading restores the demo. Simulated updates and revocations do not affect real assets or move sample balances. Live mode connects an actual browser wallet and reads balances and allowances for explicitly selected token/spender pairs. It does not scan the whole wallet. Live Edit and Revoke request real testnet approval transactions only after explicit confirmation, and live Activity displays actual wallet-returned transaction hashes. Live mode never displays sample approvals, balances, activity, or fabricated summary counts.

Unlimited and above-balance allowances describe spending exposure, including possible future deposits. They do not establish whether a spender is malicious. Veto assigns no safety scores. This prototype does not model spender behavior, token-specific contract rules, or network differences.

Dialogs use native HTML dialog focus containment, Escape dismissal, and accessible labels. Controls support keyboard navigation and visible focus styles. The responsive table scrolls horizontally on small screens so all fields and actions remain accessible.

Typography uses Google Fonts with system sans-serif fallbacks; demo mode remains functional when offline; live reads require a working network connection. No paid services, API keys, WalletConnect project ID, or environment files are required.

## Browser wallets and live mode

The connection layer uses **wagmi 3.7.7**, **viem 2.57.3**, and **TanStack Query 5.104.1**, pinned in `package.json` and the lockfile. TypeScript was upgraded to **5.9.3** to satisfy Wagmi's peer requirement. Implementation follows the current official [Wagmi setup](https://wagmi.sh/react/getting-started), [injected discovery configuration](https://wagmi.sh/react/api/createConfig#multiinjectedproviderdiscovery), [connection hook](https://wagmi.sh/react/api/hooks/useConnection), [network switch hook](https://wagmi.sh/react/api/hooks/useSwitchChain), [Viem chain exports](https://viem.sh/op-stack/chains), and [TanStack Query provider setup](https://tanstack.com/query/latest/docs/framework/react/quick-start).

- Click **Connect wallet**, then choose an installed wallet discovered through EIP-6963. A legacy `window.ethereum` provider is also offered when it does not duplicate a discovered wallet. No wallet installation links or remote connection services are required. Missing-wallet and refresh states explain what to do.
- Approve or decline the account access request in your wallet. Pending requests disable duplicate actions. Veto handles rejection and unavailable/unsupported providers with clear messages. Account access permissions are distinct from token spending approvals; connection requests only account access.
- A successful connection opens **Live wallet · Base Sepolia**. The full actual address, copy-address action, network and chain ID, and Disconnect button appear in the wallet panel. The header address button also opens wallet management. The full address remains selectable if clipboard access is unavailable.
- **Base Sepolia (chain ID 84532)** is the only supported network. Connecting does not supply a target chain ID or switch networks. If connected elsewhere, the wallet's actual chain ID is shown with an explicit **Switch to Base Sepolia** button. Unsupported network names are labeled by chain ID rather than guessed. Switching (and adding the testnet if the wallet needs it) occurs only after that button is clicked; rejection keeps the current network.
- Account changes, chain changes, empty-account events, and provider disconnects are tracked through Wagmi's injected connector. A disconnected wallet stays in the empty live view until you reconnect or choose **Return to demo mode**. No fallback to sample data occurs silently.
- **Return to demo mode** disconnects Veto's wallet connection and reveals your previous local demo state. It does not reset simulated changes. Reset demo remains a separate action available in demo mode.
- Wallet connections are not persisted or automatically restored on page load. Some injected wallets cannot fully remove their account authorization programmatically; Disconnect removes Veto's active connection, and you can also manage site permissions in your wallet. It does not revoke token allowances.

The connection config is in `src/lib/wagmi.ts`, connection/discovery state in `src/hooks/useBrowserWallet.ts`, wallet error messages in `src/lib/walletErrors.ts`, and wallet UI in `src/components/WalletUI.tsx`. The configured HTTP transport uses Viem's built-in Base Sepolia public RPC URL for reads, simulations, and receipt observation. Transaction submission uses the connected injected wallet. This public endpoint can be rate-limited or unavailable; failed reads are shown as errors rather than zero balances. Mobile wallet connection requires a browser or in-app browser that injects an Ethereum provider; an ordinary mobile browser without one shows the missing-wallet state.

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

Browser tests use explicitly synthetic EIP-1193/EIP-6963 providers. They exercise discovery and legacy injection, missing wallets, pending/rejected connections, explicit network switching and rejection, account/network changes, empty-account disconnection, copying, Disconnect, return to demo, live/sample isolation, mobile overflow, keyboard dialog focus, and the preserved demo search/filter/edit/revoke/activity/reset flow. Connection and read-only tests assert that no signing or transaction methods are called. Write tests use a synthetic transaction provider and intercepted RPC responses; no real transaction is sent. Scan tests cover owner/token-scoped logs, chunk reduction and bounded RPC failure, deduplication with manual results, current allowances differing from event amounts, zero allowances, partial verification, cancellation, retries, stale account/network responses, and mobile layout. Write tests exercise strict bigint parsing, updated-snapshot reconfirmation, reset/Continue sequencing, cancellation and rejection after reset, false simulation results, reverted receipts, actual-result mismatches, receipt timeouts without resubmission, failed verification, insufficient gas funds, duplicate clicks, and account/network changes before and after submission.

Manual verification with real installed wallets is still required for extension-specific account selection and unlock prompts, approve/reject behavior, pending requests, multiple installed wallets, adding/switching Base Sepolia, wallet-side permission removal and account/network changes, clipboard restrictions, and mobile in-app injection. No real wallet was used and no real transaction was executed during automated verification. No whole-wallet approval scanner, landing page, transfers, message signatures, or contract deployment is implemented.

## Manual allowance checks

In live Overview, **Check allowance** accepts a token contract address and spender address. The owner is always the currently connected account. The scope label is **Manual check · Selected token and spender only.** This form performs no token discovery or event scan; the separate Scan approvals panel discovers USDC spenders within its displayed range.

Both addresses must be valid nonzero Ethereum addresses; invalid mixed-case checksums are rejected. Addresses are normalized for deduplication. The token must have deployed bytecode on Base Sepolia at the selected block. A spender may be a contract or an externally owned account; Veto does not require spender bytecode.

The reader in `src/lib/liveAllowances.ts` fetches a fresh block number, verifies token code at that block, and reads `balanceOf(owner)` and `allowance(owner, spender)` using the same explicit block number. It independently attempts `name()`, `symbol()`, and `decimals()` at that block, without depending on Multicall. Every row displays its block number. Reorgs or RPC providers that cannot serve the block can cause failures; rows are point-in-time snapshots, not continuously refreshed values.

Amounts and exposure comparisons use bigint. An allowance of **zero is a successful result**, with no spending permission. **Unlimited** means the raw allowance is exactly `maxUint256` (2^256 − 1); near-maximum values are not labeled unlimited. Above-balance exposure is the strict raw comparison `allowance > balance`. Missing name/symbol show explicit labels. If decimals fail, both values are displayed as **raw units**, with no assumed 18-decimal scaling. Legacy bytes32 metadata is not decoded; unreadable metadata remains unavailable. Contract code and readable ERC20 methods do not prove that a token or spender is trustworthy.

Only successfully checked pairs contribute to summaries. The unique row key contains chain ID, owner, token, and spender. Checking the same pair again or clicking **Refresh** replaces its snapshot rather than adding a duplicate. Failed refreshes preserve the previous successful row at its displayed block and show an error. RPC failures and required-method reverts are never interpreted as zero allowance. Loading, invalid-input, missing-contract, unavailable-RPC, reverted-call, and empty-list states are explicit.

`src/hooks/useManualAllowances.ts` subscribes to wallet state changes. Account/network changes or disconnection immediately clear the session and invalidate pending responses, including switching A → B → A while a read is pending. Results remain available when navigating between Overview and Activity, but are cleared on reload or leaving live mode. The demo's sample state remains independent. Read-only checks do not create Activity entries or request wallet signatures/transactions. Edit and Revoke are separate, explicitly confirmed actions described below.

## Test manually

1. Run `npm run dev`, open the local URL, connect an installed browser wallet, and explicitly switch to **Base Sepolia** if necessary. No gas or funded account is needed for these reads.
2. For a known deployed test token, use Circle's Base Sepolia USDC address, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`, verified against [Circle's official contract list](https://developers.circle.com/stablecoins/usdc-contract-addresses). Enter your own connected address, or another nonzero address, as spender. This checks only that selected pair; it does not grant access. Click **Check** and verify the full token/spender addresses, fetched metadata, amounts, and block number. A zero balance or allowance is valid.
3. Click **Refresh** and recheck the same pair. Confirm that one row remains and its block snapshot updates. Check another spender to add a separate row. Summaries must describe only these checked pairs.
4. Try a malformed address, zero address, and an EOA as the token: each should show an error without creating a row. An EOA as the spender is accepted. A non-ERC20 contract with code should fail if `balanceOf` or `allowance` is unreadable.
5. Change the wallet account while a check is loading, or switch away from Base Sepolia. Results must clear and late responses must not appear. Checks are disabled off Base Sepolia. Switch back and check again explicitly.
6. Use browser developer tools to block `https://sepolia.base.org/` and check/refresh. Expect an RPC error; existing snapshots remain labeled with their original block. Retry after unblocking. A token lacking readable decimals should show raw integers, never implicitly scaled amounts.
7. Confirm no wallet signing or spending-permission popup appears during reads. Edit is available even with zero allowance when decimals are readable; Revoke is available only with positive allowance. Missing decimals disables Edit, but raw zero can still be submitted through Revoke. Return to demo mode and verify its simulated edit/revoke/activity/reset interactions still work.

The automated suite additionally exercises values beyond JavaScript's safe integer range, exact maxUint256 detection, zero allowance, missing decimals and independent metadata, pinned block parameters, duplicate refreshes, stale successes and failures, and an actual UI account-change race with a delayed mock RPC response. Wallet/browser and RPC fixtures are synthetic; real extension prompts and deployed-token behavior still require the manual checks above.


## Live allowance changes

Writes use the existing wagmi/viem configuration and the installed viem 2.x APIs: [simulateContract](https://viem.sh/docs/contract/simulateContract), [writeContract](https://viem.sh/docs/contract/writeContract), and [waitForTransactionReceipt](https://viem.sh/docs/actions/public/waitForTransactionReceipt). `src/lib/allowanceWrites.ts` owns the transaction state machine; `src/lib/liveWriteStore.ts` supplies the wallet/RPC adapters. No private keys, seed phrases, or signing services are used.

- Check a token/spender pair first. Edit requires readable decimals and accepts an explicit finite amount, parsed to bigint without rounding. Negative values, scientific notation, excess precision, and uint256 overflow are rejected. The exact maxUint256 sentinel is also rejected; there is no live unlimited shortcut. Revoke calls `approve(spender, 0)` and does not require decimals.
- Review the Base Sepolia network, owner, full token/spender addresses, snapshot/current allowance, and proposed allowance. Changing allowance changes spending permission and costs testnet ETH for gas. Connecting or checking alone grants no spending permission.
- Confirmation re-reads the allowance. A changed snapshot updates the dialog and requires another confirmation. Changed/missing decimals requires a new amount. Each transaction is simulated first; an `approve` result other than `true` blocks submission. Tokens with nonstandard missing return values are not supported by this strict approval flow.
- A nonzero-to-nonzero change uses two separate transactions: reset to zero, then—only after a successful receipt and verified zero—click **Continue** to request the finite amount. The second transaction is never requested automatically. Stopping or rejecting after reset leaves the last verified allowance at zero. Zero-to-positive and positive-to-zero changes need one transaction; unchanged amounts need none.
- The active wallet account and chain are checked before every submission, including directly querying the injected provider. Writes are blocked outside Base Sepolia. Account/network changes invalidate the confirmation; submitted transactions remain associated with their original account and network.
- Status distinguishes awaiting-wallet, pending, confirmed, rejected, reverted, and confirmation-unknown. A receipt timeout does not prove failure and never triggers a resend. **Check receipt** in Activity observes the existing hash only. Confirmed receipts are followed by allowance/balance reads pinned to the receipt block; the actual result is displayed even if it differs from the requested amount. Failed verification blocks further writes until **Refresh verification** succeeds.
- Pending or unresolved transactions block duplicate submissions, including after switching accounts or returning to demo mode. A wallet error without a reliable hash/outcome also blocks further writes; check the wallet/explorer manually. Replaced/cancelled transactions do not trigger the next step. A repriced transaction uses its confirmed replacement hash.

Live Activity is separate from demo activity and filtered by owner and chain. Actual wallet-returned hashes link to the Base Sepolia explorer. Rejected requests without a hash show no fabricated hash. History is in memory only: navigation and mode changes preserve it, but reloading clears it. A reload does not cancel a pending blockchain transaction; inspect your wallet/explorer before starting another change if confirmation was unknown. Receipt-block snapshots can later change, and one confirmation is subject to testnet reorgs. Public RPC availability and token-specific rules can prevent simulation or verification. No safety score or spender trust claim is inferred.

## Manually verify writes (optional real testnet transactions)

Automated verification does not exercise a real wallet's transaction prompt. If you choose to test manually, use Base Sepolia test assets and enough Base Sepolia ETH for gas. Real deployed-token behavior, extension prompts, gas estimation, replacements, and live receipts still require this verification.

1. Connect on Base Sepolia and check a deployed ERC20/spender pair. From zero allowance, Edit to a small finite amount. Verify all confirmation addresses and the wallet's network/account, then approve or reject the wallet request. After success, compare the actual balance/allowance and receipt block with the explorer. Activity must contain the actual hash.
2. Change a positive allowance to another positive finite amount. Confirm the reset only; verify the first transaction is `approve(spender, 0)` and zero is read back. No second wallet prompt should appear until **Continue**. Stop after reset, or reject the second request, and verify the zero result remains visible. Repeat explicitly and Continue to complete both steps.
3. Revoke a positive allowance; verify the actual allowance becomes zero. Edit should remain available at zero, and Revoke should become disabled. Check invalid amount formats and excess precision without sending a transaction.
4. Change the allowance elsewhere between review and confirmation. Veto must update the snapshot and require confirmation again. Switch account/network during preparation; no stale confirmation may submit for a different owner or chain.
5. Reject a request or test an account without testnet gas funds. Verify the outcome is explicit and no second step starts. During a submitted transaction, hide the dialog and inspect Activity. Block the public RPC to test unknown receipt/failed verification; restore it and use the read-only receipt/verification action, never an automatic resend.
6. Switch accounts and networks. Manual results clear, and Activity shows only the relevant account/network. Return to demo and verify simulated changes remain separate from live transactions.


## Scan approvals: limited USDC scope

The Live Overview scan supports **Base Sepolia only (84532)** and one fixed token: USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. It uses the official viem 2.x [getLogs API](https://viem.sh/docs/actions/public/getLogs) with the token address and indexed Approval owner filter. No wallet signature or transaction is requested by scanning.

Click **Scan approvals** to capture a fresh block number and scan the last **50,000 blocks**, inclusive (`snapshot − 49,999` through snapshot, clamped to genesis). The panel displays the token, requested range, successful contiguous log coverage, snapshot block, discovered/verified counts, and progress. This is a selected token/range scan, **not a whole-wallet scan**. Other tokens, older events, permissions whose contracts do not emit the standard Approval event, and undiscoverable spenders are outside its scope. Empty event results do not establish that the wallet has no allowances.

Logs are fetched sequentially in chunks initially capped at **2,000 blocks**. Range/result-size limit errors halve the chunk, down to **125 blocks**. Each cursor has at most **five attempts** (four retries), with a small bounded backoff. The scanner's public HTTP transport has **zero automatic retries** and a **12-second request timeout**. Persistent log errors stop scanning; the range that actually succeeded is retained. Log coverage and pair verification are reported separately: full log coverage with a failed allowance read is still a **partial** result. Failed block lookup or failure before any logs succeed is explicitly failed. RPC providers can truncate results without reporting an error; this client cannot independently prove provider completeness.

Event amounts are used **only to discover unique token/spender pairs**, never as current permission values. Repeated events, including zero/revoked events, are deduplicated. Each discovered pair's actual `allowance(owner, spender)` and `balanceOf(owner)` is read at the **same captured snapshot block**, together with independent metadata attempts. Only successfully verified rows enter the table and summary. Missing decimals keeps raw-unit display and disables Edit; Revoke still works for positive allowances.

The table merges manual checks, scan checks, and confirmed transaction verification using the chain/owner/token/spender key. Summaries count the unique verified rows, including zero rows in the verified-pair total; active counts require a positive allowance. **Show revoked** reveals zero allowances; positive allowances are shown by default. Rows can come from manual checks or previous scans and retain their individual block labels. A new scan or partial retry does not erase older verified rows, and an older scan response cannot overwrite a newer manual or transaction snapshot. Summary counts therefore describe the accumulated verified pairs in this page session, not just the newest scan or the entire wallet.

**Cancel scan** stops further processing and ignores late responses; an HTTP request already in flight may finish. Already verified rows and successful log coverage remain, labeled cancelled/partial. **Retry scan** starts a fresh snapshot/range rather than assuming an old scan can resume consistently. Account/network changes and disconnect invalidate the run, clear the live results and scan coverage, and discard late replies even after A → B → A. Navigation to Activity preserves scan state; reload/return to demo clears it. Scanning is disabled on unsupported networks.

Scanned rows use the existing real Edit/Revoke confirmation and reset/Continue workflow. After a confirmed transaction, the related pair and summary are refreshed from actual allowance/balance reads at its receipt block. The table never assumes a requested allowance was applied. If a snapshot becomes zero after revoke/reset, its row hides unless Show revoked is enabled; an open reset/Continue dialog remains available. No new transaction is submitted by scanning or refreshing.

## Test the scan manually

1. Run `npm run dev`, connect an injected wallet, and explicitly switch to Base Sepolia. Scanning itself requires no testnet gas funds. In Live Overview, click **Scan approvals** without filling in a spender. Verify the USDC address, inclusive range, snapshot block, and progress.
2. Use a wallet with a known USDC Approval event within the displayed range. Compare the discovered spender with its event, then compare the current allowance and balance at the displayed snapshot block. A spender may have an event amount that differs from its current allowance. A wallet without recent events should show the selected-range empty explanation, not a wallet-wide “no approvals” claim.
3. Toggle **Show revoked** to inspect pairs whose current allowance is zero. Confirm Edit remains available when decimals are readable and Revoke is disabled at zero. Manually check the same token/spender; it must replace the snapshot without adding a duplicate or inflating summary counts.
4. Cancel during logs/verification. Expect cancelled partial coverage and no further inserted results. Retry explicitly and verify the new snapshot/range. Block `https://sepolia.base.org/` in browser tools to exercise bounded failure; restore it and retry. Smaller range-limit fallback is covered by the automated synthetic RPC test.
5. Change wallet accounts or leave Base Sepolia mid-scan. Results and coverage must clear, and late results must not reappear. Switching back requires an explicit fresh scan. No signing/transaction wallet prompt should appear during these reads.
6. If you choose to use real testnet transactions, edit/revoke a discovered pair through the existing confirmation flow. Verify the receipt hash, actual allowance, balance, and summary update. After a revoke, enable Show revoked to see its zero snapshot. Otherwise use the automated mocked write tests; no real transactions were executed for this implementation.

The new automated scan suite uses only synthetic events, wallets, and intercepted RPC responses. Real RPC retention/range limits, provider completeness, deployed USDC behavior, wallet extension prompts, and testnet reorgs remain manual/infrastructure limitations.
