export function Wordmark({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`wordmark ${large ? "wordmark-large" : ""}`}
      aria-label="Veto"
    >
      <img
        className="wordmark-logo"
        src="/veto-logo.png"
        alt=""
        aria-hidden="true"
        width="28"
        height="30"
      />
      <span>
        veto<span className="wordmark-dot">.</span>
      </span>
    </span>
  );
}
