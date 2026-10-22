/** Short rupees: ₹4.2 L, ₹1.30 Cr, ₹12,345. */
export function formatInr(v: number) {
  const n = Number(v) || 0;
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(1)} L`;
  return `${sign}₹${Math.round(a).toLocaleString("en-IN")}`;
}
