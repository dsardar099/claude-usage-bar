import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { ClaudeCredentials } from "./types";

/**
 * Reads the Claude Code OAuth access token.
 *
 * Tries these sources in order:
 *  1. macOS Keychain ("Claude Code-credentials")
 *  2. ~/.claude/.credentials.json
 *  3. ~/.config/claude/.credentials.json
 */
export function getAccessToken(): string | null {
  return (
    readFromKeychain() ??
    readFromCredentialsFile("~/.claude/.credentials.json") ??
    readFromCredentialsFile("~/.config/claude/.credentials.json")
  );
}

// ---------------------------------------------------------------------------
// macOS Keychain
// ---------------------------------------------------------------------------

function readFromKeychain(): string | null {
  if (process.platform !== "darwin") {
    return null;
  }

  try {
    const raw = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w',
      { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    const creds: ClaudeCredentials = JSON.parse(raw);
    return creds.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Credentials file on disk
// ---------------------------------------------------------------------------

function readFromCredentialsFile(filePath: string): string | null {
  try {
    const resolved = filePath.startsWith("~")
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;

    if (!fs.existsSync(resolved)) {
      return null;
    }

    const raw = fs.readFileSync(resolved, "utf-8");
    const creds: ClaudeCredentials = JSON.parse(raw);
    return creds.claudeAiOauth?.accessToken ?? null;
  } catch {
    return null;
  }
}
