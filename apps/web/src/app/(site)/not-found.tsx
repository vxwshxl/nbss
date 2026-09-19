import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Eyebrow } from "@/components/marketing/blocks";
import { Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Section className="min-h-[60dvh] py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow num="404" text="Not on the register" className="justify-center" />

        <h1 className="mt-5 font-display text-[clamp(2rem,5vw,3rem)] leading-[1.05] font-bold tracking-[-0.03em] text-balance">
          This page is not at its post.
        </h1>

        <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground">
          The address you asked for does not exist here. It may have moved, or the link
          may have been mistyped. Everything below is where it should be.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="h-11 px-5 text-base">
            <Link href="/">
              Back to the homepage
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-11 px-5 text-base">
            <Link href="/services">Browse services</Link>
          </Button>
          <Button asChild size="lg" variant="ghost" className="h-11 px-5 text-base">
            <Link href="/contact">Book guards</Link>
          </Button>
        </div>
      </div>
    </Section>
  );
}
