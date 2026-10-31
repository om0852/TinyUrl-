import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "TinyURL — Enterprise URL Shortener & Link Operations Console",
  description: "Enterprise link operations, OpeninApp deep routing, threat inspection, and zero-latency analytics.",
  icons: {
    icon: "/snip-logo.svg",
    apple: "/apple_touch_icon_for_snip_creator_url_shortener_app._sleek_modern_minimalist.png",
  },
};

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
