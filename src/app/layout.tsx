import type { Metadata } from "next";
import { headers } from "next/headers";
import { isPlatformHost, resolveRequestHost } from "@/lib/domainHelper";
import { Poppins, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const platformMetadata: Metadata = {
  title: "TinyURL — Enterprise URL Shortener & Link Operations Console",
  description: "Enterprise link operations, OpeninApp deep routing, threat inspection, and zero-latency analytics.",
  icons: {
    icon: "/snip-logo.svg",
    apple: "/apple_touch_icon_for_snip_creator_url_shortener_app._sleek_modern_minimalist.png",
  },
};

// Customer custom domains must not carry the platform's name in the tab title or search results.
// Pages with their own metadata (a short link's preview) still override this.
export async function generateMetadata(): Promise<Metadata> {
  try {
    const h = await headers();
    const host = resolveRequestHost(name => h.get(name));
    if (host && !isPlatformHost(host)) {
      return { title: `Link not found · ${host}`, robots: { index: false, follow: false } };
    }
  } catch {}
  return platformMetadata;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-on-surface antialiased selection:bg-primary-container/40 selection:text-on-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
