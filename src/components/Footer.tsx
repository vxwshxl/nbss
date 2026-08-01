import Link from "next/link";

import { AronaiBand, Logo } from "@/components/Icon";
import { site, tel } from "@/content/site";

export function Footer() {
  const year = new Date().getFullYear();
  const psara = site.licenses[0];
  const gst = site.licenses.find((l) => l.label === "GSTIN");

  return (
    <footer className="footer">
      <AronaiBand />

      <div className="wrap footer__grid">
        <div className="footer__brand">
          <Link className="brand brand--footer" href="/">
            <Logo />
            <span className="brand__text">
              <strong className="brand__mark">{site.shortName}</strong>
              <span className="brand__full">{site.name}</span>
            </span>
          </Link>
          <p className="footer__blurb">{site.descriptor}</p>
          <p className="footer__tagline">{site.tagline}</p>
          <ul className="social" aria-label="Social profiles">
            {site.social.map((s) => (
              <li key={s.label}>
                <a href={s.url} aria-label={s.label} rel="noopener">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <nav className="footer__col" aria-label="Company">
          <h2 className="footer__h">Company</h2>
          <ul>
            <li><Link href="/about">About NBSS</Link></li>
            <li><Link href="/training">Training academy</Link></li>
            <li><Link href="/clients">Clients</Link></li>
            <li><Link href="/gallery">Gallery</Link></li>
            <li><Link href="/careers">Careers</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </nav>

        <nav className="footer__col" aria-label="Divisions">
          <h2 className="footer__h">Divisions</h2>
          <ul>
            <li><Link href="/services?division=security">Security services</Link></li>
            <li><Link href="/services?division=facility">Facility management</Link></li>
            <li><Link href="/services?division=manpower">Manpower &amp; staffing</Link></li>
            <li><Link href="/services?division=electronic">Electronic security</Link></li>
            <li><Link href="/sectors">Sectors we serve</Link></li>
            <li><Link href="/services">All 31 services</Link></li>
          </ul>
        </nav>

        <div className="footer__col">
          <h2 className="footer__h">Reach us</h2>
          <address className="footer__addr">
            {site.address.line1}<br />
            {site.address.line2}<br />
            {site.address.city} — {site.address.pin}<br />
            {site.address.state}
          </address>
          <ul className="footer__contact">
            <li><a href={`tel:${tel(site.phone)}`}>{site.phone}</a></li>
            <li><a href={`tel:${tel(site.phoneAlt)}`}>{site.phoneAlt}</a></li>
            <li><a href={`mailto:${site.email}`}>{site.email}</a></li>
            <li><a href={`mailto:${site.emailHr}`}>{site.emailHr}</a></li>
          </ul>
          <ul className="footer__hours">
            {site.hours.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="wrap footer__legal">
        <p>
          © {year} {site.name}. Established {site.founded}, Kokrajhar.
        </p>
        <p className="footer__licence">
          PSARA {psara?.number} · GSTIN {gst?.number}
        </p>
        <p className="footer__demo">
          Demonstration site — all names, figures and credentials are illustrative.
        </p>
      </div>
    </footer>
  );
}
