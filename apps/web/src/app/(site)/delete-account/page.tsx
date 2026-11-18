import type { Metadata } from "next";

import { LegalArticle } from "@/components/marketing/legal-article";
import { deleteAccount, privacyPolicy } from "@/content/legal";
import { canonical } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: canonical("/delete-account"),
  title: "Delete your account",
  description: "How to have your NBSS Kokrajhar app account and its personal information deleted, and what is kept afterwards.",
};

export default function DeleteAccountPage() {
  return <LegalArticle doc={deleteAccount} other={privacyPolicy} />;
}
