# Claude Usage Bar — VS Code Extension

## Commands
```
npm install          # Install dependencies
npm run compile      # Compile TypeScript → out/
npm run watch        # Compile in watch mode
npm run lint         # ESLint check
vsce package         # Build .vsix for distribution
```

Press **F5** in VS Code to launch the Extension Development Host for testing.

## Architecture

Menu bar extension that polls Claude's internal OAuth usage endpoint and renders plan utilization in the VS Code status bar. No public API exists for this — it uses the same undocumented endpoint Claude Code itself calls.

**Data flow:** macOS Keychain (or credentials file) → OAuth token → `GET https://api.anthropic.com/api/oauth/usage` → parse response → render two `StatusBarItem`s + an output channel detail panel.

### Source files

- `src/extension.ts` — Entry point. Creates two status bar items (Session + Weekly), sets up polling timer, registers commands, renders the detail panel output channel on click.
- `src/usageService.ts` — Calls the Anthropic usage API with the OAuth bearer token. Contains formatting helpers for reset countdowns and timestamps.
- `src/credentialService.ts` — Reads the OAuth access token. Tries three sources in order: macOS Keychain (`security find-generic-password -s "Claude Code-credentials" -w`), `~/.claude/.credentials.json`, `~/.config/claude/.credentials.json`.
- `src/types.ts` — TypeScript interfaces for `UsageResponse`, `UsageBucket`, and `ClaudeCredentials`.

### API response shape
```json
{
  "five_hour":            { "utilization": 7.0,  "resets_at": "ISO8601" },
  "seven_day":            { "utilization": 1.0,  "resets_at": "ISO8601" },
  "seven_day_oauth_apps": { "utilization": 1.0,  "resets_at": "ISO8601" },
  "seven_day_opus":       { "utilization": 0.0,  "resets_at": null }
}
```

### Status bar behavior
- Two items shown by default: `Session: N%` and `Weekly: N%`
- Background turns orange (≥70%) or red (≥90%) via VS Code theme colors
- Click opens an output channel with ASCII progress bars and reset countdowns
- Configurable via `claudeUsageBar.*` settings (interval, position, which items to show)

## Conventions

- Target ES2022, CommonJS modules, strict TypeScript
- No external runtime dependencies — only VS Code API and Node built-ins
- All API/keychain errors surface as status bar warnings with tooltip messages, never throw to the user
- Polling interval defaults to 5 minutes; don't poll more aggressively to avoid rate limits
- The OAuth endpoint and auth header (`anthropic-beta: oauth-2025-04-20`) are undocumented and may change — keep them isolated in `usageService.ts`

## Watch out for

- The Keychain read uses `execSync` which blocks — it's fast (<50ms) but don't move it into a hot path
- Token expiration returns 401/403; the extension surfaces a re-auth message but cannot refresh tokens itself
- `~/.claude/` moved to `~/.config/claude/` in Claude Code v1.0.30 — `credentialService.ts` checks both paths
- The `iguana_necktie` field in the API response is of unknown purpose; it's typed but not displayed