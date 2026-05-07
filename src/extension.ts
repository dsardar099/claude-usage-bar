import * as vscode from "vscode";
import {
  fetchUsage,
  formatResetTime,
  formatTimestamp,
  UsageResult,
} from "./usageService";
import { UsageBucket } from "./types";

// ── State ──────────────────────────────────────────────────────────────────

let statusItem: vscode.StatusBarItem | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let latestResult: UsageResult | undefined;

// ── Activation ─────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  const cfg = vscode.workspace.getConfiguration("claudeUsageBar");
  const alignment =
    cfg.get<string>("position") === "left"
      ? vscode.StatusBarAlignment.Left
      : vscode.StatusBarAlignment.Right;
  const priority = cfg.get<number>("priority") ?? 100;
  const showMode = cfg.get<string>("showInStatusBar") ?? "both";

  statusItem = vscode.window.createStatusBarItem(alignment, priority);
  statusItem.command = "claudeUsageBar.showDetails";
  statusItem.name = "Claude Usage";
  setLoading(statusItem, showMode);
  statusItem.show();
  context.subscriptions.push(statusItem);

  // ── Commands ──
  context.subscriptions.push(
    vscode.commands.registerCommand("claudeUsageBar.refresh", () => refresh()),
    vscode.commands.registerCommand("claudeUsageBar.showDetails", () =>
      showDetailsPanel()
    )
  );

  // ── Initial fetch ──
  refresh();

  // ── Polling timer ──
  const intervalMs = (cfg.get<number>("refreshIntervalMinutes") ?? 5) * 60_000;
  timer = setInterval(() => refresh(), intervalMs);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });

  // ── React to config changes ──
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("claudeUsageBar")) {
        vscode.window.showInformationMessage(
          "Claude Usage Bar: Reload the window to apply configuration changes."
        );
      }
    })
  );
}

export function deactivate() {
  if (timer) {
    clearInterval(timer);
  }
}

// ── Core refresh ───────────────────────────────────────────────────────────

async function refresh() {
  if (!statusItem) return;

  const cfg = vscode.workspace.getConfiguration("claudeUsageBar");
  const showMode = cfg.get<string>("showInStatusBar") ?? "both";

  const result = await fetchUsage();
  latestResult = result;

  if (!result.ok) {
    setError(statusItem, result.error);
    return;
  }

  const { data } = result;

  if (showMode === "session") {
    updateItem(statusItem, "Session", data.five_hour, null);
  } else if (showMode === "weekly") {
    updateItem(statusItem, "Weekly", null, data.seven_day);
  } else {
    updateItem(statusItem, "both", data.five_hour, data.seven_day);
  }
}

// ── Status bar rendering ───────────────────────────────────────────────────

function updateItem(
  item: vscode.StatusBarItem,
  mode: string,
  session: UsageBucket | null,
  weekly: UsageBucket | null
) {
  if (mode === "Session" && session) {
    const pct = Math.round(session.utilization);
    item.text = `${getIcon(pct)} Session: ${pct}%`;
    item.tooltip = buildTooltip("Session", pct, session);
    item.backgroundColor = getBackground(pct);
  } else if (mode === "Weekly" && weekly) {
    const pct = Math.round(weekly.utilization);
    item.text = `${getIcon(pct)} Weekly: ${pct}%`;
    item.tooltip = buildTooltip("Weekly", pct, weekly);
    item.backgroundColor = getBackground(pct);
  } else {
    // "both" — single item, combined text
    const sPct = session ? Math.round(session.utilization) : null;
    const wPct = weekly ? Math.round(weekly.utilization) : null;
    const maxPct = Math.max(sPct ?? 0, wPct ?? 0);

    const sPart = sPct !== null ? `Session: ${sPct}%` : "Session: N/A";
    const wPart = wPct !== null ? `Weekly: ${wPct}%` : "Weekly: N/A";
    item.text = `${getIcon(maxPct)} ${sPart} | ${wPart}`;

    const sReset = session ? formatResetTime(session.resets_at) : "";
    const wReset = weekly ? formatResetTime(weekly.resets_at) : "";
    item.tooltip = new vscode.MarkdownString(
      [
        `**Claude Session Usage:** ${sPct !== null ? `${sPct}%` : "N/A"}${sReset ? `\n\n⏱ ${sReset}` : ""}`,
        `\n\n**Claude Weekly Usage:** ${wPct !== null ? `${wPct}%` : "N/A"}${wReset ? `\n\n⏱ ${wReset}` : ""}`,
        `\n\n_Click for full details_`,
      ].join("")
    );
    item.backgroundColor = getBackground(maxPct);
  }
}

function buildTooltip(label: string, pct: number, bucket: UsageBucket) {
  const resetStr = formatResetTime(bucket.resets_at);
  return new vscode.MarkdownString(
    `**Claude ${label} Usage:** ${pct}%\n\n${resetStr ? `⏱ ${resetStr}` : ""}\n\n_Click for full details_`
  );
}

function setLoading(item: vscode.StatusBarItem, mode: string) {
  if (mode === "session") {
    item.text = `$(loading~spin) Session: …`;
  } else if (mode === "weekly") {
    item.text = `$(loading~spin) Weekly: …`;
  } else {
    item.text = `$(loading~spin) Session: … | Weekly: …`;
  }
  item.tooltip = "Fetching Claude usage…";
}

function setError(item: vscode.StatusBarItem, message: string) {
  item.text = `$(sparkle) Claude: ⚠`;
  item.tooltip = message;
  item.backgroundColor = new vscode.ThemeColor(
    "statusBarItem.warningBackground"
  );
}

function getIcon(pct: number): string {
  if (pct >= 90) return "$(warning)";
  if (pct >= 70) return "$(flame)";
  return "$(sparkle)";
}

function getBackground(pct: number): vscode.ThemeColor | undefined {
  if (pct >= 90) return new vscode.ThemeColor("statusBarItem.errorBackground");
  if (pct >= 70) return new vscode.ThemeColor("statusBarItem.warningBackground");
  return undefined;
}

// ── Detail panel (shown on click) ──────────────────────────────────────────

function showDetailsPanel() {
  if (!latestResult) {
    vscode.window.showInformationMessage("Claude usage data not loaded yet.");
    return;
  }

  if (!latestResult.ok) {
    vscode.window.showErrorMessage(
      `Claude Usage Error: ${latestResult.error}`
    );
    return;
  }

  const { data, fetchedAt } = latestResult;

  const lines: string[] = [
    `Claude Plan Usage  (updated ${formatTimestamp(fetchedAt)})`,
    `${"─".repeat(48)}`,
    "",
    formatBucketLine("Current Session (5h)", data.five_hour),
    formatBucketLine("All Models (7d)     ", data.seven_day),
    formatBucketLine("Sonnet Only (7d)    ", data.seven_day_oauth_apps),
    formatBucketLine("Opus Only (7d)      ", data.seven_day_opus),
    "",
    `${"─".repeat(48)}`,
    "Run 'Claude Usage: Refresh' to update.",
  ];

  const panel = vscode.window.createOutputChannel("Claude Usage", {
    log: true,
  });
  panel.clear();
  panel.appendLine(lines.join("\n"));
  panel.show(true);
}

function formatBucketLine(label: string, bucket: UsageBucket | null): string {
  if (!bucket) {
    return `${label}  │  N/A`;
  }

  const pct = Math.round(bucket.utilization);
  const bar = renderBar(pct, 20);
  const reset = formatResetTime(bucket.resets_at);

  return `${label}  │ ${bar}  ${String(pct).padStart(3)}%  ${reset}`;
}

function renderBar(pct: number, width: number): string {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}
