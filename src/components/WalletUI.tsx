import { ArrowRight, Copy, LogOut, RefreshCw, Wallet } from "lucide-react";
import type { BrowserWallet } from "../hooks/useBrowserWallet";
import { shortAddress } from "../lib/allowances";

export function WalletButton({
  wallet,
  open,
}: {
  wallet: BrowserWallet;
  open: () => void;
}) {
  return (
    <button className="connect-wallet-button" onClick={open}>
      <Wallet size={14} />
      {wallet.isConnected && wallet.address
        ? shortAddress(wallet.address)
        : wallet.connecting
          ? "Connecting…"
          : "Connect wallet"}
    </button>
  );
}

export function WalletPicker({ wallet }: { wallet: BrowserWallet }) {
  return (
    <>
      <p className="dialog-description">
        Choose an installed browser wallet. Connecting shares your account
        address; it does not request token spending permissions.
      </p>
      <div
        className="wallet-options"
        aria-busy={wallet.discovering || wallet.connecting}
      >
        {wallet.discovering ? (
          <p className="wallet-helper" role="status">
            Looking for browser wallets…
          </p>
        ) : wallet.available.length === 0 ? (
          <div className="wallet-missing">
            <Wallet size={24} />
            <h3>No browser wallet found</h3>
            <p>
              Install or enable an Ethereum-compatible browser wallet extension,
              then refresh this list. Mobile browsers need an injected wallet
              provider.
            </p>
          </div>
        ) : (
          wallet.available.map((connector) => (
            <button
              className="wallet-option"
              key={connector.uid}
              disabled={wallet.busy}
              onClick={() => wallet.connectWallet(connector)}
            >
              <Wallet size={19} />
              <span>{connector.name}</span>
              <ArrowRight size={16} />
            </button>
          ))
        )}
      </div>
      {wallet.connecting && (
        <p className="wallet-helper" role="status">
          Waiting for {wallet.pendingWallet ?? "your wallet"}. Open it to
          approve or decline the connection request.
        </p>
      )}
      {wallet.message && (
        <p className="form-error" role="alert">
          {wallet.message}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="secondary-button"
          disabled={wallet.busy || wallet.discovering}
          onClick={wallet.refreshWallets}
        >
          <RefreshCw size={14} /> Refresh wallets
        </button>
      </div>
    </>
  );
}

export function WalletIdentity({ wallet }: { wallet: BrowserWallet }) {
  return (
    <>
      <div className="live-wallet-identity">
        <span className="empty-icon">
          <Wallet size={25} />
        </span>
        <div>
          <span className="eyebrow">
            {wallet.connector?.name ?? "BROWSER WALLET"}
          </span>
          <h3>Connected wallet</h3>
          <p className="full-wallet-address">{wallet.address}</p>
        </div>
      </div>
      <dl className="detail-data wallet-network">
        <div>
          <dt>Current network</dt>
          <dd>{wallet.networkLabel}</dd>
        </div>
        <div>
          <dt>Chain ID</dt>
          <dd>{wallet.chainId ?? "Unavailable"}</dd>
        </div>
        <div>
          <dt>Supported network</dt>
          <dd>Base Sepolia · Testnet</dd>
        </div>
      </dl>
      <div className="wallet-management">
        <button className="secondary-button" onClick={wallet.copyAddress}>
          <Copy size={14} /> Copy address
        </button>
        <button
          className="secondary-button"
          disabled={wallet.busy}
          onClick={() => wallet.disconnectWallet()}
        >
          <LogOut size={14} />{" "}
          {wallet.disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
      {wallet.copyMessage && (
        <p className="wallet-helper" role="status">
          {wallet.copyMessage}
        </p>
      )}
      {!wallet.supported && (
        <div className="network-warning">
          <p>
            Veto supports Base Sepolia. Your wallet is currently on{" "}
            {wallet.networkLabel}. Switch when you’re ready.
          </p>
          <button
            className="primary-button"
            disabled={wallet.busy}
            onClick={wallet.requestSwitch}
          >
            {wallet.switching
              ? "Waiting for wallet…"
              : "Switch to Base Sepolia"}
          </button>
        </div>
      )}
      {wallet.message && (
        <p className="form-error" role="alert">
          {wallet.message}
        </p>
      )}
    </>
  );
}

export function LiveWalletView({
  wallet,
  page,
  returnToDemo,
  open,
}: {
  wallet: BrowserWallet;
  page: "overview" | "activity";
  returnToDemo: () => void;
  open: () => void;
}) {
  return (
    <section
      className="activity-section live-wallet-section"
      aria-label="Live wallet"
    >
      <div className="section-title">
        <div>
          <h2>
            {page === "overview" ? "Wallet permissions" : "Wallet activity"}
          </h2>
          <p>Live wallet mode · Base Sepolia</p>
        </div>
        <span className="sample-note">Connection only</span>
      </div>
      {wallet.isConnected ? (
        <WalletIdentity wallet={wallet} />
      ) : (
        <div className="empty-state">
          <Wallet size={30} />
          <h3>
            {wallet.connecting
              ? "Connecting to your wallet…"
              : "Wallet disconnected"}
          </h3>
          <p>
            {wallet.connecting
              ? "Open your wallet to approve or decline the request."
              : "Connect a browser wallet or explicitly return to the demo."}
          </p>
          <button className="primary-button" onClick={open}>
            {wallet.connecting ? "View connection request" : "Connect wallet"}
          </button>
        </div>
      )}
      <div className="scan-placeholder">
        <span className="small-icon">
          <Wallet size={20} />
        </span>
        <h3>Approval scanning is not implemented yet.</h3>
        <p>
          {page === "overview"
            ? "No token balances, allowances, or approval counts have been fetched for this wallet."
            : "Live activity is not implemented. No wallet transactions or approval changes are fetched or performed here."}
        </p>
        <p>
          This stage supports connection and network selection only. No tokens
          are approved, revoked, or transferred, and no signatures are
          requested.
        </p>
      </div>
      <div className="live-demo-action">
        <button
          className="secondary-button"
          disabled={wallet.busy}
          onClick={returnToDemo}
        >
          Return to demo mode <ArrowRight size={15} />
        </button>
        <p>Disconnects Veto and restores your local demo view.</p>
      </div>
    </section>
  );
}
