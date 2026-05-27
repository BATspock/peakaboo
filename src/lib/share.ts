import { Platform, Share } from "react-native";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/**
 * Share a viewpoint link cross-platform.
 * - Native (iOS/Android): opens the OS share sheet via React Native's Share
 * - Web with Web Share API (mobile Safari/Chrome): same OS share sheet
 * - Web without (desktop browsers): copies the URL to the clipboard and
 *   resolves with "copied" so the caller can show a "Link copied" toast
 */
export async function shareViewpoint(args: {
  url: string;
  viewpointName: string;
  subjectName: string;
}): Promise<ShareResult> {
  const { url, viewpointName, subjectName } = args;
  const title = `${viewpointName} on PeakAboo`;
  // Short text intro — intentionally does NOT include the URL, since some
  // platforms concatenate text+url into a single string and we end up with
  // garbage URLs like "/v/<uuid> Amazon office grace — a viewpoint..."
  // when users copy from the share sheet.
  const text = `${viewpointName} — a viewpoint for ${subjectName} on PeakAboo.`;

  if (Platform.OS === "web") {
    const nav: Navigator | undefined =
      typeof navigator !== "undefined" ? navigator : undefined;

    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title, text, url });
        return "shared";
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        if (name === "AbortError") return "cancelled";
        // Fall through to clipboard.
      }
    }

    // Fallback: copy ONLY the URL (no message) so pasting it into the
    // address bar always Just Works.
    try {
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        return "copied";
      }
      if (typeof document !== "undefined") {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok ? "copied" : "failed";
      }
    } catch {
      return "failed";
    }
    return "failed";
  }

  // Native — RN's Share takes either {message} or {url}. iOS keeps them
  // separate; Android concatenates if you pass both. Pass message + url
  // is the standard pattern and OS-native enough to be acceptable.
  try {
    const result = await Share.share({
      title,
      message: `${text} ${url}`,
      url,
    });
    if (result.action === Share.dismissedAction) return "cancelled";
    return "shared";
  } catch {
    return "failed";
  }
}

/**
 * Build the canonical share URL for a viewpoint.
 * Uses the current origin on web; on native we hardcode the deployed
 * origin since native users still want a web-openable link.
 */
export function viewpointShareUrl(viewpointId: string): string {
  const fallback = "https://peakaboo-zeta.vercel.app";
  const origin =
    Platform.OS === "web" && typeof window !== "undefined"
      ? window.location.origin
      : fallback;
  return `${origin}/v/${viewpointId}`;
}
