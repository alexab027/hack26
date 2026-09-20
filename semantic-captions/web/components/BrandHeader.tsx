export function BrandHeader() {
  return (
    <div>
      <h1
        aria-label="Subtext"
        className="flex items-baseline gap-1 text-[2rem] leading-none text-[var(--forest)] sm:text-4xl"
        style={{ fontFamily: 'var(--font-display), "DM Serif Display", Georgia, serif' }}
      >
        <span aria-hidden="true" className="text-[var(--sage)]">[</span>
        <span>subtext</span>
        <span aria-hidden="true" className="text-[var(--sage)]">]</span>
      </h1>
      <p className="mt-2 text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
        Words are just the start
      </p>
    </div>
  );
}
