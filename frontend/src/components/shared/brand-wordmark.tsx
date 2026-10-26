export function BrandWordmark({ className = "text-2xl" }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-start leading-none ${className}`}>
      <span className="font-display text-[0.92em] tracking-tight">Protagonista</span>
      <span className="mt-1 text-[0.42em] font-semibold uppercase tracking-[0.2em] text-primary">
        Academy
      </span>
    </span>
  );
}
