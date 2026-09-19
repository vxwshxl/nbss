"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { FieldErrors, FormState } from "@/lib/validate";

/**
 * Holds the live value of every control in a form.
 *
 * React 19 resets an uncontrolled form once its action resolves, which would
 * wipe what the visitor typed whenever validation fails. So the fields are
 * controlled here instead: local state drives them, and it is re-seeded from
 * the values the server echoed back each time a new result arrives.
 */

type FormContextValue = {
  values: Record<string, string>;
  errors: FieldErrors;
  set: (name: string, value: string) => void;
};

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({
  state,
  seed,
  children,
}: {
  state: FormState;
  /** Initial values not supplied by the server, e.g. a pre-selected service. */
  seed?: Record<string, string>;
  children: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => ({
    ...seed,
    ...state.values,
  }));

  // `state.values` is a fresh object on every action result, so identity is a
  // reliable signal that the server has replied.
  const lastResult = useRef(state.values);
  useEffect(() => {
    if (state.values === lastResult.current) return;
    lastResult.current = state.values;
    setValues((current) => ({ ...current, ...state.values }));
  }, [state.values]);

  const set = useCallback((name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  const context = useMemo<FormContextValue>(
    () => ({ values, errors: state.errors, set }),
    [values, state.errors, set],
  );

  return <FormContext.Provider value={context}>{children}</FormContext.Provider>;
}

export function useFormField(name: string) {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("Form fields must be rendered inside a <FormProvider>.");
  }
  return {
    value: context.values[name] ?? "",
    error: context.errors[name],
    set: (value: string) => context.set(name, value),
  };
}

export function useFormErrors(): FieldErrors {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error("useFormErrors must be called inside a <FormProvider>.");
  }
  return context.errors;
}
