/**
 * Courses rarely have a thumbnail early on, and an empty grey box reads as
 * broken. Derive a stable hue from the slug so every course still gets its
 * own recognisable colour, and keep it in the warm half of the wheel so it
 * belongs to the "estúdio" palette.
 */
import { publicApiUrl } from "@/services/api-client";

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
  /** A cover hosted elsewhere, pasted as a URL. */
  thumbnailUrl?: string | null;
  /** A cover uploaded to this server. Takes precedence over `thumbnailUrl`. */
  coverKey?: string | null;
  /** Extra classes for the image/gradient layer — used for hover zoom. */
  className?: string;
}

/** Fills its positioned parent. Either the real thumbnail or a generated stand-in. */
export function CourseCover({ slug, title, thumbnailUrl, coverKey, className = "" }: CourseCoverProps) {
  /*
   * An uploaded cover wins over a pasted URL: it is the more deliberate act,
   * and it is the one we can still serve if the other host disappears.
   *
   * `publicApiUrl`, not `apiUrl`: this component renders inside Server
   * Components too, and `apiUrl` would hand those the Docker-internal address,
   * which resolves for nobody with a browser.
   */
  const src = coverKey ? publicApiUrl(`/public/covers/${coverKey}`) : thumbnailUrl;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
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
