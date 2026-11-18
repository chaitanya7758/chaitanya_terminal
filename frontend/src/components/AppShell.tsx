"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { InstrumentProvider, useInstrument, type Instrument } from "@/lib/instrument";

const NAV = [
  { href: "/", label: "Pulse", short: "Pulse" },
  { href: "/brief", label: "10-Point Brief", short: "Brief" },
  { href: "/expiry", label: "Expiry", short: "Expiry" },
  { href: "/fibonacci", label: "Fibonacci", short: "Fib" },
  { href: "/portfolio", label: "Portfolio", short: "P&L" },
  { href: "/ai", label: "AI Analysis Centre", short: "AI" },
];

function Selector() {
  const { instrument, setInstrument } = useInstrument();
  return (
    <div role="radiogroup" aria-label="Instrument" className="flex rounded-md border border-line bg-panel-2 p-0.5 text-xs font-semibold">
      {(["NIFTY", "SENSEX"] as Instrument[]).map((i) => (
        <button
          key={i}
          role="radio"
          aria-checked={instrument === i}
          onClick={() => setInstrument(i)}
          className={`rounded px-3 py-1.5 ${instrument === i ? "bg-accent text-black" : "text-muted"}`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  return (
    <button
      aria-label="Toggle light or dark theme"
      className="rounded-md border border-line px-2 py-1.5 text-xs text-muted"
      onClick={() => {
        const dark = document.documentElement.classList.toggle("dark");
        try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
      }}
    >
      Theme
    </button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/login") return <main className="px-4">{children}</main>;
  return (
    <InstrumentProvider>
      <div className="min-h-dvh pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0 md:pl-52">
        <aside className="fixed inset-y-0 left-0 hidden w-52 flex-col border-r border-line bg-panel md:flex">
          <div className="px-4 py-4">
            <div className="text-sm font-bold tracking-wide">CHAITANYA&apos;S TERMINAL</div>
            <div className="mt-0.5 text-[10px] text-muted">Market Intelligence. Options Analytics. Risk Control.</div>
          </div>
          <nav className="flex flex-col gap-0.5 px-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={`rounded px-3 py-2 text-sm ${path === n.href ? "bg-panel-2 font-semibold text-text" : "text-muted hover:text-text"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-line px-4 py-3 text-[10px] text-muted">Read-only. Order execution disabled.</div>
        </aside>

        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/95 px-4 pb-2 pt-[calc(8px+env(safe-area-inset-top))] backdrop-blur">
          <div className="text-xs font-bold tracking-wide md:hidden">CT</div>
          <Selector />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/settings" className="rounded-md border border-line px-2 py-1.5 text-xs text-muted">Connections</Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-6 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={`py-3 text-center text-[11px] ${path === n.href ? "font-semibold text-accent" : "text-muted"}`}>
              {n.short}
            </Link>
          ))}
        </nav>
      </div>
    </InstrumentProvider>
  );
}
