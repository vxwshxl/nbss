/**
 * Undoes the DOM edits browser extensions make before React hydrates.
 *
 * Several popular extensions stamp private attributes onto elements as the
 * HTML is parsed — Bitdefender writes `bis_skin_checked="1"` onto essentially
 * every <div>, Grammarly marks <body>, ColorZilla adds its own. React then
 * hydrates, finds attributes on the client that the server never rendered, and
 * reports a mismatch it "won't patch up".
 *
 * `suppressHydrationWarning` is not a fix here: it covers one element's own
 * attributes and does not descend, so it would have to be repeated on every
 * div on the site — and it would silence genuine mismatches on those elements
 * along with the extension's.
 *
 * So the attributes are simply removed as fast as they are added. The observer
 * is installed from a blocking script in <head>, which means it is watching
 * before the body is parsed and strips each attribute in the same task it
 * appears in — well before hydration reads the DOM. Removing an attribute
 * cannot cause it to be re-added, so this settles rather than looping.
 *
 * This ships in production too, not just development. The mismatch is not a
 * cosmetic console message: React discards and re-renders the mismatched tree,
 * so a visitor running one of these extensions was getting a slower and less
 * reliable first paint than everyone else.
 */

const ATTRIBUTES = [
  // Bitdefender ("bis" — Bitdefender Internet Security)
  "bis_skin_checked",
  "bis_register",
  "bis_size",
  // Grammarly
  "data-new-gr-c-s-check-loaded",
  "data-gr-ext-installed",
  "data-gr-c-s-loaded",
  // ColorZilla
  "cz-shortcut-listen",
];

/**
 * Minified by hand rather than by a bundler: this string is inlined into the
 * document head, where every byte is render-blocking.
 */
export const extensionNoiseScript = `(function(){try{var a=${JSON.stringify(
  ATTRIBUTES,
)};function s(n){if(n.nodeType!==1)return;for(var i=0;i<a.length;i++)if(n.hasAttribute(a[i]))n.removeAttribute(a[i])}new MutationObserver(function(m){for(var i=0;i<m.length;i++){var r=m[i];if(r.type==="attributes")s(r.target);else for(var j=0;j<r.addedNodes.length;j++)s(r.addedNodes[j])}}).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:a})}catch(e){}})()`;
