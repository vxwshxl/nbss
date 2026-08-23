import type { Metadata } from "next";

import { LegalArticle } from "@/components/Legal";
import { privacyPolicy, termsAndConditions } from "@/content/legal";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/terms-and-conditions"),
  title: "Terms & Conditions",
  description:
    "The terms this website is offered on: how its content, quotations and job applications work, intellectual property, liability, and governing law.",
};

export default function TermsAndConditionsPage() {
  return <LegalArticle doc={termsAndConditions} other={privacyPolicy} />;
}
