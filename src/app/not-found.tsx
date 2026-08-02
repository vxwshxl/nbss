import Link from "next/link";

import { Eyebrow } from "@/components/blocks";

export default function NotFound() {
  return (
    <section className="section section--404">
      <div className="wrap narrow">
        <Eyebrow num="404" text="Not on the register" />
        <h1 className="e404__h">This page is not at its post.</h1>
        <p className="e404__p">
          The address you asked for does not exist here. It may have moved, or the link may have
          been mistyped. Everything below is where it should be.
        </p>
        <div className="e404__links">
          <Link className="btn btn--gold btn--lg" href="/">Back to the homepage</Link>
          <Link className="btn btn--ghost btn--lg" href="/services">Browse services</Link>
          <Link className="btn btn--ghost btn--lg" href="/contact">Contact us</Link>
        </div>
      </div>
    </section>
  );
}
