import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  History,
  Radar,
  Search,
  SlidersHorizontal,
  Wallet,
  X,
} from "lucide-react";
import { Wordmark } from "./components/Wordmark";
import { useLandingMotion } from "./hooks/useLandingMotion";
import { LiquidGlass } from "./components/LiquidGlass";

function entranceNeeded() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    return false;
  try {
    return !sessionStorage.getItem("veto-entered");
  } catch {
    return true;
  }
}
function AppLink({
  demo = false,
  secondary = false,
  children,
}: {
  demo?: boolean;
  secondary?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <a
      className={secondary ? "landing-button secondary" : "landing-button"}
      href={demo ? "/app?mode=demo" : "/app"}
    >
      {children ?? (demo ? "Try demo" : "Launch app")}
      <ArrowUpRight size={17} />
    </a>
  );
}
function DashboardPreview() {
  return (
    <div
      className="landing-preview"
      aria-label="Dashboard preview with demo sample data"
    >
      <div className="preview-top">
        <Wordmark />
        <span className="preview-demo">
          <span />
          Demo · Sample data
        </span>
      </div>
      <div className="preview-heading">
        <div>
          <span className="landing-eyebrow">OVERVIEW</span>
          <h3>Your permissions, in perspective.</h3>
        </div>
        <span className="preview-wallet">
          <Wallet size={14} />
          Sample wallet
        </span>
      </div>
      <div className="preview-summary">
        {[
          ["Active approvals", "3"],
          ["Unlimited approvals", "1"],
          ["Above sample balance", "1"],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
            <small>Demo only</small>
          </div>
        ))}
      </div>
      <div className="preview-table-scroll">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Spender</th>
              <th>Sample balance</th>
              <th>Allowance</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["USDC", "Aster Exchange", "250.00", "Unlimited"],
              ["USDC", "Lantern Vault", "250.00", "100.00 USDC"],
              ["WETH", "Orbit Market", "0.50", "0.10 WETH"],
            ].map(([token, spender, balance, allowance], i) => (
              <tr key={spender}>
                <td>
                  <span className={`preview-token token-${i}`}>{token[0]}</span>
                  <strong>{token}</strong>
                </td>
                <td>
                  {spender}
                  <small>Synthetic spender</small>
                </td>
                <td>{balance}</td>
                <td className={i === 0 ? "preview-unlimited" : ""}>
                  {allowance}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="preview-bottom">
        <span>Illustrative sample data. No connected wallet.</span>
        <a href="/app?mode=demo">
          Explore demo <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
const features = [
  {
    icon: Radar,
    title: "Find USDC permissions.",
    text: "Discover spenders from your USDC Approval events on Base Sepolia. Scan the last 50,000 blocks, with the exact range and any partial coverage shown.",
    label: "01 / RANGE SCAN",
  },
  {
    icon: Search,
    title: "Check a specific pair.",
    text: "Enter a token and spender to read the connected wallet’s actual allowance and balance at one block snapshot.",
    label: "02 / MANUAL CHECK",
  },
  {
    icon: SlidersHorizontal,
    title: "Set a finite limit.",
    text: "Choose a precise allowance. A nonzero-to-nonzero change resets to zero first, then waits for your explicit Continue before the second transaction.",
    label: "03 / EDIT",
  },
  {
    icon: X,
    title: "Remove permission.",
    text: "Revoke a positive allowance by setting it to zero. Review the token, spender, owner, and network before confirming in your wallet.",
    label: "04 / REVOKE",
  },
  {
    icon: History,
    title: "Follow what changed.",
    text: "Track live transaction status and actual hashes with Base Sepolia explorer links. Demo activity stays separate and clearly simulated.",
    label: "05 / ACTIVITY",
  },
];
const faq = [
  [
    "What is a token allowance?",
    "An ERC20 allowance is the amount a spender address is permitted to spend from your wallet for a specific token. It can stay active after you finish using an app. Unlimited and above-balance allowances describe exposure; they do not prove that a spender is malicious.",
  ],
  [
    "Does connecting give Veto access to my tokens?",
    "Connecting shares your account address. Reading allowances and scanning events do not request signatures or token spending permissions. Edit and Revoke are separate transactions that require your confirmation in your wallet.",
  ],
  [
    "Do I need to pay gas?",
    "Connecting, scanning, and checking are read-only and need no gas. Changing or revoking an allowance costs Base Sepolia ETH for testnet gas. A nonzero-to-nonzero edit uses two separate transactions. Demo changes are simulated and cost nothing.",
  ],
  [
    "What does the prototype cover?",
    "Base Sepolia only. Automatic discovery covers USDC Approval events in the displayed block range, initially the last 50,000 blocks. It does not scan every token or include older events outside that range. You can manually check other ERC20 token/spender pairs on Base Sepolia. Only successfully verified unique pairs enter the summaries.",
  ],
  [
    "Are these results continuously updated?",
    "No. Rows show a block snapshot. Refresh a pair or scan again for a new snapshot; after a confirmed allowance change, Veto reads back the actual balance and allowance. RPC failures and incomplete scans are labeled. Live activity is stored only for the current page session.",
  ],
];

export default function Landing() {
  const [entrance, setEntrance] = useState(entranceNeeded);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const motion = useLandingMotion(reduced);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setEntrance(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem("veto-entered", "true");
    } catch {
      /* Dashboard still opens immediately if storage is blocked. */
    }
    if (!entrance) return;
    const timer = setTimeout(() => setEntrance(false), 2800);
    return () => clearTimeout(timer);
  }, [entrance]);
  return (
    <div
      ref={motion.root}
      className={`landing ${entrance && !reduced ? "landing-entering" : "landing-settled"}`}
    >
      <a className="landing-skip-link" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-header">
        <nav aria-label="Landing navigation">
          <a href="/" className="landing-brand" aria-label="Veto home">
            <Wordmark />
          </a>
          <div className="landing-nav-links">
            <a href="#how-it-works">How it works</a>
            <a href="#features">Features</a>
          </div>
          <AppLink />
        </nav>
      </header>
      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="hero-title">
          <LiquidGlass
            entrance={entrance}
            reduced={reduced}
            scroll={motion.progress}
          />
          <div className="hero-content">
            <span className="hero-label">
              <span />
              YOUR PERMISSIONS, IN PERSPECTIVE
            </span>
            <h1 id="hero-title">
              Your wallet.
              <br />
              <span>Your permissions.</span>
            </h1>
            <p>
              See who can spend your tokens.
              <br className="desktop-break" /> Set a limit. Take permission
              back.
            </p>
            <div className="hero-actions">
              <AppLink />
              <AppLink demo secondary />
            </div>
            <span className="hero-network">
              A working prototype on Base Sepolia. Your wallet stays in control.
            </span>
          </div>
          <div className="hero-bottom">
            <a href="#the-problem">
              <ArrowDown size={15} /> A closer look at permissions
            </a>
            {entrance && (
              <button className="skip-glass" onClick={() => setEntrance(false)}>
                Skip animation <ArrowRight size={14} />
              </button>
            )}
            <span>READ. REVIEW. DECIDE.</span>
          </div>
        </section>
        <section className="landing-section problem-section" id="the-problem">
          <span className="landing-eyebrow">01 / THE QUIET PERMISSION</span>
          <div className="landing-split">
            <h2>
              You leave the app.
              <br />
              <span>The approval can stay.</span>
            </h2>
            <div>
              <p>
                Connecting and approving are different things. When you approve
                a spender, you give it permission to spend a specific token from
                your wallet.
              </p>
              <p>
                That permission can remain after the swap is done or the browser
                tab is closed. Veto makes those permissions visible, so you can
                decide what should stay.
              </p>
              <span className="section-footnote">
                Exposure is context, not a verdict about a contract.
              </span>
            </div>
          </div>
        </section>
        <section className="landing-section" id="how-it-works">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">02 / HOW IT WORKS</span>
            <h2>
              A little more clarity.
              <br />
              <span>A little more control.</span>
            </h2>
          </div>
          <div className="how-grid">
            {[
              {
                title: "Connect wallet",
                icon: Wallet,
                text: "Choose an installed browser wallet and switch to Base Sepolia when you’re ready. Connection alone grants no token spending permission.",
              },
              {
                title: "Review permissions",
                icon: Search,
                text: "Scan the displayed USDC block range or check a token/spender pair. See actual allowances, balances, and the snapshot block.",
              },
              {
                title: "Edit or revoke",
                icon: SlidersHorizontal,
                text: "Set a finite allowance or remove it. Review the change, then confirm each transaction yourself in your wallet.",
              },
            ].map(({ title, icon: Icon, text }, i) => (
              <article key={title}>
                <div className="how-top">
                  <span>0{i + 1}</span>
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-section" id="features">
          <div className="landing-section-heading feature-heading">
            <div>
              <span className="landing-eyebrow">03 / AVAILABLE TODAY</span>
              <h2>
                Less guessing.
                <br />
                <span>More perspective.</span>
              </h2>
            </div>
            <p>
              Real reads. Explicit changes.
              <br />A separate demo to explore at your pace.
            </p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text, label }) => (
              <article key={label}>
                <div className="feature-top">
                  <span className="landing-eyebrow">{label}</span>
                  <Icon size={22} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
          <div className="landing-scope">
            <Check size={17} />
            <p>
              Base Sepolia only. Automatic scan: USDC in the displayed range.
              Summaries cover verified pairs, not your entire wallet.
            </p>
          </div>
        </section>
        <section className="landing-section preview-section">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">04 / A CLEARER VIEW</span>
            <h2>Permission, with context.</h2>
            <p>
              A balance beside an allowance. A spender beside an action.
              <br />
              Explore the interface with clearly labeled sample data.
            </p>
          </div>
          <DashboardPreview />
        </section>
        <section className="landing-section about-section" id="about">
          <span className="landing-eyebrow">05 / ABOUT VETO</span>
          <div className="landing-split">
            <h2>
              Your permission
              <br />
              to say <span>enough.</span>
            </h2>
            <div>
              <p>
                Veto helps you understand and manage ERC20 spending permissions.
                The goal is simple: make a quiet part of using a wallet easier
                to see and act on.
              </p>
              <p>
                You choose what to check and what to change. Your browser wallet
                confirms each transaction; Veto reads the result back. No
                automatic second transaction, no hidden unlimited shortcut.
              </p>
              <a className="landing-text-link" href="/app">
                Open your permissions view <ArrowUpRight size={17} />
              </a>
            </div>
          </div>
        </section>
        <section className="landing-section faq-section" id="faq">
          <div>
            <span className="landing-eyebrow">06 / GOOD TO KNOW</span>
            <h2>A few clear answers.</h2>
          </div>
          <div className="faq-list">
            {faq.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-section final-cta">
          <span className="landing-eyebrow">YOUR WALLET. YOUR CALL.</span>
          <h2>
            Keep your permissions
            <br />
            <span>in perspective.</span>
          </h2>
          <p>Start with the demo, or connect on Base Sepolia.</p>
          <div className="hero-actions">
            <AppLink />
            <AppLink demo secondary />
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div>
          <a href="/" aria-label="Veto home">
            <Wordmark />
          </a>
          <p>Your wallet. Your permissions.</p>
        </div>
        <div>
          <a href="#faq">FAQ</a>
          <a href="/app">
            Launch app <ArrowUpRight size={14} />
          </a>
          <span>Base Sepolia prototype · Testnet only</span>
        </div>
      </footer>
    </div>
  );
}
