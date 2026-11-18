"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Instrument = "NIFTY" | "SENSEX";
const Ctx = createContext<{ instrument: Instrument; setInstrument: (i: Instrument) => void }>({
  instrument: "NIFTY",
  setInstrument: () => {},
});

export function InstrumentProvider({ children }: { children: React.ReactNode }) {
  const [instrument, set] = useState<Instrument>("NIFTY");
  useEffect(() => {
    try {
      const v = localStorage.getItem("instrument");
      if (v === "NIFTY" || v === "SENSEX") set(v);
    } catch {}
  }, []);
  const setInstrument = (i: Instrument) => {
    set(i);
    try { localStorage.setItem("instrument", i); } catch {}
  };
  return <Ctx.Provider value={{ instrument, setInstrument }}>{children}</Ctx.Provider>;
}
export const useInstrument = () => useContext(Ctx);
