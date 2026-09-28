import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * The fonts are served from this repository rather than fetched from Google
 * Fonts, because `next/font/google` resolves them at build time: a build on a
 * machine without outbound internet — a CI runner, a closed network, or this
 * one on a bad day — fails with "Failed to fetch `Archivo` from Google Fonts"
 * and produces nothing. Self-hosted, the build has no network dependency at
 * all and the browser makes one fewer third-party connection.
 *
 * Only the latin subset is included, which covers Portuguese. The files came
 * from the Google Fonts CSS API; both families are under the SIL Open Font
 * License and their licence texts sit beside them in ./fonts.
 */

/** UI and body copy — a sturdy grotesque that holds up at 12px in a dark palette. */
const archivo = localFont({
  src: "./fonts/archivo-latin-variable.woff2",
  // One variable file covers the whole range, so there is nothing to pick.
  weight: "100 900",
  style: "normal",
  variable: "--font-archivo",
  display: "swap",
});

/** Display only — high-contrast editorial serif, used large and sparingly. */
const instrumentSerif = localFont({
  src: [
    { path: "./fonts/instrument-serif-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Estúdio",
  description: "Plataforma de cursos online",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body className={`${archivo.variable} ${instrumentSerif.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
