# Veto

**Your wallet. Your permissions.**

A first local prototype for understanding ERC20 token allowances. Built with React, TypeScript, Vite, and plain CSS. No wallet connection is required.

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

Changes live only in React state in the current browser tab; reloading restores the demo. There are no RPC reads, wallet connections, contract integrations, signatures, blockchain transactions, or transaction hashes. Updates and revocations do not affect real assets or move the sample balances.

Unlimited and above-balance allowances describe spending exposure, including possible future deposits. They do not establish whether a spender is malicious. Veto assigns no safety scores. This prototype does not model spender behavior, token-specific contract rules, or network differences.

Dialogs use native HTML dialog focus containment, Escape dismissal, and accessible labels. Controls support keyboard navigation and visible focus styles. The responsive table scrolls horizontally on small screens so all fields and actions remain accessible.

Typography uses Google Fonts with system sans-serif fallbacks; the dashboard remains functional when offline. No external blockchain services are used.
