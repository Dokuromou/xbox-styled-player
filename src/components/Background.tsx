/** Animated, theme-aware backdrop – every theme gets its own signature effect (see index.css). */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 70% at 15% 0%, rgb(var(--glow) / 0.16), transparent 60%), radial-gradient(80% 60% at 100% 100%, rgb(var(--glow) / 0.1), transparent 60%), linear-gradient(180deg, var(--bg1), var(--bg0) 70%)",
        }}
      />
      <div className="bg-fx absolute inset-0" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] opacity-50">
        <div className="bg-grid absolute inset-0" />
      </div>
      <div className="bg-scan absolute inset-0" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgb(0 0 0 / 0.55))" }}
      />
    </div>
  );
}
