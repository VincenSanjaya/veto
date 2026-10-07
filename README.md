# Veto

**Your wallet. Your permissions.**

Veto helps people understand ERC20 spending permissions and choose which allowances to keep, limit, or revoke. This prototype uses React, TypeScript, Vite, plain CSS, wagmi 3.7.7, viem 2.57.3, and TanStack Query 5.104.1. Live functionality supports **Base Sepolia only (chain ID 84532)**. Demo mode works without a wallet.

## Local setup

Use Node.js 20.19+ or 22.12+ and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally http://localhost:5173. No API keys, paid services, WalletConnect project ID, or environment files are required. Therefore no `.env.example` is needed. Reads, simulations, and receipt checks use the public Base Sepolia RPC; transactions use the connected injected wallet. Public RPC availability and rate limits affect live functionality.

```sh
npm run typecheck
npm run build
npm run preview
```

The production build is written to `dist/`. Preview serves that local build. For another device on your local network, use `npm run dev -- --host 0.0.0.0`.

## Routes and landing

- `/` opens the English landing page. Wallet hooks and dashboard providers are not mounted here. Opening it requests no wallet connection, signature, scan, or transaction.
- **Launch app** opens `/app`. **Try demo** opens `/app?mode=demo`, disconnected and in Demo. Fresh dashboard loads always start in Demo; connecting is an explicit action.
- `/app` and `/app/` support direct navigation and refresh under Vite dev/preview. The dashboard footer's **Back to Veto** link returns to `/`.
- A future static host must provide an SPA fallback from `/app` to `index.html`. No deployment configuration or publishing has been performed.

The hero has one skippable 2.8-second liquid-glass entrance per browser session, with no separate logo intro or navigation delay. Two custom WebGL glass volumes frame the headline, followed by subtle pointer/float motion and scroll-linked outward movement. The decorative canvas spans the viewport independently of the padded text container, and its drawing buffer follows wrapper resizing. Below the hero, headings and cards reveal once.

Mobile uses lower rendering resolution and fewer shader steps, with no pointer response. Rendering pauses offscreen and in hidden tabs; unmount removes frames, observers, listeners, and GPU resources. WebGL failure/context loss uses translucent CSS glass with inset highlights and backdrop filtering where supported. Reduced motion shows a static composition and disables entrance, float, pointer, scroll, and section transitions. Restricted session storage can cause entrance replay on reload. The dashboard runs no landing animation.

## Demo guide

The visible **Demo mode · Sample data** label identifies synthetic balances, spenders, and addresses. Mock data lives separately in `src/data/approvals.ts`.

1. Review summary cards; search by token or spender and use All, Unlimited, and Above balance filters.
2. Open permission details for a plain-language explanation.
3. Edit a sample allowance or confirm Revoke. These actions change local state only. The Demo unlimited option does not exist in Live.
4. Inspect simulated Activity, then **Reset demo** to restore the original samples and clear simulated changes.

Demo state is independent of Live. Returning to Demo disconnects Veto and restores the current local samples. Reset demo is a separate action. Reloading resets page-local data. The landing preview is explicitly labeled **Demo · Sample data**.

## Browser wallets and Live

Click **Connect wallet** and choose an installed injected wallet discovered through EIP-6963; a legacy injected provider is offered when it does not duplicate a discovered wallet. Missing-wallet, pending, and rejected requests have explicit states. Ordinary mobile browsers without an injected provider cannot connect; use a supported wallet's browser.

Live shows the actual owner address, copy action, network/chain ID, Disconnect, and Return to demo mode. Connections are not automatically restored on reload. Connecting requests account access, not spending permissions or signatures. Changing an unsupported network requires clicking **Switch to Base Sepolia**; connection alone never switches it. Account/network changes and disconnection invalidate live reads and confirmations.

Disconnect removes Veto's connection; some wallets retain site authorization until removed in their settings. Disconnect does not revoke token allowances. A disconnected Live view remains empty instead of silently showing sample data.

## Manual checks and scoped USDC scan

**Check allowance** accepts a token contract and spender address; the owner is the connected wallet. Both addresses must be valid and nonzero, including valid mixed-case checksums. The token must contain contract code. The spender can be an EOA or a contract. The label **Manual check · Selected token and spender only** describes this scope.

**Scan approvals** discovers spenders without manual input for one token only:

- Base Sepolia USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- The last **50,000 blocks**, inclusive, ending at a captured snapshot; clamped to genesis. The panel displays token, requested range, successful log coverage, snapshot, progress, and discovered/verified counts.
- Owner-filtered ERC20 Approval logs are read sequentially in chunks starting at 2,000 blocks. Range/result-size errors halve chunks down to 125. Each cursor permits at most five attempts with bounded backoff. HTTP requests have a 12-second timeout and no transport retries.
- Repeated events discover one token/spender pair. **Event amounts are never used as current allowance values.** Actual `allowance(owner, spender)` and `balanceOf(owner)` are read at the same snapshot block.
- Cancel ignores late replies and stops further work; an in-flight HTTP request can finish. Successful coverage and verified rows remain explicitly cancelled/partial. Retry starts a new snapshot/range. Failed log coverage or pair verification is never presented as a complete scan.

Manual reads also pin code, balance, allowance, and metadata attempts to one block. Name, symbol, and decimals are attempted independently. Missing decimals displays clearly labeled **raw units** and disables Edit; 18 decimals is never assumed. Amounts use bigint. Zero allowance is a successful result. Unlimited means exactly `maxUint256`; above-balance means strictly `allowance > balance`.

Manual, scanned, and transaction-verified results merge by chain/owner/token/spender, with no duplicate rows. Older responses cannot overwrite a newer snapshot. Each row retains its block label. Summary counts cover **accumulated successfully verified unique pairs in this page session**, not the entire wallet or necessarily just the latest scan. Active rows appear by default; **Show revoked** reveals zero allowances. Refresh rechecks a pair; failure preserves its previous labeled snapshot and shows an error.

Account/network changes, disconnect, and leaving Live clear results and discard stale replies, including A → B → A races. Overview/Activity navigation preserves them. Read-only actions request no signatures or transactions.

## Live Edit, Revoke, and Activity

Check a pair first. Edit is available even at zero allowance when decimals are readable. It accepts explicit finite amounts parsed to bigint, rejecting negative values, scientific notation, excess precision, overflow, and the exact unlimited sentinel. There is no Live unlimited shortcut. Revoke is available only above zero and submits `approve(spender, 0)` even if decimals are unavailable.

The confirmation shows network, owner, token/spender addresses, current and proposed amounts, and testnet gas/spending-permission explanations. Current allowance is re-read before proceeding; changes require confirmation again. Metadata changes require a new amount. Every call is simulated first, and `approve` must return `true`; nonstandard tokens without a boolean return are unsupported.

A nonzero-to-nonzero edit uses **two explicit transactions**:

1. Reset allowance to zero, wait for a successful receipt, and verify the actual zero allowance.
2. Click **Continue** to request the finite amount. The second transaction is never requested automatically. Stopping or rejecting after reset leaves the verified allowance at zero.

The active account, chain, and confirmation-session generation are checked before submission, including after asynchronous wallet queries. All writes are blocked outside Base Sepolia. Duplicate submissions are locked while awaiting the wallet, pending, or unresolved. Definitive completion, rejection, or revert releases the lock.

Statuses distinguish awaiting-wallet, pending, confirmed, rejected, reverted, and confirmation-unknown. A receipt timeout does not establish failure and never automatically resubmits. **Check receipt** observes the existing hash. Successful receipts trigger allowance/balance reads at the receipt block; the displayed result reflects actual values, not the requested amount. Failed verification remains blocked until **Refresh verification** succeeds. Replaced/cancelled transactions do not advance to the second step; repricing follows the replacement hash.

Live Activity shows wallet-returned hashes with Base Sepolia explorer links, scoped to the original owner/network and separate from simulated Activity. Rejected requests without hashes never receive fabricated hashes. An unknown outcome without a reliable hash remains blocked: inspect the wallet/explorer manually. History and locks are in memory only. Overview/Activity and mode changes preserve history, but full-page navigation/reload clears it. **Reloading or leaving the dashboard does not cancel an already submitted transaction.** Check any unresolved transaction before starting another change.

## Prototype limitations

This is a testnet prototype, not an audit or security guarantee. Unlimited and above-balance allowances describe spending exposure; neither proves malicious behavior. Veto assigns no safety score and does not verify spender trustworthiness. Approval transactions change permission, not token balances by themselves.

The scan covers only the displayed USDC block range. Other tokens, older events, nonstandard/missing Approval events, and undetected spenders are outside scope. Empty results do not prove that a wallet has no allowances. Public RPC responses can be incomplete without reporting an error; completeness is not independently established. Snapshots can become stale and one-confirmation receipts remain subject to reorgs. Token-specific rules, RPC retention, or network failures can prevent reads, simulations, or verification. Legacy bytes32 metadata is not decoded.

There are no transfers, message signatures, contract deployment, mainnet support, persisted activity, or whole-wallet scanning. Fonts use Google Fonts with system fallbacks. No private keys or seed phrases are handled. Local environment files, dependencies, build output, and test artifacts are ignored by Git.

## Automated validation

```sh
npx playwright install chromium
npm run test:browser
npm run typecheck
npm run build
```

With Google Chrome already installed, use `PLAYWRIGHT_CHANNEL=chrome npm run test:browser` instead. Browser tests start a local Vite server and use synthetic injected wallets and intercepted RPC responses. No real wallet transactions are executed.

Coverage includes routes/direct refresh, wallet-free landing and Demo, keyboard navigation, mobile overflow and dialogs/Activity, session/reduced-motion/WebGL fallback, full-width canvas resizing, animation cleanup, connection rejection/network switching, Demo/Live isolation, strict address and bigint validation, zero/missing decimals, pinned reads, deduplication, bounded scan failures/partial results/cancel, stale account responses, reset/Continue sequencing, rejection after reset, reverts, insufficient funds, unknown receipts, verification failures, final submission races, and terminal lock release.

## Manual verification still required

1. On real desktop/mobile devices, check text, glass, navbar, horizontal table scrolling, dialog content/actions, Activity, keyboard focus, reduced motion, background pause, and GPU performance. Automated Chromium checks do not establish Safari/WebKit or every GPU's behavior.
2. Visit `/` with installed extensions: no wallet prompt should appear. Launch app waits for Connect; Try demo stays disconnected. Open and refresh `/app` directly, then return using Back to Veto. Repeat these direct-route checks on the eventual host after configuring its SPA fallback.
3. Test real extension discovery/unlock/account selection, connection rejection, copy permissions, explicit network switching/rejection, disconnect, and account/network changes. Wallet-specific prompts and mobile injection require actual devices/extensions.
4. On Base Sepolia, manually check USDC and a nonzero spender (your address is valid). No gas is needed for reads. Verify amounts/block, zero results, duplicate refresh, invalid addresses, and EOA-token rejection. Scan a wallet with a known recent USDC event; compare actual snapshot allowance, toggle Show revoked, cancel/retry, and change accounts mid-scan. Block the public RPC in browser tools to inspect failures. Real RPC retention/range/completeness behavior remains infrastructure-dependent.
5. Only if you choose to perform real testnet writes, use test assets and testnet ETH. Inspect all confirmation addresses, reject a request, then verify zero-to-finite, reset/explicit Continue, cancellation after reset, and Revoke. Compare actual explorer receipts and onchain allowance with Activity/summary. Check insufficient gas, replacement, and delayed receipts; do not retry an unknown transaction blindly. Deployed-token behavior and real wallet transaction prompts are not established by mocked tests.

No deployment or push is part of this checkpoint.
