import type { PrintBranding } from "@/lib/ui/print";
import { site } from "@/content/site";

/**
 * The letterhead on anything this console prints.
 *
 * NBSS is one organisation, not a platform with tenants, so this is a constant
 * rather than a React context threaded down from a layout: there is no second
 * value it could ever hold. It reads from `content/site` so a printed duty
 * roster and the footer of the public site can never disagree about the
 * company's own address.
 */
export const PRINT_BRANDING: PrintBranding = {
  name: site.name,
  logoUrl: "/logo/nbss-256.webp",
  address: [site.address.city, site.address.region, site.address.state].join(", "),
};
