/**
 * Captures the film: drives the real website, console and app through the
 * whole story with Playwright and writes a screenshot for every step, plus
 * where the pointer went, to public/capture/timeline.json. Remotion then cuts
 * those real screens together (src/), so what the film shows is the product.
 *
 *   NEXT_DIST_DIR=.next-video next build && next start -p 3001   (apps/web)
 *   npx expo export -p web → node scripts/serve-app.mjs <dir> 8090
 *   node scripts/demo-data.mjs seed
 *   node scripts/capture.mjs            # REGISTER=api skips the emailed code
 *   node scripts/demo-data.mjs teardown
 *
 * REGISTER=real (default) signs the new client up through the real form. The
 * code is read with the admin API, but Supabase still emails one, so it goes to
 * SMTP_FROM (our own mailbox) while the screen shows a fictional address.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

import { readEnv } from "../../../scripts/db.mjs";
import { PEOPLE, STATE_FILE } from "./demo-data.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, "..", "public");
const OUT = path.join(PUBLIC, "capture");

const WEB = process.env.FILM_WEB ?? "http://localhost:3001";
const APP = process.env.FILM_APP ?? "http://localhost:8090";
const REGISTER = process.env.REGISTER ?? "real";
const HOST = "nbss.co.in";

const env = readEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});
const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
const saveState = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

// The accounts that were here before the film, kept out of shot.
const OFFSTAGE = ["NBSS Administrator"];

const CLIENT = {
  name: "Rahul Das",
  org: "Gwdan Rice Mill",
  phone: "98640 55120",
  email: "rahul@gwdanricemill.in",
};
const RICE_MILL = "Gwdan Rice Mill — main gate";

// ─────────────────────────────────────────────────────────────── recorder

const film = { scenes: [] };
let current = null;
let n = 0;

function scene(meta) {
  current = { ...meta, steps: [] };
  film.scenes.push(current);
  console.log(`\n▸ ${meta.title}`);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Waits for a page to finish what it is doing: loads, skeletons, map tiles. */
async function settle(dev, extra = 350) {
  const { page } = dev;
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[role="status"][aria-label="Loading"]'), null, { timeout: 8000 })
    .catch(() => {});
  if (await page.locator(".leaflet-container").count().catch(() => 0)) {
    await page
      .waitForFunction(
        () => {
          const tiles = document.querySelectorAll(".leaflet-tile");
          return tiles.length > 0 && [...tiles].every((t) => t.classList.contains("leaflet-tile-loaded"));
        },
        null,
        { timeout: 8000 },
      )
      .catch(() => {});
    await wait(400);
  }
  await wait(extra);
}

async function scrub(dev) {
  if (dev.kind !== "laptop") return;
  await dev.page
    .evaluate((names) => {
      for (const el of document.querySelectorAll("tr, [role=row], li")) {
        const t = el.textContent ?? "";
        if (names.some((x) => t.includes(x))) el.style.display = "none";
      }
      document.querySelector("nextjs-portal")?.remove();
    }, OFFSTAGE)
    .catch(() => {});
}

async function snap(dev) {
  await scrub(dev);
  const file = `capture/${String(++n).padStart(4, "0")}-${dev.name}.jpg`;
  await dev.page.screenshot({ path: path.join(PUBLIC, file), type: "jpeg", quality: 88 });
  return file;
}

function urlOf(dev) {
  try {
    const u = new URL(dev.page.url());
    if (u.port === "8090") return `app${u.pathname}`;
    return `${HOST}${u.pathname === "/" ? "" : u.pathname}${u.search}`;
  } catch {
    return HOST;
  }
}

function push(dev, step) {
  current.steps.push({ device: dev.name, pov: dev.pov, url: urlOf(dev), ...step });
}

/** A plain frame: whatever the device shows now. */
async function shot(dev, o = {}) {
  push(dev, { image: await snap(dev), ...o });
}

async function centre(dev, loc) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const b = await loc.boundingBox();
  if (!b) throw new Error(`no box for ${loc}`);
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
}

/**
 * Pointer goes to the element, clicks, and the screen after is recorded. The
 * frame just before the click is kept too, with the element hovered, so the
 * film shows the page as it was when the pointer arrived.
 */
async function click(dev, loc, o = {}) {
  loc = loc.first();
  await loc.waitFor({ state: "visible", timeout: 20000 });
  const at = await centre(dev, loc);
  if (o.offset) {
    at.x += o.offset.x;
    at.y += o.offset.y;
  }
  if (dev.kind === "laptop") await dev.page.mouse.move(at.x, at.y);
  await wait(dev.kind === "laptop" ? 180 : 60);
  const before = await snap(dev);
  if (o.offset) await dev.page.mouse.click(at.x, at.y);
  else await loc.click();
  if (o.until) await o.until();
  else await settle(dev);
  const { until, offset, ...rest } = o;
  push(dev, { action: { type: "click", ...at }, before, image: await snap(dev), ...rest });
}

/** Clicks into a field and types, keeping a frame every couple of keys. */
async function type(dev, loc, text, o = {}) {
  loc = loc.first();
  await loc.waitFor({ state: "visible", timeout: 20000 });
  const at = await centre(dev, loc);
  const before = await snap(dev);
  await loc.click();
  const frames = [await snap(dev)];
  const every = o.every ?? (text.length > 18 ? 3 : 2);
  for (let i = 0; i < text.length; i += every) {
    await loc.pressSequentially(text.slice(i, i + every), { delay: 12 });
    frames.push(await snap(dev));
  }
  if (o.until) await o.until();
  const { until, every: _, ...rest } = o;
  push(dev, {
    action: { type: "type", ...at, chars: text.length },
    before,
    frames,
    image: o.until ? await snap(dev) : frames[frames.length - 1],
    ...rest,
  });
}

/** A press held down — the SOS button — with frames while it fills. */
async function hold(dev, loc, ms, o = {}) {
  loc = loc.first();
  const at = await centre(dev, loc);
  const { page } = dev;
  const before = await snap(dev);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  const frames = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    frames.push(await snap(dev));
    await wait(200);
  }
  await page.mouse.up();
  if (o.until) await o.until();
  else await settle(dev, 800);
  const { until, ...rest } = o;
  push(dev, { action: { type: "hold", ...at, ms }, before, frames, image: await snap(dev), ...rest });
}

/** Scrolls something inside the page (a dialog body) and records it as a wheel. */
async function wheel(dev, selector, by, o = {}) {
  const { page } = dev;
  const el = page.locator(selector).last();
  const b = await el.boundingBox();
  const at = b ? { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height * 0.6) } : { x: 720, y: 450 };
  const before = await snap(dev);
  await el.evaluate((node, px) => node.scrollBy({ top: px, behavior: "instant" }), by);
  await settle(dev, 300);
  push(dev, { action: { type: "wheel", ...at }, before, image: await snap(dev), ...o });
}

/** A scroll down the whole page: one tall screenshot the film pans across. */
async function scrollPage(dev, o = {}) {
  const { page } = dev;
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  // Walk down first so every reveal-on-scroll section has played.
  for (let y = 0; y < height; y += 350) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await wait(110);
  }
  await wait(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(500);
  const file = `capture/${String(++n).padStart(4, "0")}-${dev.name}-full.jpg`;
  await page.screenshot({ path: path.join(PUBLIC, file), type: "jpeg", quality: 85, fullPage: true });
  const vh = page.viewportSize().height;
  push(dev, {
    scroll: { image: file, pageHeight: height, to: Math.max(0, Math.min(o.to ?? height - vh, height - vh)) },
    image: await snap(dev),
    ...o,
  });
}

// ─────────────────────────────────────────────────────────────── devices

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function laptop(pov) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [${pov}] pageerror: ${e.message.slice(0, 160)}`));
  return { name: "laptop", kind: "laptop", pov, ctx, page };
}

async function phone(name, pov, where) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "en-IN",
    timezoneId: "Asia/Kolkata",
    geolocation: where ? { latitude: where.lat, longitude: where.lng, accuracy: 12 } : undefined,
    permissions: ["geolocation"],
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [${pov}] pageerror: ${e.message.slice(0, 160)}`));
  return { name, kind: "phone", pov, ctx, page };
}

async function appSignIn(dev, email, secret, point) {
  const { page } = dev;
  await page.goto(`${APP}/`, { waitUntil: "networkidle" });
  await wait(700);
  await shot(dev, { point, hold: 0.8 });
  await type(dev, page.getByPlaceholder("you@example.com"), email, { point, every: 3 });
  await click(dev, page.getByText("Use password or PIN"), { point, hold: 0.3 });
  await type(dev, page.getByPlaceholder("••••••"), secret, { point });
  await click(dev, page.getByText("Sign in", { exact: true }).last(), {
    point,
    until: () =>
      page
        .waitForURL((u) => !u.pathname.startsWith("/sign-in") && u.pathname !== "/", { timeout: 25000 })
        .then(() => wait(2500)),
    sfx: "success",
    hold: 1.4,
  });
}

async function webSignIn(dev, identifier, secret, point) {
  const { page } = dev;
  await page.goto(`${WEB}/login`);
  await settle(dev);
  await type(dev, page.locator("#identifier"), identifier, { point });
  await click(dev, page.getByRole("button", { name: "Use password or PIN" }), { point, hold: 0.3 });
  await type(dev, page.locator("#secret"), secret, { point, secret: true });
  await click(dev, page.getByRole("button", { name: "Sign in", exact: true }), {
    point: point + 1,
    until: () => page.waitForURL(/\/console/, { timeout: 25000 }).then(() => settle(dev, 900)),
    sfx: "success",
    hold: 2,
  });
}

const nav = (dev, name) => dev.page.locator("aside, nav").getByRole("link", { name, exact: true });

/** A sidebar click that waits for the new page to be the one on screen. */
async function go(dev, name, o = {}) {
  const link = nav(dev, name).first();
  const href = await link.getAttribute("href");
  await click(dev, link, {
    ...o,
    until: () =>
      dev.page
        .waitForURL((u) => u.pathname === href, { timeout: 20000 })
        .then(() => settle(dev, 600)),
  });
}
const dialog = (dev) => dev.page.getByRole("dialog").last();
const BODY = '[role="dialog"] .overflow-y-auto';

async function closeDialog(dev) {
  await dev.page.keyboard.press("Escape");
  await wait(450);
}

// ─────────────────────────────────────────────────────────────── the story

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const visitor = await laptop("Visitor");
const office = await laptop("Admin · Anita Boro");
let failed = null;

try {
  // ── 1 · The website ───────────────────────────────────────────────────
  const mobileVisitor = await phone("phone", "Visitor · on a phone");
  scene({
    id: "website",
    title: "The website",
    heading: "A website that sells — and one door in",
    layout: "laptop+phone",
    points: [
      "Home, Services, About, Careers — four clear menus",
      "Every service explained on its own page",
      "Just as readable on a phone",
      "One Sign in for admins, guards and clients",
    ],
  });
  {
    const { page } = visitor;
    await page.goto(`${WEB}/`);
    await settle(visitor, 1400);
    await shot(visitor, { point: 0, hold: 2.2 });
    await scrollPage(visitor, { point: 0, hold: 0.4, to: 2600 });
    await click(visitor, page.locator("header").getByRole("link", { name: "Services" }), { point: 1, hold: 2 });

    await mobileVisitor.page.goto(`${WEB}/`);
    await settle(mobileVisitor, 1400);
    await shot(mobileVisitor, { point: 2, hold: 2.2 });
    await scrollPage(mobileVisitor, { point: 2, hold: 0.4, to: 2200 });

    await click(visitor, page.locator("header").getByRole("link", { name: /Sign in/ }), { point: 3, hold: 2.2 });
  }

  // ── 2 · A client signs up and books ──────────────────────────────────
  scene({
    id: "client-book",
    title: "Client signs up & books",
    heading: "A new client books guards in two minutes",
    layout: "laptop",
    points: [
      "“Create a client account” right on the sign-in page",
      "Name, organisation, mobile and email",
      "A 6-digit code by email — no password to forget",
      "Book guards: service, site, number, shift",
      "Every request gets a reference to follow",
    ],
  });
  visitor.pov = "New client · Rahul Das";
  {
    const { page } = visitor;
    await click(visitor, page.getByRole("link", { name: "Create a client account" }), { point: 0, hold: 1.2 });
    await type(visitor, page.locator("#fullName"), CLIENT.name, { point: 1 });
    await type(visitor, page.locator("#organisation"), CLIENT.org, { point: 1, every: 4 });
    await type(visitor, page.locator("#phone"), CLIENT.phone, { point: 1 });
    await type(visitor, page.locator("#email"), CLIENT.email, { point: 1, every: 3 });

    if (REGISTER === "real") {
      // The code goes to our own mailbox; the screen keeps the fictional address.
      const email = page.locator("#email");
      const cont = page.getByRole("button", { name: "Continue" });
      const at = await centre(visitor, cont);
      await page.mouse.move(at.x, at.y);
      const before = await snap(visitor);
      await email.fill(env.SMTP_FROM);
      await cont.click();
      await page.locator("#code").waitFor({ timeout: 25000 });
      await settle(visitor);
      await page.evaluate(
        ([from, to]) => {
          const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walk.nextNode()) {
            const node = walk.currentNode;
            if (node.nodeValue?.includes(from)) node.nodeValue = node.nodeValue.replaceAll(from, to);
          }
        },
        [env.SMTP_FROM, CLIENT.email],
      );
      push(visitor, { action: { type: "click", ...at }, before, image: await snap(visitor), point: 2, hold: 1.6, sfx: "notify", badge: "Code sent by email" });

      const { data: link, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: env.SMTP_FROM });
      if (error) throw error;
      await type(visitor, page.locator("#code"), link.properties.email_otp, {
        point: 2,
        every: 1,
        until: () => page.waitForURL(/\/console\/book/, { timeout: 25000 }).then(() => settle(visitor, 900)),
        sfx: "success",
        hold: 1.8,
      });

      const { data: prof } = await admin.from("profiles").select("id").eq("email", env.SMTP_FROM).single();
      state.filmUsers = [...(state.filmUsers ?? []), prof.id];
      saveState();
      await admin.auth.admin.updateUserById(prof.id, { email: CLIENT.email, email_confirm: true });
    } else {
      // Rehearsal: the account is made with the admin API and signed in with a password.
      const { data, error } = await admin.auth.admin.createUser({
        email: CLIENT.email,
        password: "Rehearsal-2026",
        email_confirm: true,
        user_metadata: { signup: "client", full_name: CLIENT.name, phone: CLIENT.phone, organisation: CLIENT.org },
      });
      if (error) throw error;
      state.filmUsers = [...(state.filmUsers ?? []), data.user.id];
      saveState();
      await wait(800);
      await page.goto(`${WEB}/login`);
      await page.locator("#identifier").fill(CLIENT.email);
      await page.getByRole("button", { name: "Use password or PIN" }).click();
      await page.locator("#secret").fill("Rehearsal-2026");
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await page.waitForURL(/\/console/);
      await page.goto(`${WEB}/console/book`);
      await settle(visitor, 900);
      await shot(visitor, { point: 2, hold: 1.2, sfx: "success" });
    }

    await click(visitor, page.locator("#service"), { point: 3, hold: 0.5 });
    await click(visitor, page.getByRole("option", { name: /Warehouse/ }), { point: 3, hold: 0.2 });
    await click(visitor, page.locator("#district"), { point: 3, hold: 0.5 });
    await click(visitor, page.getByRole("option", { name: "Kokrajhar", exact: true }), { point: 3, hold: 0.2 });
    await type(visitor, page.locator("#site_type"), "Rice mill, 4 acres", { point: 3 });
    await type(visitor, page.locator("#address"), "Titaguri Road, Kokrajhar", { point: 3, every: 4 });
    await type(visitor, page.locator("#guards_required"), "4", { point: 3 });
    await click(visitor, page.locator("#shift_pattern"), { point: 3, hold: 0.5 });
    await click(visitor, page.getByRole("option", { name: /Round the clock/ }), { point: 3, hold: 0.2 });
    await type(visitor, page.locator("#duration_months"), "12", { point: 3 });
    await click(visitor, page.getByRole("button", { name: "Send request" }), {
      point: 4,
      until: () => page.getByText(/Request SR-/).waitFor({ timeout: 25000 }).then(() => settle(visitor, 700)),
      sfx: "success",
      hold: 1.4,
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(visitor, 300);
    await click(visitor, page.locator("li").filter({ hasText: /SR-\d{4}-\d{4}/ }).filter({ hasText: /Received/ }), {
      point: 4,
      hold: 2.4,
    });
    await closeDialog(visitor);
  }

  // ── 3 · The office signs in ───────────────────────────────────────────
  scene({
    id: "admin",
    title: "One sign-in, every role",
    heading: "The office signs in — and lands on its own dashboard",
    layout: "laptop",
    points: [
      "Email or employee code, then a code or PIN",
      "Each role lands on its own dashboard",
      "Live figures: on duty, guards, sites, late, review",
      "An assistant on the right that reads the screen",
    ],
  });
  {
    const { page } = office;
    await webSignIn(office, PEOPLE.admin.code, PEOPLE.admin.password, 0);
    await shot(office, { point: 2, hold: 2.8, zoom: { x: 860, y: 380, scale: 1.3 } });
    await click(office, page.getByRole("button", { name: "Open the assistant" }), { point: 3, hold: 0.8 });
    const box = page.locator("#console-assistant textarea");
    await type(office, box, "Who is on duty right now, and is anyone late?", { point: 3, every: 4 });
    const at = await centre(office, box);
    const before = await snap(office);
    await box.press("Enter");
    // Wait for the answer to finish streaming.
    let last = "";
    let still = 0;
    for (let i = 0; i < 90 && still < 4; i++) {
      await wait(1000);
      const now = await page.locator("#console-assistant").innerText().catch(() => "");
      still = now === last && i > 4 ? still + 1 : 0;
      last = now;
    }
    push(office, { action: { type: "key", ...at }, before, image: await snap(office), point: 3, hold: 4.5, sfx: "notify" });
    await page.getByRole("button", { name: "Close the assistant" }).first().click().catch(() => {});
    await settle(office);
  }

  // ── 4 · Booking to quotation ─────────────────────────────────────────
  scene({
    id: "quote",
    title: "Booking → quotation",
    heading: "The desk answers — and the client sees it live",
    layout: "laptop",
    points: [
      "Every request lands in the Bookings inbox",
      "Click a row: contact, site, guards, shift",
      "Send a monthly quotation in one step",
      "The client’s screen updates on its own",
    ],
  });
  {
    const { page } = office;
    await go(office, "Bookings", { point: 0, hold: 1.8 });
    await click(office, page.getByRole("row").filter({ hasText: CLIENT.org }), { point: 1, hold: 2.2 });
    await click(office, dialog(office).getByRole("button", { name: "Send quotation" }), { point: 2, hold: 0.4 });
    await type(office, page.locator("#amount"), "84000", { point: 2 });
    await type(office, page.locator("#note"), "4 guards, 24×7, incl. ESI & EPF", { point: 2, every: 4 });
    await click(office, dialog(office).getByRole("button", { name: "Send quotation" }).last(), { point: 2, sfx: "success", hold: 1.4 });

    // The client's tab, untouched since they sent the request.
    await visitor.page
      .getByText(/Quoted/)
      .first()
      .waitFor({ timeout: 20000 })
      .catch(async () => {
        console.log("  (client did not update live — reloading)");
        await visitor.page.reload();
      });
    await settle(visitor, 500);
    await shot(visitor, { point: 3, hold: 3, sfx: "notify", zoom: { x: 1180, y: 330, scale: 1.5 }, badge: "Live — no refresh" });
    await closeDialog(office);
  }

  // ── 5 · Sites and geofences ───────────────────────────────────────────
  scene({
    id: "sites",
    title: "Sites & geofences",
    heading: "Every site, its fence — and who is standing there",
    layout: "laptop",
    points: [
      "All sites on one live map",
      "Click a site: guards on duty with their phone numbers",
      "Its client, fence, shift rules and SOS history",
      "Register a site by clicking the map",
      "Hand the booking over to the new site",
    ],
  });
  {
    const { page } = office;
    await go(office, "Sites & geofences", { point: 0, hold: 2.6 });
    await click(office, page.getByRole("row").filter({ hasText: "Aronai" }), { point: 1, hold: 3 });
    await wheel(office, BODY, 560, { point: 2, hold: 2.6 });
    await wheel(office, BODY, 560, { point: 2, hold: 2.4 });
    await closeDialog(office);

    await click(office, page.getByRole("button", { name: "Register a site" }), { point: 3, hold: 0.8 });
    const d = dialog(office);
    await type(office, d.locator("#name"), RICE_MILL, { point: 3, every: 4 });
    await type(office, d.locator("#client_name"), CLIENT.org, { point: 3, every: 4 });
    await type(office, d.locator("#district"), "Kokrajhar", { point: 3 });
    const map = d.locator(".leaflet-container");
    await map.scrollIntoViewIfNeeded();
    await settle(office, 600);
    await click(office, map, { point: 3, offset: { x: -60, y: 20 }, hold: 1.2 });
    const range = d.locator('input[type="range"]');
    if (await range.count()) {
      const at = await centre(office, range);
      const before = await snap(office);
      await range.evaluate((el) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        set.call(el, "220");
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await settle(office, 600);
      push(office, { action: { type: "click", x: at.x + 40, y: at.y }, before, image: await snap(office), point: 3, hold: 1.8 });
    }
    await click(office, d.getByRole("button", { name: "Register site" }), {
      point: 3,
      until: () => page.getByText("Site registered").first().waitFor({ timeout: 25000 }).then(() => settle(office, 900)),
      sfx: "success",
      hold: 2.2,
    });

    await go(office, "Bookings", { point: 4, hold: 0.8 });
    await click(office, page.getByRole("row").filter({ hasText: CLIENT.org }), { point: 4, hold: 0.9 });
    await click(office, dialog(office).getByRole("button", { name: "Mark guards deployed" }), { point: 4, hold: 0.4 });
    await click(office, page.locator("#deploy-site"), { point: 4, hold: 0.4 });
    await click(office, page.getByRole("option", { name: RICE_MILL }), { point: 4, hold: 0.3 });
    await click(office, dialog(office).getByRole("button", { name: "Mark deployed" }), { point: 4, sfx: "success", hold: 1.8 });
    await closeDialog(office);
  }

  const { data: mill } = await admin.from("sites").select("id, lat, lng, geofence_radius_m").eq("name", RICE_MILL).single();
  state.filmSites = [...(state.filmSites ?? []), mill.id];
  saveState();
  const OUTSIDE = { lat: mill.lat + 0.0105, lng: mill.lng + 0.002 };
  const INSIDE = { lat: mill.lat + 0.00012, lng: mill.lng - 0.0001 };

  // ── 6 · The roster ────────────────────────────────────────────────────
  // Rakesh's post starts at the next half hour, so on camera he checks in on time.
  const istNow = new Date(Date.now() + 5.5 * 3600e3);
  const nextHalf = Math.ceil((istNow.getUTCHours() * 60 + istNow.getUTCMinutes() + 1) / 30) * 30;
  const at = (min) => `${String(Math.floor((min % 1440) / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const POST = { starts: at(nextHalf), ends: at(nextHalf + 12 * 60) };

  /** Sets a time field — the browser's own picker is not something to film. */
  async function setTime(dev, loc, value, o = {}) {
    loc = loc.first();
    const pos = await centre(dev, loc);
    await dev.page.mouse.move(pos.x, pos.y);
    const before = await snap(dev);
    await loc.fill(value);
    await settle(dev, 250);
    push(dev, { action: { type: "click", ...pos }, before, image: await snap(dev), ...o });
  }

  scene({
    id: "roster",
    title: "The roster",
    heading: "Who guards where — planned, and checked against reality",
    layout: "laptop",
    points: [
      "Every site: how many it needs, and how many are on",
      "Post a guard to a site, a shift and the days",
      "The week ahead fills itself in from the posts",
      "Not arrived? The office sees it — and can call",
      "Checked in off the roster? Allowed, held for approval",
    ],
  });
  {
    const { page } = office;
    await go(office, "Roster", { point: 0, hold: 3 });
    await click(office, page.getByRole("button", { name: "Post a guard" }).first(), { point: 1, hold: 0.6 });
    const d = dialog(office);
    await click(office, d.locator("#posting-guard"), { point: 1, hold: 0.4 });
    await click(office, page.getByRole("option", { name: new RegExp(PEOPLE.guard.name) }), { point: 1, hold: 0.3 });
    await click(office, d.locator("#posting-site"), { point: 1, hold: 0.4 });
    await click(office, page.getByRole("option", { name: RICE_MILL }), { point: 1, hold: 0.3 });
    await setTime(office, d.locator("#posting-starts"), POST.starts, { point: 1, hold: 0.4 });
    await setTime(office, d.locator("#posting-ends"), POST.ends, { point: 1, hold: 1 });
    await click(office, d.getByRole("button", { name: "Save post" }), {
      point: 1,
      until: () => page.getByText(/posted/i).first().waitFor({ timeout: 20000 }).then(() => settle(office, 900)),
      sfx: "success",
      hold: 1.8,
    });
    await click(office, page.getByRole("row").filter({ hasText: RICE_MILL }), { point: 2, hold: 2.6 });
    await wheel(office, BODY, 420, { point: 2, hold: 2.4 });
    await closeDialog(office);
    await click(office, page.getByRole("row").filter({ hasText: "Dwisa" }).getByRole("button").first(), {
      point: 3,
      hold: 3,
      badge: "Raju has not arrived",
      sfx: "error",
    });
    await closeDialog(office);
    await click(office, page.getByRole("button", { name: "Approve" }), {
      point: 4,
      until: () => page.getByText(/approved/i).first().waitFor({ timeout: 20000 }).then(() => settle(office, 900)),
      sfx: "success",
      hold: 2.2,
    });
  }

  // ── 7 · The guard's app ───────────────────────────────────────────────
  const guard = await phone("phone", "Guard · Rakesh Narzary", OUTSIDE);
  scene({
    id: "attendance",
    title: "Attendance with a geofence",
    heading: "A guard can only check in standing inside the fence",
    layout: "laptop+phone",
    points: [
      "The app shows the guard tonight’s post",
      "Outside the fence: check-in stays locked",
      "Walk inside: the button unlocks",
      "Check in — the office sees it the same second",
      "Click the punch: where they stood, against the fence",
    ],
  });
  {
    const { page } = guard;
    await go(office, "Attendance", { point: 0, hold: 0.6 });
    await appSignIn(guard, PEOPLE.guard.email, PEOPLE.guard.password, 0);
    await page.getByText(RICE_MILL).first().waitFor({ timeout: 20000 }).catch(() => {});
    await wait(1500);
    await shot(guard, { point: 1, hold: 3, sfx: "error", badge: "1.2 km from the gate" });

    await guard.ctx.setGeolocation({ latitude: INSIDE.lat, longitude: INSIDE.lng, accuracy: 9 });
    const unlocked = await page
      .getByText(/Inside the boundary/)
      .first()
      .waitFor({ timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    if (!unlocked) {
      await page.reload({ waitUntil: "networkidle" });
      await page.getByText(/Inside the boundary/).first().waitFor({ timeout: 20000 });
    }
    await wait(900);
    await shot(guard, { point: 2, hold: 2.4, badge: "At the gate" });

    const checkIn = page.getByText("Check in", { exact: true }).first();
    await click(guard, checkIn, {
      point: 3,
      until: () => page.getByText(/On duty|ON DUTY/).first().waitFor({ timeout: 25000 }).then(() => wait(1800)),
      sfx: "success",
      hold: 1.4,
    });
    const row = office.page.getByRole("row").filter({ hasText: PEOPLE.guard.name });
    await row.first().waitFor({ timeout: 20000 }).catch(async () => {
      console.log("  (ledger did not update live — reloading)");
      await office.page.reload();
    });
    await settle(office, 500);
    await shot(office, { point: 3, hold: 3, sfx: "notify", badge: "Live — no refresh", zoom: { x: 720, y: 330, scale: 1.35 } });
    await click(office, row, { point: 4, hold: 3.4 });
    await closeDialog(office);
  }

  // ── 7 · SOS ────────────────────────────────────────────────────────────
  const sup = await phone("phone2", "Supervisor · Ranjit Brahma");
  scene({
    id: "sos",
    title: "SOS",
    heading: "One long press brings help",
    layout: "trio",
    points: [
      "Hold for three seconds — no pocket alarms",
      "The office sees it at once, with the guard’s number",
      "Supervisors are alerted on their phones",
      "“On the way” — the guard sees help is coming",
      "Closed as resolved, with the full record kept",
    ],
  });
  {
    await go(office, "Dashboard", { point: 0, hold: 0.5 });
    await appSignIn(sup, PEOPLE.supervisor.email, PEOPLE.supervisor.password, 2);
    await settle(sup, 1200);

    const g = guard.page;
    const button = g.getByText("Hold 3s for help").first();
    await button.scrollIntoViewIfNeeded();
    await wait(500);
    await shot(guard, { point: 0, hold: 0.8 });
    await hold(guard, button, 3400, {
      point: 0,
      until: () => g.waitForURL(/\/sos\//, { timeout: 25000 }).then(() => wait(1500)),
      sfx: "alarm",
      hold: 1.6,
    });

    const strip = office.page.getByText(/live SOS alert/);
    await strip.first().waitFor({ timeout: 20000 }).catch(async () => {
      console.log("  (dashboard did not update live — reloading)");
      await office.page.reload();
    });
    await settle(office, 500);
    await shot(office, { point: 1, hold: 2.6, sfx: "alarm", badge: "Live SOS", zoom: { x: 850, y: 230, scale: 1.35 } });
    await click(office, office.page.locator("li").filter({ hasText: /Rakesh Narzary ·/ }), { point: 1, hold: 3 });
    await closeDialog(office);

    const s = sup.page;
    const open = s.getByText("Open", { exact: true }).first();
    const live = await open.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    if (!live) {
      await s.reload({ waitUntil: "networkidle" });
      await open.waitFor({ timeout: 20000 });
    }
    await wait(800);
    await shot(sup, { point: 2, hold: 2.2, sfx: "alarm", badge: "Alert received" });
    await click(sup, open, { point: 2, until: () => s.waitForURL(/\/sos\//).then(() => wait(1800)), hold: 1.6 });
    await click(sup, s.getByText("I am on the way").first(), { point: 3, until: () => wait(2500), sfx: "success", hold: 1.2 });
    await wait(1500);
    await shot(guard, { point: 3, hold: 2.6, badge: "Help is coming" });

    await click(office, office.page.locator("li").filter({ hasText: /Rakesh Narzary ·/ }), { point: 4, hold: 1.4 });
    await wheel(office, BODY, 480, { point: 4, hold: 1.8 });
    await type(office, office.page.getByPlaceholder(/What happened/), "Stray cattle at the gate — all clear.", { point: 4, every: 4 });
    await click(office, dialog(office).getByRole("button", { name: "Resolved" }), {
      point: 4,
      until: () => office.page.getByText("Alert closed as resolved").first().waitFor({ timeout: 20000 }).then(() => settle(office, 900)),
      sfx: "success",
      hold: 1.6,
    });
    await wait(2000);
    await shot(guard, { point: 4, hold: 2.2 });
  }

  // ── 8 · Stats and people ──────────────────────────────────────────────
  scene({
    id: "stats",
    title: "Stats & people",
    heading: "Every figure the office needs, one click away",
    layout: "laptop",
    points: [
      "The dashboard, updated as it happens",
      "Click any guard for a 30-day picture",
      "Users by role: admins, supervisors, guards, clients",
      "The SOS log: response times and false alarms",
    ],
  });
  {
    const { page } = office;
    await settle(office, 400);
    await shot(office, { point: 0, hold: 2.6, zoom: { x: 860, y: 420, scale: 1.25 } });
    await go(office, "Guards", { point: 1, hold: 1.2 });
    await click(office, page.getByRole("row").filter({ hasText: PEOPLE.guard.code }), { point: 1, hold: 3.4 });
    await closeDialog(office);
    await go(office, "Users", { point: 2, hold: 1.4 });
    await click(office, page.getByRole("button", { name: /^Clients/ }), { point: 2, hold: 1.4 });
    await click(office, page.getByRole("row").filter({ hasText: CLIENT.name }), { point: 2, hold: 2.6 });
    await closeDialog(office);
    await go(office, "SOS alerts", { point: 3, hold: 3 });
  }

  // ── 9 · The client's view ─────────────────────────────────────────────
  const clientPhone = await phone("phone", "Client app · Aronai Agro Foods");
  scene({
    id: "client",
    title: "The client’s view",
    heading: "Clients watch their own site — and nothing else",
    layout: "laptop+phone",
    points: [
      "Who is on duty at their gate, live",
      "Tap a guard: since when, verified at the fence",
      "The same view in the app",
      "No other client’s sites, no guard coordinates",
    ],
  });
  {
    const { page } = visitor;
    await go(visitor, "My site", { point: 0, hold: 2.6 });
    await click(visitor, page.getByRole("row").filter({ hasText: PEOPLE.guard.name }), { point: 1, hold: 2.8 });
    await closeDialog(visitor);
    await appSignIn(clientPhone, PEOPLE.clientA.email, PEOPLE.clientA.password, 2);
    await settle(clientPhone, 1200);
    await shot(clientPhone, { point: 2, hold: 2.4 });
    await scrollPage(clientPhone, { point: 3, hold: 1.2, to: 700 });
  }
} catch (e) {
  failed = e;
  console.error(`\n✗ ${e instanceof Error ? e.stack : e}`);
  for (const [i, ctx] of browser.contexts().entries()) {
    for (const [j, p] of ctx.pages().entries()) await p.screenshot({ path: path.join(OUT, `_fail-${i}-${j}.png`) }).catch(() => {});
  }
} finally {
  fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(film, null, 1));
  await browser.close();
  const steps = film.scenes.reduce((s, x) => s + x.steps.length, 0);
  console.log(`\n${film.scenes.length} scenes, ${steps} steps, ${n} images → public/capture/timeline.json`);
  if (failed) process.exit(1);
}
