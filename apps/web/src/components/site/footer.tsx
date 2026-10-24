import { ArrowUp, ArrowUpRight, CalendarPlus, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";

import { GateScene } from "@/components/auth/gate-scene";
import { BrandLockup } from "@/components/brand";
import { BOOK_HREF, site, tel } from "@/content/site";
import { serviceLinks, WHATSAPP_URL } from "@/content/site-nav";

const heading = "text-sm font-semibold text-ink-fg/55";
const link = "text-[14px] sm:text-[15px] text-ink-fg/70 transition-colors duration-[120ms] hover:text-gold-soft";

const company = [
  { label: "Home", href: "/" },
  { label: "About NBSS", href: "/about" },
  { label: "Training", href: "/training" },
  { label: "Careers", href: "/careers" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact", href: "/contact" },
];

const ticker = ["Schools & colleges", "Hospitals", "Government offices", "Banks & ATMs", "Hotels", "Malls & showrooms", "Factories & warehouses", "Construction sites", "Events & VIP"];

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.7 0-3.4-.5-4.9-1.3l-.4-.2-3.6.9 1-3.5-.2-.4C3 15.7 2.4 13.9 2.4 12 2.4 6.7 6.7 2.4 12 2.4c2.6 0 5 1 6.8 2.8 1.8 1.8 2.8 4.2 2.8 6.8 0 5.3-4.3 9.8-9.6 9.8zm8.2-18C18 1.6 15.1.4 12 .4 5.6.4.4 5.6.4 12c0 2 .5 4 1.5 5.8L.3 23.7l6-1.6c1.7.9 3.7 1.4 5.7 1.4 6.4 0 11.6-5.2 11.6-11.6 0-3.1-1.2-6-3.4-8.2z" />
    </svg>
  );
}

/**
 * The site footer: a services ticker, three ways to reach the desk (each in its own app's
 * colour), the directory, and the gate at night along the foot. `data-nav-stop` is where
 * the fixed header and the WhatsApp button start leaving with the page.
 */
export function SiteFooter() {
  const actions = [
    { label: "Call the desk", value: site.phone, href: `tel:${tel(site.phone)}`, color: "#1A73E8", Icon: Phone },
    { label: "WhatsApp", value: "Chat with us", href: WHATSAPP_URL, color: "#25D366", Icon: WhatsAppIcon },
    { label: "Book guards", value: "Two-minute form", href: BOOK_HREF, color: "#10b981", Icon: CalendarPlus },
  ];

  return (
    <footer data-nav-stop className="relative isolate overflow-hidden bg-ink text-ink-fg">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_15%_0%,rgb(16_185_129/0.18),transparent_70%),radial-gradient(50%_45%_at_95%_35%,rgb(20_184_166/0.2),transparent_70%)]"
      />

      <div aria-hidden className="overflow-hidden border-b border-white/10 py-3 sm:py-5">
        <div className="animate-site-marquee flex w-max">
          {[0, 1].map((run) => (
            <div key={run} className="flex shrink-0 items-center">
              {ticker.map((t) => (
                <span key={t} className="display-section flex items-center text-[clamp(1.125rem,3vw,2.5rem)] text-ink-fg/85">
                  <span className="px-5 sm:px-8">{t}</span>
                  <span className="h-[0.5em] w-px bg-gold/60" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4 sm:px-8">
        <div className="grid gap-6 border-b border-white/10 py-10 sm:gap-10 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end lg:py-20">
          <div>
            <p className={heading}>Talk to the desk</p>
            <h2 className="display-section mt-3 text-[clamp(2rem,5.5vw,5rem)] sm:mt-4">
              Let us guard what
              <br />
              <span className="bg-[linear-gradient(90deg,var(--ds-gold-soft),var(--ds-gold))] bg-clip-text text-transparent">matters to you.</span>
            </h2>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-1 sm:gap-3 md:grid-cols-3 lg:grid-cols-1">
            {actions.map(({ label, value, href, color, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  aria-label={`${label}: ${value}`}
                  {...(href.startsWith("http") && { target: "_blank", rel: "noopener noreferrer" })}
                  style={{ ["--c" as string]: color }}
                  className="group flex h-full flex-col items-center gap-2 rounded-xl bg-(--c)/10 p-3 text-center ring-1 ring-(--c)/25 transition-[background-color,box-shadow,translate] duration-[180ms] ease-quick hover:-translate-y-0.5 hover:bg-(--c)/15 hover:ring-(--c)/60 sm:flex-row sm:gap-4 sm:p-4 sm:text-left"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-(--c) text-white shadow-[0_4px_14px_-4px_var(--c)]">
                    <Icon className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink-fg/85 sm:font-normal sm:text-ink-fg/55">{label}</span>
                    <span className="mt-0.5 hidden truncate text-[15px] font-medium sm:block">{value}</span>
                  </span>
                  <ArrowUpRight
                    className="hidden size-4 shrink-0 text-ink-fg/35 transition-[translate,color] duration-[180ms] ease-quick group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink-fg sm:block"
                    aria-hidden
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-x-5 gap-y-8 py-8 sm:gap-x-8 sm:gap-y-12 sm:py-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.2fr)]">
          <div className="col-span-2 flex flex-col items-center lg:col-span-1 lg:max-w-xs lg:items-start">
            <Link href="/" aria-label={`${site.shortName} home`} className="inline-flex text-ink-fg">
              <BrandLockup size="md" />
            </Link>
            <p className="mt-6 hidden text-[15px] leading-relaxed text-ink-fg/55 lg:block">
              Trained and disciplined security personnel for government, corporate, institutional and commercial clients across Assam, rooted in the Bodoland Territorial Region.
            </p>
          </div>

          <nav aria-label="Company">
            <p className={heading}>Company</p>
            <ul className="mt-3 grid gap-2 sm:mt-5 sm:gap-3">
              {company.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Services">
            <p className={heading}>Services</p>
            <ul className="mt-3 grid gap-2 sm:mt-5 sm:gap-3">
              {serviceLinks.slice(0, 6).map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="col-span-2 lg:col-span-1">
            <p className={heading}>Head office</p>
            <address className="mt-3 grid gap-2 not-italic sm:mt-5 sm:gap-3">
              <span className="flex gap-2.5 text-[14px] leading-relaxed text-ink-fg/70 sm:text-[15px]">
                <MapPin className="mt-1 size-4 shrink-0 text-gold-soft" aria-hidden />
                <span>
                  {site.address.lines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </span>
              </span>
              <a href={`tel:${tel(site.phone)}`} className={`${link} flex items-center gap-2.5`}>
                <Phone className="size-4 shrink-0 text-gold-soft" aria-hidden /> {site.phone}
              </a>
              <a href={`mailto:${site.email}`} className={`${link} flex items-center gap-2.5`}>
                <Mail className="size-4 shrink-0 text-gold-soft" aria-hidden /> {site.email}
              </a>
              <p className="text-[14px] text-ink-fg/55">{site.hours.join(" · ")}</p>
              <a
                href={site.address.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex w-fit items-center gap-1.5 text-[14px] font-medium text-gold-soft hover:underline"
              >
                Get directions <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </address>
          </div>
        </div>
      </div>

      <div className="relative">
        <GateScene className="mx-auto max-w-[1600px]" />
      </div>

      <div className="bg-[#040b08]">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 border-t border-dashed border-gold/30 px-4 py-4 text-center text-[12px] text-ink-fg/50 sm:px-8 sm:py-6 sm:text-left sm:text-[13px]">
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p>
              © {new Date().getFullYear()} {site.name}, {site.address.city}, {site.address.state}.
            </p>
            <div className="flex items-center gap-x-5 sm:gap-x-6">
              <Link href="/privacy-policy" className="transition-colors hover:text-ink-fg">
                Privacy Policy
              </Link>
              <Link href="/terms-and-conditions" className="transition-colors hover:text-ink-fg">
                Terms
              </Link>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
            <p>
              Developed by{" "}
              <a href="https://bodookhrang.com" target="_blank" rel="noopener noreferrer" className="font-bold text-ink-fg/80 transition-colors hover:text-gold-soft">
                Bodo Okhrang Tech Pvt. Ltd.
              </a>
            </p>
            <a href="#main" className="inline-flex items-center gap-2 font-medium text-ink-fg/70 transition-colors hover:text-gold-soft">
              Back to top <ArrowUp className="size-3.5" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
