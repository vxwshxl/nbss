"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

/**
 * Toasts, coloured by what they are telling you.
 *
 * They used to be one black pill for every message, which meant a successful save and
 * a failed one looked identical until you read them. In a console where half the
 * actions are irreversible — deactivating an account, issuing a new PIN, deleting a
 * person — the difference between "that worked" and "that did not" should be legible
 * before any words are.
 *
 * `richColors` turns on Sonner's per-type theming; every variable below then overrides
 * its defaults with this project's own palette, because Sonner's stock green is not the
 * green on the buttons three inches away. Each pair is a light tint with a dark ink of
 * the same hue, which holds contrast against both the white cards and the grey app
 * background the toast floats over.
 *
 * `theme="light"` is pinned deliberately. The rest of the console disarms Tailwind's
 * dark variant (see globals.css) rather than ship a half-finished dark theme, and a
 * Toaster left on "system" was the one component that would have gone dark on its own
 * on a phone set to dark mode.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          // Plain toasts — `toast("…")` with no type. Kept near-monochrome, so colour
          // stays meaningful: if everything is coloured, nothing is.
          "--normal-bg": "var(--card)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "var(--border)",

          // Success, in the brand green so it reads as the same system as the buttons.
          "--success-bg": "oklch(0.97 0.025 159)",
          "--success-text": "oklch(0.36 0.075 159)",
          "--success-border": "oklch(0.88 0.055 159)",

          // Error. Same red as `--destructive`, tinted for a background.
          "--error-bg": "oklch(0.97 0.022 27)",
          "--error-text": "oklch(0.42 0.16 27)",
          "--error-border": "oklch(0.88 0.06 27)",

          // Warning — "this worked, but read it". Amber, matching the temporary-PIN
          // marker in the guards table.
          "--warning-bg": "oklch(0.975 0.035 85)",
          "--warning-text": "oklch(0.44 0.1 68)",
          "--warning-border": "oklch(0.89 0.07 85)",

          // Info. The same sky as the console's `sky` panel tone.
          "--info-bg": "oklch(0.97 0.022 240)",
          "--info-text": "oklch(0.40 0.11 245)",
          "--info-border": "oklch(0.88 0.055 240)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          /**
           * A rounded rectangle rather than the previous `rounded-full`. A pill is fine
           * for one short line and pinches its own text once there is a description
           * under it — which most toasts in this console have, because they name the
           * person or site they acted on.
           */
          toast: "cn-toast !rounded-2xl !border !shadow-lg !items-start",
          title: "!font-semibold",
          description: "!opacity-80",
          icon: "!mt-0.5",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
