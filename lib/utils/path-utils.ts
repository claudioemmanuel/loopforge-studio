import path from "path";
import os from "os";
import fs from "fs/promises";

/**
 * Expand ~ to home directory
 */
export function expandPath(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

/**
 * Get OS-specific default clone directory
 */
export function getDefaultCloneDirectory(): string {
  const homeDir = os.homedir();
  const platform = os.platform();

  if (platform === "win32") {
    return path.join(homeDir, "Documents", "GitHub", "loopforge-repos");
  }

  // macOS/Linux: prefer ~/Documents/GitHub/loopforge-repos
  return path.join(homeDir, "Documents", "GitHub", "loopforge-repos");
}

/**
 * Validate directory - check existence and writability
 */
export async function validateCloneDirectory(dirPath: string): Promise<{
  valid: boolean;
  exists: boolean;
  writable: boolean;
  error?: string;
}> {
  const expanded = expandPath(dirPath);

  try {
    await fs.access(expanded);

    // Test writability
    const testFile = path.join(expanded, `.loopforge-test-${Date.now()}`);
    try {
      await fs.writeFile(testFile, "test");
      await fs.unlink(testFile);
      return { valid: true, exists: true, writable: true };
    } catch {
      return {
        valid: false,
        exists: true,
        writable: false,
        error: "Directory is not writable",
      };
    }
  } catch {
    // Check if parent exists (can create directory)
    const parentDir = path.dirname(expanded);
    try {
      await fs.access(parentDir);
      return {
        valid: true,
        exists: false,
        writable: true,
        error: "Directory will be created",
      };
    } catch {
      return {
        valid: false,
        exists: false,
        writable: false,
        error: "Parent directory does not exist",
      };
    }
  }
}

/**
 * Ensure directory exists, creating with recursive: true
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  const expanded = expandPath(dirPath);
  await fs.mkdir(expanded, { recursive: true });
}
