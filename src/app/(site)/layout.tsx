import { RevealFooter } from "@/components/marketing/reveal-footer";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SmoothScroll } from "@/components/marketing/smooth-scroll";
import { TopNav } from "@/components/marketing/top-nav";

/**
 * The public site's chrome.
 *
 * It lives in a route group rather than in the root layout so that the console
 * can be a genuinely different surface. An operations screen with the marketing
 * header above it and the services footer below it would be a website
 * pretending to be an application — and on a guard's phone, the nav and the
 * footer would push the one control that matters below the fold.
 *
 * The group's parentheses keep it out of the URL: this is still `/about`, not
 * `/(site)/about`.
 *
 * `overflow-x-clip` on `<main>` rather than `overflow-x-hidden`: clip does not
 * create a scroll container, so the pinned hero and any sticky child keep
 * working, while the decorative layers that deliberately bleed past the content
 * width — the blooms, the tilted marquees — can never put a horizontal
 * scrollbar on a narrow phone.
 *
 * The footer is a sibling of `<main>`, not a child, because `overflow-x-clip`
 * on an ancestor would clip the fixed element `RevealFooter` creates.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SmoothScroll />
      {/* `overlay` is decided per page: only the landing has a full-bleed hero
          built to be sat on top of. Every other page gets the spacer, from
          TopNav itself rather than from a `pt-*` each page has to remember. */}
      <main
        id="main"
        className="relative z-10 flex flex-1 flex-col overflow-x-clip bg-background"
      >
        <TopNav />
        {children}
      </main>

      <RevealFooter>
        <SiteFooter />
      </RevealFooter>
    </>
  );
}
