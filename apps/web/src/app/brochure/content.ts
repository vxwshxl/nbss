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

/** The people NBSS posts, in a client's words rather than a job ad's. One line each. */
export const ROLES = [
  { title: "Security guards", body: "Gates, floors, perimeters and nights." },
  { title: "Lady security guards", body: "Women's gates, hostels, wards and frisking." },
  { title: "Supervisors", body: "Check every post, day and night." },
  { title: "Field officers", body: "Your one contact for postings and replacements." },
];

/**
 * The six reasons, short enough to read at a glance. Same order and icons as
 * `pillars` in content/site.ts, which carries the long versions for the website.
 */
export const REASONS = [
  { icon: "drill", title: "Trained first", body: "No one stands at your gate before training." },
  { icon: "clipboard-check", title: "Smart and disciplined", body: "Uniform, ID card and turnout checked every round." },
  { icon: "radio", title: "Supervised 24 × 7", body: "Supervisors and our control room watch every shift." },
  { icon: "layers", title: "Backup on call", body: "A guard is absent? We send another. You chase no one." },
  { icon: "rupee", title: "Clear pricing", body: "Wages, statutory dues and our charge, line by line." },
  { icon: "roots", title: "Local people", body: "Recruited near your site. They know the area." },
];

/** The six training areas (syllabus in content/gallery.ts), one line each. */
export const TRAINING = [
  { title: "Guarding duties", body: "Posts, registers, gate passes, strangers." },
  { title: "Fitness and parade", body: "Daily drill, turnout and discipline." },
  { title: "Fire safety", body: "Extinguishers, alarms, evacuation." },
  { title: "First aid", body: "Care until help arrives." },
  { title: "Access control", body: "Visitors, vehicles and material." },
  { title: "Crowd control", body: "Queues, events, calm handling." },
];

/** What the NBSS app does on a client's site. Every line here is a live feature. */
export const TECH = [
  { icon: MapPinned, title: "Attendance at the gate", body: "Guards check in on our app, only from inside your site.", short: "Punch-in on the NBSS app, only from inside your site." },
  { icon: Radio, title: "Live tracking", body: "Our control room sees every guard on duty, live on a map.", short: "Our control room sees every guard on duty, on a map." },
  { icon: Siren, title: "SOS button", body: "One press alerts the control room, with the location.", short: "One press alerts the control room, with location." },
  { icon: FileText, title: "Monthly reports", body: "Attendance, lateness and hours, ready for billing.", short: "Attendance, lateness and hours, ready for billing." },
];

export const STEPS = [
  { title: "Call us", body: "Tell us the site and the hours." },
  { title: "Free site visit", body: "We walk the premises and mark every post." },
  { title: "Written quote", body: "Guards, shifts and cost. No hidden charges." },
  { title: "Guards on duty", body: "Trained, verified, briefed, supervised." },
];
