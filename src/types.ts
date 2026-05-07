/** Response from https://api.anthropic.com/api/oauth/usage */
export interface UsageResponse {
  five_hour: UsageBucket | null;
  seven_day: UsageBucket | null;
  seven_day_oauth_apps: UsageBucket | null;
  seven_day_opus: UsageBucket | null;
  iguana_necktie: UsageBucket | null;
}

export interface UsageBucket {
  utilization: number; // 0–100
  resets_at: string | null; // ISO 8601
}

/** Credential structure stored in macOS Keychain */
export interface ClaudeCredentials {
  claudeAiOauth?: {
    accessToken: string;
  };
}
