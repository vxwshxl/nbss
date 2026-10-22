"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useFooterYield } from "@/components/site/use-footer-yield";

import { WHATSAPP_URL } from "@/content/site-nav";

const message = "Hello NBSS, I'd like to enquire about security guards for my site.";

/**
 * Floating WhatsApp button on every public page: one tap opens a pre-written enquiry.
 * It rides up with the footer, which has its own WhatsApp link.
 */
export function WhatsAppFab({ href = WHATSAPP_URL }: { href?: string }) {
  const [shown, setShown] = useState(false);
  const [hint, setHint] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFooterYield(ref);
  useEffect(() => {
    const a = setTimeout(() => setShown(true), 900);
    const b = setTimeout(() => setHint(true), 2600);
    const c = setTimeout(() => setHint(false), 8000);
    return () => [a, b, c].forEach(clearTimeout);
  }, []);

  return (
    <div
      ref={ref}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[45] sm:right-6 sm:bottom-6"
    >
      <AnimatePresence>
        {shown && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="flex items-center gap-3"
            onMouseEnter={() => setHint(true)}
            onMouseLeave={() => setHint(false)}
          >
            <AnimatePresence>
              {hint && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="hidden rounded-full bg-elevated px-4 py-2 text-[13px] font-medium text-foreground shadow-e2 sm:block"
                >
                  Enquire on WhatsApp
                </motion.span>
              )}
            </AnimatePresence>
            <a
              href={`${href}?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Enquire on WhatsApp"
              className="relative grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_rgb(37_211_102/0.45)] transition-transform duration-150 hover:scale-110 active:scale-95"
            >
              <span
                aria-hidden
                className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30 [animation-duration:2.4s]"
              />
              {/* WhatsApp's mark (brand asset, not themeable). */}
              <svg
                viewBox="0 0 24 24"
                className="relative size-7"
                fill="currentColor"
                aria-hidden
              >
                <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.7 0-3.4-.5-4.9-1.3l-.4-.2-3.6.9 1-3.5-.2-.4C3 15.7 2.4 13.9 2.4 12 2.4 6.7 6.7 2.4 12 2.4c2.6 0 5 1 6.8 2.8 1.8 1.8 2.8 4.2 2.8 6.8 0 5.3-4.3 9.8-9.6 9.8zm8.2-18C18 1.6 15.1.4 12 .4 5.6.4.4 5.6.4 12c0 2 .5 4 1.5 5.8L.3 23.7l6-1.6c1.7.9 3.7 1.4 5.7 1.4 6.4 0 11.6-5.2 11.6-11.6 0-3.1-1.2-6-3.4-8.2z" />
              </svg>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
