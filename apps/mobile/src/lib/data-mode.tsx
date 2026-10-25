import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Test / Live, as the website's header switch has it (see 0036_test_live.sql).
 *
 * Every request the app makes to Supabase carries the mode as the `x-nbss-mode`
 * header (lib/supabase.ts reads it from here). The database honours it for
 * developers only; everyone else sees the side their own account is on, whatever
 * this says. Remembered on the phone, as the website remembers it in a cookie.
 */
export type DataMode = "live" | "test";

export const DATA_MODE_HEADER = "x-nbss-mode";
const STORAGE_KEY = "nbss-data-mode";

let current: DataMode = "live";

/** The mode the next request goes out with. */
export function dataMode(): DataMode {
  return current;
}

type Ctx = { mode: DataMode; setMode: (mode: DataMode) => Promise<void> };

const DataModeContext = createContext<Ctx>({ mode: "live", setMode: async () => {} });

/**
 * Holds its children until the saved mode is read, so no request goes out on the
 * wrong side, and remounts them on a switch: every screen, list, map and live feed
 * starts again on the chosen side, as the website reloads the page.
 */
export function DataModeProvider({ children }: { children: (mode: DataMode) => React.ReactNode }) {
  const [mode, setState] = useState<DataMode | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((saved) => {
        current = saved === "test" ? "test" : "live";
        setState(current);
      });
  }, []);

  const setMode = useCallback(async (next: DataMode) => {
    current = next;
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  if (!mode) return null;
  return <DataModeContext.Provider value={{ mode, setMode }}>{children(mode)}</DataModeContext.Provider>;
}

export function useDataMode(): Ctx {
  return useContext(DataModeContext);
}
