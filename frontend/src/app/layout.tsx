import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Chaitanya's Terminal",
  description: "Market Intelligence. Options Analytics. Risk Control.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Terminal", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#121417",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
