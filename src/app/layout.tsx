import type { Metadata, Viewport } from "next";
import { Fraunces, Noto_Sans_SC, Noto_Sans_Tamil, Plus_Jakarta_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-fraunces",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// Scripts the Latin fonts don't cover (Phase 6). Served only when the page
// is in that language: globals.css swaps them in by html[data-locale].
const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: "--font-noto-sc",
  display: "swap",
});

const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil", "latin"],
  variable: "--font-noto-tamil",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "WeddingVista: see your venue decorated, with honest prices", template: "%s · WeddingVista" },
  description: "Pick a real Singapore venue and room, choose decor vendors can actually deliver, see it decorated, and get an itemised estimate before you commit.",
  applicationName: "WeddingVista",
  openGraph: {
    type: "website",
    siteName: "WeddingVista",
    locale: "en_SG",
    title: "WeddingVista: see your venue decorated, with honest prices",
    description: "Real Singapore rooms, decor vendors can deliver, and itemised estimates.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBF7F2",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-SG" className={`${fraunces.variable} ${jakarta.variable} ${notoSC.variable} ${notoTamil.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
