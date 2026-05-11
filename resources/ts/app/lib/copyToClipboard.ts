/**
 * Cross-environment clipboard copy.
 * Tries the modern Clipboard API first; falls back to the legacy
 * execCommand approach for contexts where the Clipboard API is
 * blocked (e.g. iframes, Figma Make preview).
 * Returns true if copy likely succeeded, false otherwise.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Modern API — works in secure top-level contexts
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // fall through to execCommand
    }
  }
  return fallback(text);
}

function fallback(text: string): boolean {
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(el);
  el.focus();
  el.select();
  el.setSelectionRange(0, text.length); // iOS
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) { /* silent */ }
  document.body.removeChild(el);
  return ok;
}