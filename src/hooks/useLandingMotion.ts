import { useEffect, useRef } from "react";

// One scroll signal drives the shader, fallback wrappers, and the quieter text layer.
// Entrance and pointer transforms stay in their own layers/uniforms.
export function useLandingMotion(reduced: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const progress = useRef(0);
  useEffect(() => {
    const landing = root.current!;
    const hero = landing.querySelector<HTMLElement>(".landing-hero")!;
    let frame = 0;
    let target = 0;
    let visible = true;
    let disposed = false;
    const mobile = window.matchMedia("(max-width: 700px)");
    const apply = () => {
      const value = reduced ? 0 : progress.current;
      const small = mobile.matches;
      hero.style.setProperty("--glass-scroll-progress", value.toFixed(4));
      hero.style.setProperty(
        "--glass-scroll-x",
        `${value * (small ? 65 : 190)}px`,
      );
      hero.style.setProperty(
        "--glass-scroll-turn",
        `${value * (small ? 4 : 9)}deg`,
      );
      hero.style.setProperty("--glass-scroll-scale-x", `${1 + value * 0.045}`);
      hero.style.setProperty("--glass-scroll-scale-y", `${1 - value * 0.025}`);
      hero.style.setProperty(
        "--hero-text-y",
        `${-value * (small ? 12 : 32)}px`,
      );
    };
    const tick = () => {
      frame = 0;
      if (disposed || document.hidden || !visible || reduced) return;
      progress.current += (target - progress.current) * 0.12;
      if (Math.abs(target - progress.current) < 0.0005)
        progress.current = target;
      apply();
      if (progress.current !== target) frame = requestAnimationFrame(tick);
    };
    const measure = () => {
      const rect = hero.getBoundingClientRect();
      target = Math.max(0, Math.min(1, -rect.top / Math.max(1, rect.height)));
      visible = rect.bottom > 0 && rect.top < innerHeight;
      const paused = document.hidden || !visible;
      hero.dataset.motionPaused = String(paused);
      if (paused || reduced) {
        cancelAnimationFrame(frame);
        frame = 0;
        progress.current = reduced ? 0 : target;
        apply();
      } else if (!frame) frame = requestAnimationFrame(tick);
    };
    const intersection = new IntersectionObserver(measure);
    intersection.observe(hero);
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    document.addEventListener("visibilitychange", measure);
    measure();
    apply();

    const groups = new Map<Element, number>();
    const nodes = [
      ...landing.querySelectorAll<HTMLElement>(
        ".landing-section h2, .how-grid article, .feature-grid article, .landing-preview, .faq-list details",
      ),
    ];
    const reveal = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-revealed");
          reveal.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -24px 0px" },
    );
    for (const node of nodes) {
      node.classList.add("reveal-item");
      const card = node.matches("article, details");
      const group = node.parentElement!;
      const index = card ? (groups.get(group) ?? 0) : 0;
      if (card) groups.set(group, index + 1);
      node.style.setProperty("--reveal-delay", `${index * 80}ms`);
      if (reduced) node.classList.add("is-revealed");
      else if (!node.classList.contains("is-revealed")) reveal.observe(node);
    }
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      intersection.disconnect();
      reveal.disconnect();
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", measure);
    };
  }, [reduced]);
  return { root, progress };
}
