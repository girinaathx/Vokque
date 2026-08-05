import { toast } from "sonner";

/**
 * Reliable clipboard copy for both mobile and desktop.
 * Falls back to a hidden textarea + execCommand when the async
 * Clipboard API is unavailable (non-secure contexts, older mobile browsers).
 */
export async function copyText(text: string, message = "Copied"): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      if (message) toast.success(message);
      return true;
    }
  } catch {
    /* fall through to legacy path */
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) {
      if (message) toast.success(message);
      return true;
    }
  } catch {
    /* ignore */
  }

  toast.error("Couldn't copy");
  return false;
}
