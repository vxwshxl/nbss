import Link from "next/link";
import { Clock3, MapPin, Phone } from "lucide-react";

import { AronaiBand, Mark } from "@/components/brand";
import { services } from "@/content/services";
import { site, tel } from "@/content/site";

const COMPANY = [
  { href: "/about", label: "About NBSS" },
  { href: "/training", label: "Training" },
  { href: "/gallery", label: "Gallery" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

export function SiteFooter() {
  /* Rendered on a UTC server, so the year is taken in IST — otherwise the
     copyright line rolls over five and a half hours late, and reads as the
     previous year through the whole of New Year's morning in Kokrajhar. */
  const year = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    timeZone: site.timeZone,
  });

  return (
    // `data-nav-stop` is the line the floating header yields to. See top-nav.
    <footer
      data-nav-stop
      className="border-t border-app-line-soft bg-card/60 print:hidden"
    >
      <AronaiBand className="text-primary/30" />

      <div className="mx-auto w-full max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5">
              <Mark size={40} />
              <span className="flex flex-col leading-tight">
                <span className="font-display text-base font-bold tracking-tight">
                  {site.shortName}
                </span>
                <span className="text-xs text-muted-foreground">{site.name}</span>
              </span>
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {site.descriptor}
            </p>

            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Social profiles">
              {site.social.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.url}
                    aria-label={`${site.name} on ${s.label}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press inline-flex rounded-full border border-app-line-soft bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-app-line hover:text-primary"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Company">
            <h2 className="mb-3 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              Company
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {COMPANY.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Services">
            <h2 className="mb-3 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              We guard
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {services.slice(0, 6).map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {s.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/services"
                  className="font-medium text-primary hover:underline"
                >
                  All {services.length} services
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="mb-3 text-[11px] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              Reach us
            </h2>

            <a
              href={`tel:${tel(site.phone)}`}
              className="flex items-center gap-2 font-display text-lg font-bold tracking-tight transition-colors hover:text-primary"
            >
              <Phone className="size-4 text-primary" strokeWidth={2} />
              {site.phone}
            </a>

            <address className="mt-4 flex gap-2 text-sm leading-relaxed text-muted-foreground not-italic">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.9} />
              <span>
                <span className="block font-medium text-foreground">
                  {site.address.label}
                </span>
                {site.address.lines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </address>

            <ul className="mt-4 flex flex-col gap-1.5 text-sm text-muted-foreground">
              {site.hours.map((h) => (
                <li key={h} className="flex gap-2">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.9} />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-app-line-soft pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}, {site.address.city}, {site.address.state}.
          </p>
          <nav aria-label="Legal" className="flex items-center gap-3">
            <Link href="/privacy-policy" className="transition-colors hover:text-foreground">
              Privacy Policy
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/terms-and-conditions"
              className="transition-colors hover:text-foreground"
            >
              Terms &amp; Conditions
            </Link>
            <span aria-hidden>·</span>
            <Link href="/console" className="transition-colors hover:text-foreground">
              Staff console
            </Link>
          </nav>
        </div>

        {/* Compliance categories only. The client's profile states what NBSS is
            registered and compliant under; it gives no registration numbers, so
            none are printed — and a security agency publishing a licence number
            it does not hold is a legal problem, not a copy problem. */}
        <p className="mt-3 text-xs text-muted-foreground/70">
          Registered under the Government of Assam · GST and labour compliant · ESI
          &amp; EPF as applicable
        </p>
      </div>
    </footer>
  );
}
