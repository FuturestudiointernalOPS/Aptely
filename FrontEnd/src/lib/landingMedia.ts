/**
 * Placeholder media links for the public landing page.
 * The future content Studio will overwrite these with the real URLs (demo video,
 * Instagram profile) once they exist — until then the matching embed/link stays
 * hidden so nothing broken ever shows on the live site.
 */

// Bare placeholder — no video id yet. Swap for a real link like
// "https://www.youtube.com/watch?v=XXXXXXXXXXX" (or the /embed/ form) when ready.
export const LANDING_YOUTUBE_URL = "https://youtube.com";

/** A real YouTube link carries a video id (watch?v=, youtu.be/, or /embed/) — the bare
 * placeholder domain above does not, so this stays false until a real link is set. */
export function isRealYoutubeVideoUrl(url: string): boolean {
  return /youtube\.com\/(watch\?v=|embed\/)[\w-]+|youtu\.be\/[\w-]+/.test(url);
}

/** Extracts the embeddable player URL from a youtube.com/watch or youtu.be link. */
export function toYoutubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) return url;
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
