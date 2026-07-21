import type { Metadata } from "next";
import { Inter, DM_Sans, Fraunces } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-platform-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-platform-display",
});

export const metadata: Metadata = {
  title: "SocietyOne — Society Management Platform",
  description:
    "Premium society management SaaS for apartment societies. Manage members, finance, events, complaints, and more.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${dmSans.variable} ${fraunces.variable} h-full overflow-x-hidden`}
    >
      <body
        className="min-h-full overflow-x-hidden font-sans antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
