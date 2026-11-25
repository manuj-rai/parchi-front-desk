import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Devanagari } from "next/font/google";
import "./globals.css";

// Plex has a matching Devanagari face: transcripts of Hindi speech come back in Devanagari.
// 700 is for the intro page's headline only.
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-sans" });
const plexDevanagari = IBM_Plex_Sans_Devanagari({
  subsets: ["devanagari"], weight: ["400", "500", "600"], variable: "--font-plex-devanagari",
});
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

// Each page sets its own title: the intro at / and the console at /demo/.
export const metadata: Metadata = {
  title: "Parchi",
  description: "An AI front desk for small clinics: a caller says anything; two agents decide what happens.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexDevanagari.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
