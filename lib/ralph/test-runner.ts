/**
 * Test Runner - Executes tests with streaming output
 * Supports timeout, cancellation, and result parsing
 */

import { spawn, type ChildProcess } from "child_process";
import { EventEmitter } from "events";

export interface TestRunOptions {
  command: string;
  cwd: string;
  timeout?: number; // milliseconds, default 5 minutes
  env?: Record<string, string>;
  onOutput?: (data: string, stream: "stdout" | "stderr") => void;
}

export interface TestRunResult {
  success: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  signal: string | null;
}

export type TestRunStatus =
  | "running"
  | "passed"
  | "failed"
  | "timeout"
  | "skipped";

/**
 * Run tests and return the result
 */
export async function runTests(
  options: TestRunOptions,
): Promise<TestRunResult> {
  const {
    command,
    cwd,
    timeout = 300000, // 5 minutes default
    env = {},
    onOutput,
  } = options;

  return new Promise((resolve) => {
    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timeoutId: NodeJS.Timeout | null = null;

    // Parse command into executable and args
    const parts = parseCommand(command);
    const executable = parts[0];
    const args = parts.slice(1);

    // Spawn the process
    const proc = spawn(executable, args, {
      cwd,
      shell: true,
      env: { ...process.env, ...env, CI: "true", FORCE_COLOR: "0" },
    });

    // Set timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill("SIGTERM");
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill("SIGKILL");
          }
        }, 5000);
      }, timeout);
    }

    // Collect stdout
    proc.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      stdout += text;
      onOutput?.(text, "stdout");
    });

    // Collect stderr
    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      stderr += text;
      onOutput?.(text, "stderr");
    });

    // Handle process exit
    proc.on("close", (code, signal) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const durationMs = Date.now() - startTime;

      resolve({
        success: code === 0,
        exitCode: code,
        stdout,
        stderr,
        durationMs,
        timedOut,
        signal: signal ?? null,
      });
    });

    // Handle errors
    proc.on("error", (error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const durationMs = Date.now() - startTime;

      resolve({
        success: false,
        exitCode: null,
        stdout,
        stderr: stderr + `\nProcess error: ${error.message}`,
        durationMs,
        timedOut: false,
        signal: null,
      });
    });
  });
}

/**
 * Create a streaming test runner with event emitter
 */
export class StreamingTestRunner extends EventEmitter {
  private process: ChildProcess | null = null;
  private aborted = false;

  async run(options: TestRunOptions): Promise<TestRunResult> {
    this.aborted = false;

    const result = await runTests({
      ...options,
      onOutput: (data, stream) => {
        if (!this.aborted) {
          this.emit("output", { data, stream });
          options.onOutput?.(data, stream);
        }
      },
    });

    if (!this.aborted) {
      this.emit("complete", result);
    }

    return result;
  }

  abort(): void {
    this.aborted = true;
    if (this.process && !this.process.killed) {
      this.process.kill("SIGTERM");
    }
    this.emit("aborted");
  }
}

/**
 * Parse a command string into executable and arguments
 * Handles quoted strings
 */
function parseCommand(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const char of command) {
    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
      quoteChar = "";
    } else if (!inQuote && char === " ") {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Determine test status from result
 */
export function getTestStatus(result: TestRunResult): TestRunStatus {
  if (result.timedOut) {
    return "timeout";
  }
  if (result.success) {
    return "passed";
  }
  return "failed";
}

/**
 * Parse test output to extract summary info
 * This is a best-effort parser that works with common formats
 */
export function parseTestSummary(output: string): {
  total?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
} {
  const summary: {
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
  } = {};

  // Jest/Vitest pattern: "Tests: X failed, Y passed, Z total"
  const jestMatch = output.match(
    /Tests:\s*(?:(\d+)\s*failed,?\s*)?(?:(\d+)\s*passed,?\s*)?(?:(\d+)\s*skipped,?\s*)?(\d+)\s*total/i,
  );
  if (jestMatch) {
    summary.failed = jestMatch[1] ? parseInt(jestMatch[1], 10) : 0;
    summary.passed = jestMatch[2] ? parseInt(jestMatch[2], 10) : 0;
    summary.skipped = jestMatch[3] ? parseInt(jestMatch[3], 10) : 0;
    summary.total = parseInt(jestMatch[4], 10);
    return summary;
  }

  // pytest pattern: "X passed, Y failed, Z skipped"
  const pytestMatch = output.match(
    /(\d+)\s*passed(?:,\s*(\d+)\s*failed)?(?:,\s*(\d+)\s*skipped)?/i,
  );
  if (pytestMatch) {
    summary.passed = parseInt(pytestMatch[1], 10);
    summary.failed = pytestMatch[2] ? parseInt(pytestMatch[2], 10) : 0;
    summary.skipped = pytestMatch[3] ? parseInt(pytestMatch[3], 10) : 0;
    summary.total = summary.passed + summary.failed + (summary.skipped ?? 0);
    return summary;
  }

  // Go pattern: "ok\t..." or "FAIL\t..."
  const goOkMatches = output.match(/^ok\s+/gm);
  const goFailMatches = output.match(/^FAIL\s+/gm);
  if (goOkMatches || goFailMatches) {
    summary.passed = goOkMatches?.length ?? 0;
    summary.failed = goFailMatches?.length ?? 0;
    summary.total = summary.passed + summary.failed;
    return summary;
  }

  // Rust/Cargo pattern: "test result: ok. X passed; Y failed; Z ignored"
  const rustMatch = output.match(
    /test result:.*?(\d+)\s*passed.*?(\d+)\s*failed.*?(\d+)\s*ignored/i,
  );
  if (rustMatch) {
    summary.passed = parseInt(rustMatch[1], 10);
    summary.failed = parseInt(rustMatch[2], 10);
    summary.skipped = parseInt(rustMatch[3], 10);
    summary.total = summary.passed + summary.failed + summary.skipped;
    return summary;
  }

  return summary;
}

/**
 * Format test duration for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}
