import { services } from "@/content/services";

/** The public site's navigation, in the shape the header and footer read. */
export type NavLink = { label: string; href: string; description?: string };
export type NavEntry = NavLink | { label: string; href: string; items: NavLink[] };

export const serviceLinks: NavLink[] = services.map((s) => ({
  label: s.name,
  href: `/services/${s.slug}`,
  description: s.summary,
}));

export const nav: NavEntry[] = [
  { label: "About", href: "/about" },
  { label: "Services", href: "/services", items: serviceLinks.slice(0, 6) },
  { label: "Training", href: "/training" },
  { label: "Gallery", href: "/gallery" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
];

/** WhatsApp number from site.social, as a wa.me link. */
export const WHATSAPP_URL = "https://wa.me/917577036205";
