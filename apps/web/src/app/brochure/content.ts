import {
  Banknote,
  BellRing,
  BookOpen,
  ClipboardCheck,
  Factory,
  FileText,
  Flag,
  HardHat,
  HeartPulse,
  Landmark,
  Layers,
  MapPinned,
  Radio,
  ShoppingBag,
  Siren,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Lists the brochure and the one-pager both print, kept in one place so the two
 * never disagree. Company facts (services, pillars, stats, contacts) come from
 * `@/content`, as on the website.
 */

export const SERVICE_ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  cross: HeartPulse,
  landmark: Landmark,
  bank: Banknote,
  bell: BellRing,
  cart: ShoppingBag,
  factory: Factory,
  helmet: HardHat,
  flag: Flag,
};

export const PILLAR_ICONS: Record<string, LucideIcon> = {
  drill: Target,
  "clipboard-check": ClipboardCheck,
  radio: Radio,
  layers: Layers,
  rupee: Banknote,
  roots: Users,
};

/** The people NBSS posts, in a client's words rather than a job ad's. */
export const ROLES = [
  { title: "Security guards", body: "Gate, floor, perimeter and night duty, in full uniform with identity cards." },
  { title: "Lady security guards", body: "Women's entrances, hostels, frisking, wards and examination halls." },
  { title: "Supervisors", body: "Check every post on their round, day and night, and answer for the shift." },
  { title: "Field officers", body: "Your single point of contact: postings, replacements and the monthly review." },
];

/** What the NBSS app does on a client's site. Every line here is a live feature. */
export const TECH = [
  { icon: MapPinned, title: "Attendance at the gate", body: "Guards punch in and out on the NBSS app, and only from inside your site's boundary.", short: "Punch-in on the NBSS app, only from inside your site." },
  { icon: Radio, title: "Live tracking", body: "Our control room sees where every guard on duty is, on a map, as it happens.", short: "Our control room sees every guard on duty, on a map." },
  { icon: Siren, title: "SOS button", body: "One press raises an alarm at the control room with the guard's location.", short: "One press alerts the control room, with location." },
  { icon: FileText, title: "Monthly reports", body: "Attendance, late arrivals and hours for your site, ready for billing and review.", short: "Attendance, lateness and hours, ready for billing." },
];

export const STEPS = [
  { title: "Call or message us", body: "Tell us the site, the hours to be covered and anything special." },
  { title: "Free site visit", body: "A field officer walks the premises and marks every post." },
  { title: "Clear quote", body: "Guards, shifts and the monthly cost, in writing. No hidden charges." },
  { title: "Guards on duty", body: "Trained, verified and briefed for your site, with a supervisor assigned." },
];
