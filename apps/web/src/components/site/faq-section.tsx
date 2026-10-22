import Link from "next/link";

import { FaqChat } from "@/components/site/faq-chat";
import { faqs } from "@/content/site";

/** Questions as a conversation, beside a sticky heading. */
export function FaqSection() {
  return (
    <section aria-labelledby="faq-title" className="bg-background py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <p className="eyebrow">Questions</p>
          <h2 id="faq-title" className="display-section mt-4 text-[clamp(2.25rem,5vw,4rem)]">
            Questions,
            <br />
            <span className="text-secondary-fg">Answered.</span>
          </h2>
          <p className="mt-4 max-w-sm text-secondary-fg">
            Still wondering about something?{" "}
            <Link href="/contact" className="font-medium text-primary-ink hover:underline">
              Ask us directly
            </Link>
            .
          </p>
        </div>
        <div>
          <noscript>
            <style>{".faq-bubble{opacity:1!important;transform:none!important}"}</style>
          </noscript>
          <FaqChat items={faqs} />
        </div>
      </div>
    </section>
  );
}
