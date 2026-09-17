/**
 * Courses rarely have a thumbnail early on, and an empty grey box reads as
 * broken. Derive a stable hue from the slug so every course still gets its
 * own recognisable colour, and keep it in the warm half of the wheel so it
 * belongs to the "estúdio" palette.
 */
export function hueFromSlug(slug: string): number {
  let hash = 0;
  for (let index = 0; index < slug.length; index += 1) {
    hash = (hash * 31 + slug.charCodeAt(index)) % 360;
  }
  // 12–64°: amber through terracotta.
  return 12 + (hash % 53);
}

interface CourseCoverProps {
  slug: string;
  title: string;
  /** The real cover, when the course has one. */
  thumbnailUrl?: string | null;
  /** Extra classes for the image/gradient layer — used for hover zoom. */
  className?: string;
}

/** Fills its positioned parent. Either the real thumbnail or a generated stand-in. */
export function CourseCover({ slug, title, thumbnailUrl, className = "" }: CourseCoverProps) {
  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnailUrl}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />
    );
  }

  const hue = hueFromSlug(slug);

  return (
    <div
      aria-hidden
      className={`absolute inset-0 ${className}`}
      style={{
        background: `radial-gradient(120% 120% at 20% 0%, hsl(${hue} 62% 26%) 0%, hsl(${hue + 14} 40% 12%) 55%, hsl(30 9% 7%) 100%)`,
      }}
    >
      {/*
        Centred watermark, sized to stay inside the shortest container this
        is used in (a ~150px card thumbnail). Anything larger overflows and
        gets clipped into what looks like a stray vertical bar.
      */}
      <span className="absolute inset-0 grid select-none place-items-center font-display text-[4rem] leading-none text-white/[0.12]">
        {title.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
