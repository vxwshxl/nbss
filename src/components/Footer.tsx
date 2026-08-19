import Link from "next/link";

import { AronaiBand, Logo } from "@/components/Icon";
import { services } from "@/content/services";
import { site, tel } from "@/content/site";

export function Footer() {
  const year = new Date().getFullYear();

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
            <li><Link href="/training">Training</Link></li>
            <li><Link href="/gallery">Gallery</Link></li>
            <li><Link href="/careers">Careers</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </nav>

        <nav className="footer__col" aria-label="Services">
          <h2 className="footer__h">We guard</h2>
          <ul>
            {services.slice(0, 6).map((s) => (
              <li key={s.slug}>
                <Link href={`/services/${s.slug}`}>{s.name}</Link>
              </li>
            ))}
            <li><Link href="/services">All {services.length} services</Link></li>
          </ul>
        </nav>

        <div className="footer__col">
          <h2 className="footer__h">Reach us</h2>
          <address className="footer__addr">
            {site.address.label}
            <br />
            {site.address.lines.map((line) => (
              <span key={line} style={{ display: "block" }}>
                {line}
              </span>
            ))}
          </address>
          <ul className="footer__contact">
            <li><a href={`tel:${tel(site.phone)}`}>{site.phone}</a></li>
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
          © {year} {site.name}, Kokrajhar, Assam.
        </p>
        <nav className="footer__policies" aria-label="Legal">
          <Link href="/privacy-policy">Privacy Policy</Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms-and-conditions">Terms &amp; Conditions</Link>
        </nav>
        <p className="footer__licence">
          Registered under the Government of Assam · GST and labour compliant · ESI &amp; EPF as
          applicable
        </p>
      </div>
    </footer>
  );
}
