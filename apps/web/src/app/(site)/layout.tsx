import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { WhatsAppFab } from "@/components/site/whatsapp-fab";

/**
 * The public site's chrome: a header that is clear at the top of the page and frosted once
 * it moves, the footer with the night gate along its foot, and the WhatsApp button. Both
 * fixed pieces leave with the page when the footer reaches them.
 *
 * It lives in a route group so the console is a genuinely different surface; the group's
 * parentheses keep it out of the URL.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-elevated px-4 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SmoothScroll />
      <SiteHeader />
      <main id="main" className="overflow-x-clip bg-background">
        {children}
      </main>
      <SiteFooter />
      <WhatsAppFab />
    </>
  );
}
