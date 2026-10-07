export function Wordmark({ large = false }: { large?: boolean }) {
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
