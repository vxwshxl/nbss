import type { Metadata } from "next";

import { LegalArticle } from "@/components/Legal";
import { privacyPolicy, termsAndConditions } from "@/content/legal";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/privacy-policy"),
  title: "Privacy Policy",
  description:
    "What this website collects through its forms, why, where it is stored, and the rights visitors hold over it under the Digital Personal Data Protection Act, 2023.",
};

export default function PrivacyPolicyPage() {
  return <LegalArticle doc={privacyPolicy} other={termsAndConditions} />;
}
