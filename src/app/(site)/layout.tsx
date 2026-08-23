import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

/**
 * The public site's chrome.
 *
 * It lives in a route group rather than in the root layout so that the console
 * can be a genuinely different surface. An operations screen with the
 * marketing header above it and the services footer below it would be a
 * website pretending to be an application — and on a guard's phone, the nav
 * and the footer would push the one control that matters below the fold.
 *
 * The group's parentheses keep it out of the URL: this is still "/about", not
 * "/(site)/about".
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
