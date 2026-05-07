# Claude Usage Bar — VS Code Extension

Shows your Claude Pro/Max plan usage limits directly in the VS Code status bar.

![demo](resources/demo.png)

## What It Shows

| Metric | Source |
|--------|--------|
| **Current Session** | 5-hour rolling window utilization |
| **All Models (weekly)** | 7-day usage across all models |
| **Sonnet Only (weekly)** | 7-day Sonnet-specific usage |
| **Opus Only (weekly)** | 7-day Opus-specific usage |

The status bar turns **orange at 70%** and **red at 90%** usage. Click the status bar item for a full breakdown.

## Prerequisites

- **Claude Code** installed and authenticated (`claude auth login`)
- **macOS** (reads credentials from Keychain) — Linux/Windows support via credentials file

## Install & Run (Development)

```bash
# Clone / copy the project
cd claude-usage-bar

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Open in VS Code
code .
```

Then press **F5** to launch the Extension Development Host.

## Package for Production

```bash
# Install packaging tool
npm install -g @vscode/vsce

# Build the .vsix
vsce package

# Install locally
code --install-extension claude-usage-bar-0.1.0.vsix
```

## Settings

Open **Settings → Extensions → Claude Usage Bar**:

| Setting | Default | Description |
|---------|---------|-------------|
| `refreshIntervalMinutes` | `5` | Polling interval (1–60 min) |
| `showInStatusBar` | `session` | Show `session`, `weekly`, or `both` |
| `position` | `right` | Status bar side (`left` / `right`) |
| `priority` | `100` | Higher = further left in status bar |

## Commands

- **Claude Usage: Refresh** — Force an immediate data refresh
- **Claude Usage: Show Details** — Open full usage panel (also triggered by clicking the status bar)

## How It Works

1. Reads your Claude Code OAuth token from macOS Keychain (`Claude Code-credentials`)
2. Calls `GET https://api.anthropic.com/api/oauth/usage` with that token
3. Renders utilization percentages in the status bar
4. Polls automatically every N minutes

## Troubleshooting

**"No Claude Code credentials found"**
→ Run `claude auth login` in your terminal to authenticate Claude Code.

**"Authentication failed — token may have expired"**
→ Run `claude auth login` again to get a fresh token.

**Data looks stale**
→ Run the `Claude Usage: Refresh` command, or check your polling interval setting.

## License

MIT
