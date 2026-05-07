import { UsageResponse } from "./types";
import { getAccessToken } from "./credentialService";

const USAGE_ENDPOINT = "https://api.anthropic.com/api/oauth/usage";

export interface UsageFetchResult {
  ok: true;
  data: UsageResponse;
  fetchedAt: Date;
}

export interface UsageFetchError {
  ok: false;
  error: string;
}

export type UsageResult = UsageFetchResult | UsageFetchError;

/**
 * Fetch current plan usage from the Anthropic API.
 */
export async function fetchUsage(): Promise<UsageResult> {
  const token = getAccessToken();

  if (!token) {
    return {
      ok: false,
      error:
        "No Claude Code credentials found. Make sure Claude Code is installed and you are logged in (run `claude auth login`).",
    };
  }

  try {
    const res = await fetch(USAGE_ENDPOINT, {
      method: "GET",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": "claude-usage-bar-vscode/0.1.0",
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          error:
            "Authentication failed — your token may have expired. Run `claude auth login` to re-authenticate.",
        };
      }
      return {
        ok: false,
        error: `API returned ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = await res.json() as UsageResponse;
    return { ok: true, data, fetchedAt: new Date() };
  } catch (err: any) {
    return {
      ok: false,
      error: `Network error: ${err?.message ?? String(err)}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format an ISO reset timestamp into a human-readable countdown. */
export function formatResetTime(isoString: string | null): string {
  if (!isoString) {
    return "";
  }

  const resetDate = new Date(isoString);
  const now = Date.now();
  const diffMs = resetDate.getTime() - now;

  if (diffMs <= 0) {
    return "Resetting soon";
  }

  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/** Format a Date to a short readable string. */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Short day+time label for inline status bar display, e.g. "Sat 1:30 AM". */
export function formatResetLabel(isoString: string | null): string | null {
  if (!isoString) {
    return null;
  }

  const resetDate = new Date(isoString);
  if (isNaN(resetDate.getTime())) {
    return null;
  }

  const now = new Date();
  const diffMs = resetDate.getTime() - now.getTime();

  // If less than 12 hours away, show countdown instead
  if (diffMs > 0 && diffMs < 12 * 3_600_000) {
    const hours = Math.floor(diffMs / 3_600_000);
    const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  // Otherwise show day + time, e.g. "Sat 1:30 AM"
  const day = resetDate.toLocaleDateString([], { weekday: "short" });
  const time = resetDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} ${time}`;
}
