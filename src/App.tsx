import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  History,
  Infinity as InfinityIcon,
  LayoutGrid,
  ListFilter,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { useAllowanceWrites } from "./hooks/useAllowanceWrites";
import { AllowanceChangeDialog } from "./components/AllowanceChangeDialog";
import { useBrowserWallet } from "./hooks/useBrowserWallet";
import {
  LiveWalletView,
  WalletButton,
  WalletIdentity,
  WalletPicker,
} from "./components/WalletUI";
import { initialApprovals, sampleWallet } from "./data/approvals";
import type { Approval } from "./data/approvals";
import {
  active,
  aboveBalance,
  formatAmount,
  shortAddress,
  validateAllowance,
} from "./lib/allowances";

type Filter = "all" | "unlimited" | "above";
type Modal =
  | { kind: "details" | "edit" | "revoke"; id: string }
  | { kind: "reset" | "wallet" }
  | null;
type Activity = {
  id: number;
  token: string;
  spender: string;
  previous: string;
  next: string;
  time: Date;
};

function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`wordmark ${large ? "wordmark-large" : ""}`}
      aria-label="Veto"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M3 5h8l6 15 5-15h7L18 29h-5z" fill="currentColor" />
        <path d="M3 5h8l3 7H6z" fill="#9fae81" />
      </svg>
      <span>
        veto<span className="wordmark-dot">.</span>
      </span>
    </span>
  );
}

function Dialog({
  children,
  title,
  close,
  panel = false,
}: {
  children: ReactNode;
  title: string;
  close: () => void;
  panel?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={panel ? "dialog details-dialog" : "dialog"}
      aria-labelledby="dialog-title"
      onCancel={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function Allowance({ approval }: { approval: Approval }) {
  return (
    <>
      <span className="amount">
        {approval.allowance === "unlimited" ? (
          <>
            <InfinityIcon size={16} /> Unlimited
          </>
        ) : (
          `${formatAmount(approval.allowance)} ${approval.token}`
        )}
      </span>
      <span
        className={`allowance-note ${aboveBalance(approval) ? "exposure" : ""}`}
      >
        {!active(approval)
          ? "Revoked in demo"
          : approval.allowance === "unlimited"
            ? "No spending cap"
            : aboveBalance(approval)
              ? "Above wallet balance"
              : "Within wallet balance"}
      </span>
    </>
  );
}

function entranceNeeded() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return false;
  try {
    return !sessionStorage.getItem("veto-entered");
  } catch {
    return true;
  }
}

export default function App() {
  const [approvals, setApprovals] = useState<Approval[]>(() =>
    initialApprovals.map((a) => ({ ...a })),
  );
  const [page, setPage] = useState<"overview" | "activity">("overview");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [amount, setAmount] = useState("");
  const [unlimited, setUnlimited] = useState(false);
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<Activity[]>([]);
  const [notice, setNotice] = useState("");
  const [intro, setIntro] = useState(entranceNeeded);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const writes = useAllowanceWrites();
  const wallet = useBrowserWallet(() => {
    setMode("live");
    setModal(null);
    setNotice("");
  });
  function returnToDemo() {
    const showDemo = () => {
      setMode("demo");
      setModal(null);
      setNotice("");
    };
    if (wallet.isConnected) wallet.disconnectWallet(showDemo);
    else showDemo();
  }
  const activeApprovals = approvals.filter(active);
  const selected =
    modal && "id" in modal
      ? approvals.find((a) => a.id === modal.id)
      : undefined;
  const visible = approvals.filter(
    (a) =>
      (filter === "all" ||
        (filter === "unlimited"
          ? a.allowance === "unlimited"
          : aboveBalance(a))) &&
      `${a.token} ${a.tokenName} ${a.spender} ${a.address}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );

  function finishIntro() {
    try {
      sessionStorage.setItem("veto-entered", "true");
    } catch {
      /* Session storage may be unavailable. */
    }
    setIntro(false);
  }
  useEffect(() => {
    if (!intro) return;
    const timer = window.setTimeout(finishIntro, 1500);
    return () => window.clearTimeout(timer);
  }, [intro]);

  function openEdit(approval: Approval) {
    setAmount(
      approval.allowance === "unlimited"
        ? approval.balance
        : approval.allowance,
    );
    setUnlimited(approval.allowance === "unlimited");
    setError("");
    setModal({ kind: "edit", id: approval.id });
  }
  function changeAllowance(approval: Approval, next: string) {
    if (next === approval.allowance) {
      setModal(null);
      setNotice("No change: this allowance already has that value.");
      return;
    }
    setApprovals((items) =>
      items.map((a) => (a.id === approval.id ? { ...a, allowance: next } : a)),
    );
    setActivity((items) => [
      {
        id: Date.now(),
        token: approval.token,
        spender: approval.spender,
        previous: approval.allowance,
        next,
        time: new Date(),
      },
      ...items,
    ]);
    setNotice(
      `${approval.token} allowance for ${approval.spender} ${next === "0" ? "revoked" : "updated"} in the demo. No transaction was sent.`,
    );
    setModal(null);
  }
  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const value = amount.trim();
    const issue = unlimited
      ? null
      : validateAllowance(value, selected.decimals);
    if (issue) {
      setError(issue);
      return;
    }
    const normalized = unlimited
      ? "unlimited"
      : value
          .replace(/^0+(?=\d)/, "")
          .replace(/(\.\d*?)0+$/, "$1")
          .replace(/\.$/, "");
    changeAllowance(selected, normalized);
  }
  function reset() {
    setApprovals(initialApprovals.map((a) => ({ ...a })));
    setActivity([]);
    setQuery("");
    setFilter("all");
    setModal(null);
    setNotice(
      "Demo reset. Sample allowances restored and local activity cleared.",
    );
  }

  return (
    <>
      {intro ? (
        <div className="entrance">
          <div className="entrance-center">
            <Wordmark large />
            <p>Your wallet. Your permissions.</p>
            <div className="entrance-line" />
          </div>
          <button className="skip-intro" onClick={finishIntro}>
            Skip intro <ArrowRight size={16} />
          </button>
        </div>
      ) : null}
      <div className="app-shell" inert={intro}>
        <aside className="sidebar">
          <a className="brand" href="#main" onClick={() => setPage("overview")}>
            <Wordmark />
          </a>
          <div className="workspace-label">WORKSPACE</div>
          <nav aria-label="Main navigation">
            <button
              className={page === "overview" ? "nav-item selected" : "nav-item"}
              onClick={() => setPage("overview")}
              aria-current={page === "overview" ? "page" : undefined}
            >
              <LayoutGrid size={18} /> Overview <span className="nav-dot" />
            </button>
            <button
              className={page === "activity" ? "nav-item selected" : "nav-item"}
              onClick={() => setPage("activity")}
              aria-current={page === "activity" ? "page" : undefined}
            >
              <History size={18} /> Activity{" "}
              {(mode === "demo" ? activity.length : writes.activity.length) > 0 && (
                <span className="nav-count">{mode === "demo" ? activity.length : writes.activity.length}</span>
              )}
            </button>
          </nav>
          <div className="sidebar-bottom">
            <div className="local-card">
              <span className="small-icon">
                <ShieldCheck size={19} />
              </span>
              <h3>A little more control.</h3>
              <p>Understand what your tokens are allowed to do.</p>
              <span className="local-label">
                <span /> LOCAL PROTOTYPE
              </span>
            </div>
            {mode === "demo" && (
              <button
                className="reset-button"
                onClick={() => setModal({ kind: "reset" })}
              >
                <RotateCcw size={15} /> Reset demo
              </button>
            )}
            <div className="sidebar-footer">
              Veto <span>v0.1</span>
            </div>
          </div>
        </aside>
        <div className="main-shell">
          <header className="topbar">
            <div className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{page === "overview" ? "Overview" : "Activity"}</strong>
            </div>
            <div className="topbar-right">
              <span className="demo-badge">
                <span />{" "}
                {mode === "demo"
                  ? "Demo mode · Sample data"
                  : "Live wallet · Base Sepolia"}
              </span>
              <WalletButton
                wallet={wallet}
                open={() => setModal({ kind: "wallet" })}
              />
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            <div className="page-heading">
              <div>
                <div className="eyebrow">PERMISSIONS, IN PERSPECTIVE</div>
                <h1>
                  {page === "overview"
                    ? "Your wallet. Your permissions."
                    : "A clear record of your changes."}
                </h1>
                <p>
                  {mode === "live"
                    ? "Check a selected token and spender. Keep your permissions in perspective."
                    : page === "overview"
                      ? "See who can spend your tokens. Decide how much access they need."
                      : "Every adjustment you make here stays in this local demo."}
                </p>
              </div>
              {mode === "demo" && (
                <div className="wallet-chip">
                  <Wallet size={16} />
                  <div>
                    <span>Sample wallet</span>
                    <strong>{shortAddress(sampleWallet)}</strong>
                  </div>
                  <span className="wallet-status" />
                </div>
              )}
            </div>
            <div className="notice" role="status" aria-live="polite">
              {mode === "demo" && notice && (
                <>
                  <Check size={16} />
                  <span>{notice}</span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss notification"
                    onClick={() => setNotice("")}
                  >
                    <X size={16} />
                  </button>
                </>
              )}
            </div>
            {mode === "live" ? (
              <LiveWalletView
                wallet={wallet}
                writes={writes}
                page={page}
                returnToDemo={returnToDemo}
                open={() => setModal({ kind: "wallet" })}
              />
            ) : page === "overview" ? (
              <>
                <section
                  className="summary-grid"
                  aria-label="Allowance summary"
                >
                  <button
                    className={`summary-card ${filter === "all" ? "summary-selected" : ""}`}
                    onClick={() => setFilter("all")}
                    aria-pressed={filter === "all"}
                  >
                    <div className="summary-top">
                      Active approvals{" "}
                      <span className="card-icon">
                        <ShieldCheck size={18} />
                      </span>
                    </div>
                    <div className="summary-value">
                      {activeApprovals.length}
                      <span>
                        across{" "}
                        {new Set(activeApprovals.map((a) => a.token)).size}{" "}
                        tokens
                      </span>
                    </div>
                    <div className="summary-bottom">
                      Contracts with spending permission{" "}
                      <ArrowUpRight size={16} />
                    </div>
                  </button>
                  <button
                    className={`summary-card ${filter === "unlimited" ? "summary-selected" : ""}`}
                    onClick={() => setFilter("unlimited")}
                    aria-pressed={filter === "unlimited"}
                  >
                    <div className="summary-top">
                      Unlimited approvals{" "}
                      <span className="card-icon">
                        <InfinityIcon size={19} />
                      </span>
                    </div>
                    <div className="summary-value">
                      {
                        approvals.filter((a) => a.allowance === "unlimited")
                          .length
                      }
                      <span className="highlight">no spending cap</span>
                    </div>
                    <div className="summary-bottom">
                      Access can include future deposits{" "}
                      <ArrowUpRight size={16} />
                    </div>
                  </button>
                  <button
                    className={`summary-card ${filter === "above" ? "summary-selected" : ""}`}
                    onClick={() => setFilter("above")}
                    aria-pressed={filter === "above"}
                  >
                    <div className="summary-top">
                      Approvals above balance{" "}
                      <span className="card-icon">
                        <ArrowUpRight size={18} />
                      </span>
                    </div>
                    <div className="summary-value">
                      {approvals.filter(aboveBalance).length}
                      <span>including unlimited</span>
                    </div>
                    <div className="summary-bottom">
                      Permission exceeds current holdings{" "}
                      <ArrowUpRight size={16} />
                    </div>
                  </button>
                </section>
                <div className="context-banner">
                  <span className="context-icon">
                    <CircleHelp size={18} />
                  </span>
                  <p>
                    <strong>Permission is not a verdict.</strong> Unlimited and
                    above-balance allowances describe exposure. They do not
                    prove a spender is malicious.
                  </p>
                </div>
                <section
                  className="approvals-section"
                  aria-labelledby="approvals-heading"
                >
                  <div className="section-title">
                    <div>
                      <h2 id="approvals-heading">
                        Token approvals <span>{approvals.length}</span>
                      </h2>
                      <p>A closer look at the access you’ve granted.</p>
                    </div>
                    <span className="sample-note">
                      <span /> Synthetic spenders
                    </span>
                  </div>
                  <div className="table-toolbar">
                    <div className="filter-tabs" aria-label="Filter approvals">
                      {(
                        [
                          ["all", "All approvals"],
                          ["unlimited", "Unlimited"],
                          ["above", "Above balance"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          className={filter === value ? "active" : ""}
                          onClick={() => setFilter(value)}
                          aria-pressed={filter === value}
                        >
                          {value === "all" && <ListFilter size={14} />}
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search token or spender…"
                        aria-label="Search by token, spender, or address"
                      />
                      {query && (
                        <button
                          className="icon-button"
                          onClick={() => setQuery("")}
                          aria-label="Clear search"
                        >
                          <X size={14} />
                        </button>
                      )}
                      <span className="search-decoration">⌕</span>
                    </label>
                  </div>
                  <p className="mobile-table-hint">
                    Swipe the table to see allowances and actions{" "}
                    <ArrowRight size={12} />
                  </p>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    role="region"
                    aria-label="Token approvals table"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Spender</th>
                          <th>Wallet balance</th>
                          <th>Allowance</th>
                          <th className="actions-heading">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <div className="token-cell">
                                <span className={`token-icon ${a.color}`}>
                                  {a.token === "USDC"
                                    ? "$"
                                    : a.token === "WETH"
                                      ? "♦"
                                      : a.token === "DAI"
                                        ? "◈"
                                        : "U"}
                                </span>
                                <div>
                                  <strong>{a.token}</strong>
                                  <span>{a.tokenName}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <button
                                className="spender-button"
                                onClick={() =>
                                  setModal({ kind: "details", id: a.id })
                                }
                              >
                                <strong>
                                  {a.spender} <ArrowUpRight size={12} />
                                </strong>
                                <span>{shortAddress(a.address)}</span>
                              </button>
                            </td>
                            <td>
                              <span className="balance">
                                {formatAmount(a.balance)} <span>{a.token}</span>
                              </span>
                            </td>
                            <td>
                              <Allowance approval={a} />
                            </td>
                            <td>
                              <div className="row-actions">
                                <button
                                  className="edit-button"
                                  onClick={() => openEdit(a)}
                                  aria-label={`Edit ${a.token} allowance for ${a.spender}`}
                                >
                                  Edit <SlidersHorizontal size={12} />
                                </button>
                                <button
                                  className="revoke-button"
                                  onClick={() =>
                                    setModal({ kind: "revoke", id: a.id })
                                  }
                                  disabled={!active(a)}
                                  aria-label={`Revoke ${a.token} allowance for ${a.spender}`}
                                >
                                  {active(a) ? "Revoke" : "Revoked"}
                                </button>
                                <button
                                  className="icon-button detail-action"
                                  onClick={() =>
                                    setModal({ kind: "details", id: a.id })
                                  }
                                  aria-label={`View ${a.spender} ${a.token} details`}
                                >
                                  <ChevronDown size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {visible.length === 0 && (
                      <div className="empty-state">
                        <Search size={25} />
                        <h3>No matching approvals</h3>
                        <p>
                          Try another token or spender, or clear your filters.
                        </p>
                        <button
                          className="secondary-button"
                          onClick={() => {
                            setQuery("");
                            setFilter("all");
                          }}
                        >
                          Clear search and filters
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      Showing {visible.length} of {approvals.length} sample
                      approvals
                    </span>
                    <span>
                      <Clock3 size={13} /> Local state · No blockchain
                      connection
                    </span>
                  </div>
                </section>
                <section className="education-card">
                  <div className="education-art" aria-hidden="true">
                    <div className="art-ring">
                      <ShieldCheck size={28} />
                    </div>
                    <span className="art-dot one" />
                    <span className="art-dot two" />
                  </div>
                  <div>
                    <div className="eyebrow">
                      A SMALL PERMISSION. A BIG DIFFERENCE.
                    </div>
                    <h3>An allowance is access, not a transfer.</h3>
                    <p>
                      It lets a spender move tokens up to a limit. Lowering or
                      revoking that limit changes its access; it doesn’t move
                      your tokens.
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      setModal({ kind: "details", id: approvals[0].id })
                    }
                  >
                    Explore an allowance <ArrowRight size={17} />
                  </button>
                </section>
              </>
            ) : (
              <section className="activity-section">
                <div className="section-title">
                  <div>
                    <h2>
                      Local activity <span>{activity.length}</span>
                    </h2>
                    <p>Simulated allowance changes, newest first.</p>
                  </div>
                  <span className="sample-note">This browser tab only</span>
                </div>
                {activity.length === 0 ? (
                  <div className="empty-state activity-empty">
                    <span className="empty-icon">
                      <History size={30} />
                    </span>
                    <h3>Your next decision starts here.</h3>
                    <p>
                      Edit or revoke a sample approval to see a local record of
                      your change.
                    </p>
                    <button
                      className="primary-button"
                      onClick={() => setPage("overview")}
                    >
                      Explore approvals <ArrowRight size={16} />
                    </button>
                  </div>
                ) : (
                  <ul className="activity-list">
                    {activity.map((item) => (
                      <li key={item.id}>
                        <span className="activity-icon">
                          <ArrowDownLeft size={19} />
                        </span>
                        <div>
                          <h3>
                            {item.next === "0"
                              ? "Allowance revoked"
                              : "Allowance updated"}{" "}
                            <span className="simulated-tag">Simulated</span>
                          </h3>
                          <p>
                            {item.spender} · {item.token}
                          </p>
                          <div className="activity-change">
                            {item.previous === "unlimited"
                              ? "Unlimited"
                              : `${formatAmount(item.previous)} ${item.token}`}{" "}
                            <ArrowRight size={14} />{" "}
                            {item.next === "unlimited"
                              ? "Unlimited"
                              : `${formatAmount(item.next)} ${item.token}`}
                          </div>
                          <span className="activity-disclaimer">
                            No transaction sent. Wallet balance unchanged.
                          </span>
                        </div>
                        <time dateTime={item.time.toISOString()}>
                          {item.time.toLocaleTimeString("en", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            <footer className="main-footer">
              <span>Your wallet. Your permissions.</span>
              {mode === "demo" && (
                <button
                  className="mobile-reset"
                  onClick={() => setModal({ kind: "reset" })}
                >
                  <RotateCcw size={12} /> Reset demo
                </button>
              )}
              <span>
                Built for clarity. <span className="footer-dot">✳</span>{" "}
                {mode === "demo" ? "Veto demo" : "Veto prototype"}
              </span>
            </footer>
          </main>
        </div>
      </div>
      {mode === "live" && writes.dialog?.open && (
        <AllowanceChangeDialog key={writes.dialog.id} writes={writes} />
      )}
      {modal && (
        <Dialog
          key={modal.kind}
          title={
            modal.kind === "wallet"
              ? wallet.isConnected
                ? "Your connected wallet"
                : "Connect a browser wallet"
              : modal.kind === "details"
                ? "Allowance details"
                : modal.kind === "edit"
                  ? "Edit allowance"
                  : modal.kind === "revoke"
                    ? "Revoke this allowance?"
                    : "Reset the demo?"
          }
          panel={modal.kind === "details"}
          close={() => setModal(null)}
        >
          {modal.kind === "wallet" &&
            (wallet.isConnected ? (
              <WalletIdentity wallet={wallet} />
            ) : (
              <WalletPicker wallet={wallet} />
            ))}
          {selected && modal.kind === "details" && (
            <>
              <span className="dialog-demo">DEMO · SAMPLE APPROVAL</span>
              <div className="detail-identity">
                <span className={`token-icon ${selected.color}`}>
                  {selected.token.slice(0, 1)}
                </span>
                <div>
                  <h3>
                    {selected.token} → {selected.spender}
                  </h3>
                  <p>{selected.category}</p>
                </div>
              </div>
              <dl className="detail-data">
                <div>
                  <dt>Sample wallet balance</dt>
                  <dd>
                    {formatAmount(selected.balance)} {selected.token}
                  </dd>
                </div>
                <div>
                  <dt>Current allowance</dt>
                  <dd>
                    {selected.allowance === "unlimited"
                      ? "Unlimited"
                      : `${formatAmount(selected.allowance)} ${selected.token}`}
                  </dd>
                </div>
                <div className="address-detail">
                  <dt>Synthetic spender address</dt>
                  <dd>{selected.address}</dd>
                </div>
              </dl>
              <div className="explanation">
                <h3>What does this permit?</h3>
                <p>
                  {!active(selected)
                    ? `${selected.spender} has no permission to move your ${selected.token} through this approval in the demo.`
                    : selected.allowance === "unlimited"
                      ? `${selected.spender} is permitted to move your ${selected.token} without a practical spending cap. This permission can cover your current balance and future deposits until you change it.`
                      : `${selected.spender} is permitted to move up to ${formatAmount(selected.allowance)} ${selected.token} from this wallet. The spender can only transfer tokens that are available in the wallet.`}
                </p>
                {active(selected) && aboveBalance(selected) && (
                  <p>
                    The permission exceeds your current balance of{" "}
                    {formatAmount(selected.balance)} {selected.token}. Future
                    deposits could also become accessible, up to the allowance.
                  </p>
                )}
                <p>
                  Permission alone does not tell us whether a spender is
                  trustworthy or malicious.
                </p>
              </div>
              <p className="dialog-caption">
                All names and addresses are synthetic examples. This prototype
                does not read or change permissions onchain.
              </p>
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  onClick={() => setModal(null)}
                >
                  Close
                </button>
                <button
                  className="primary-button"
                  onClick={() => openEdit(selected)}
                >
                  Edit sample allowance <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {selected && modal.kind === "edit" && (
            <form onSubmit={submitEdit}>
              <p className="dialog-description">
                Set how much {selected.token}{" "}
                <strong>{selected.spender}</strong> may spend in this demo.
              </p>
              <div className="current-value">
                Current allowance{" "}
                <strong>
                  {selected.allowance === "unlimited"
                    ? "Unlimited"
                    : `${formatAmount(selected.allowance)} ${selected.token}`}
                </strong>
              </div>
              <label className="input-label" htmlFor="allowance-input">
                New allowance ({selected.token})
              </label>
              <input
                autoFocus
                id="allowance-input"
                className="amount-input"
                inputMode="decimal"
                value={amount}
                disabled={unlimited}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "amount-error" : "amount-help"}
              />
              <p className="input-help" id="amount-help">
                Sample balance: {formatAmount(selected.balance)}{" "}
                {selected.token}. Set 0 to remove permission.
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={unlimited}
                  onChange={(e) => {
                    setUnlimited(e.target.checked);
                    setError("");
                  }}
                />{" "}
                Allow unlimited spending
              </label>
              {unlimited && (
                <p className="exposure-warning">
                  Unlimited access can include future deposits. Choose a
                  specific amount to set a spending cap.
                </p>
              )}
              {error && (
                <p className="form-error" id="amount-error" role="alert">
                  {error}
                </p>
              )}
              <div className="simulation-note">
                <CircleHelp size={16} />
                <span>
                  Simulation only. No wallet connection or onchain transaction.
                </span>
              </div>
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Simulate update <Check size={16} />
                </button>
              </div>
            </form>
          )}
          {selected && modal.kind === "revoke" && (
            <>
              <p className="dialog-description">
                Remove <strong>{selected.spender}’s</strong> permission to spend
                your <strong>{selected.token}</strong> in this demo.
              </p>
              <div className="current-value">
                New allowance <strong>0 {selected.token}</strong>
              </div>
              <p className="dialog-caption">
                Your sample wallet balance stays the same. You can grant a new
                sample allowance later.
              </p>
              <div className="simulation-note">
                <CircleHelp size={16} />
                <span>
                  Simulation only. No wallet connection or onchain transaction.
                </span>
              </div>
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  autoFocus
                  onClick={() => setModal(null)}
                >
                  Keep allowance
                </button>
                <button
                  className="primary-button"
                  onClick={() => changeAllowance(selected, "0")}
                >
                  Simulate revoke
                </button>
              </div>
            </>
          )}
          {modal.kind === "reset" && (
            <>
              <p className="dialog-description">
                Restore all six sample approvals and clear your local activity.
                Your demo changes will be removed.
              </p>
              <div className="dialog-actions">
                <button
                  autoFocus
                  className="secondary-button"
                  onClick={() => setModal(null)}
                >
                  Keep changes
                </button>
                <button className="primary-button" onClick={reset}>
                  <RotateCcw size={16} /> Reset demo
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
