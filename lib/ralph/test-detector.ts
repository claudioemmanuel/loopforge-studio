/**
 * Test Detector - Auto-detects test commands for various frameworks
 * Supports Node.js, Python, Go, Rust, Ruby, Java, and more
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface TestConfig {
  command: string;
  framework: string;
  confidence: "high" | "medium" | "low";
}

export interface DetectionResult {
  detected: boolean;
  configs: TestConfig[];
  recommended: TestConfig | null;
}

/**
 * Detect test command for a repository
 */
export async function detectTestCommand(
  repoPath: string,
): Promise<DetectionResult> {
  const configs: TestConfig[] = [];

  // Check Node.js (package.json)
  const nodeConfig = detectNodeTests(repoPath);
  if (nodeConfig) configs.push(...nodeConfig);

  // Check Python
  const pythonConfig = detectPythonTests(repoPath);
  if (pythonConfig) configs.push(...pythonConfig);

  // Check Go
  const goConfig = detectGoTests(repoPath);
  if (goConfig) configs.push(goConfig);

  // Check Rust
  const rustConfig = detectRustTests(repoPath);
  if (rustConfig) configs.push(rustConfig);

  // Check Ruby
  const rubyConfig = detectRubyTests(repoPath);
  if (rubyConfig) configs.push(...rubyConfig);

  // Check Java/Kotlin (Gradle/Maven)
  const javaConfig = detectJavaTests(repoPath);
  if (javaConfig) configs.push(javaConfig);

  // Check PHP
  const phpConfig = detectPhpTests(repoPath);
  if (phpConfig) configs.push(phpConfig);

  // Check Elixir
  const elixirConfig = detectElixirTests(repoPath);
  if (elixirConfig) configs.push(elixirConfig);

  // Sort by confidence
  configs.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });

  return {
    detected: configs.length > 0,
    configs,
    recommended: configs[0] ?? null,
  };
}

/**
 * Detect Node.js test frameworks
 */
function detectNodeTests(repoPath: string): TestConfig[] | null {
  const packageJsonPath = join(repoPath, "package.json");
  if (!existsSync(packageJsonPath)) return null;

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const configs: TestConfig[] = [];

    // Check scripts.test
    if (
      packageJson.scripts?.test &&
      packageJson.scripts.test !== 'echo "Error: no test specified" && exit 1'
    ) {
      configs.push({
        command: "npm test",
        framework: "npm scripts",
        confidence: "high",
      });
    }

    // Detect specific frameworks
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    if (deps.vitest) {
      configs.push({
        command: "npx vitest run",
        framework: "Vitest",
        confidence: "high",
      });
    }

    if (deps.jest) {
      configs.push({
        command: "npx jest",
        framework: "Jest",
        confidence: "high",
      });
    }

    if (deps.mocha) {
      configs.push({
        command: "npx mocha",
        framework: "Mocha",
        confidence: "medium",
      });
    }

    if (deps.ava) {
      configs.push({
        command: "npx ava",
        framework: "AVA",
        confidence: "medium",
      });
    }

    if (deps.tap) {
      configs.push({
        command: "npx tap",
        framework: "tap",
        confidence: "medium",
      });
    }

    if (deps.playwright || deps["@playwright/test"]) {
      configs.push({
        command: "npx playwright test",
        framework: "Playwright",
        confidence: "medium",
      });
    }

    if (deps.cypress) {
      configs.push({
        command: "npx cypress run",
        framework: "Cypress",
        confidence: "medium",
      });
    }

    return configs.length > 0 ? configs : null;
  } catch {
    return null;
  }
}

/**
 * Detect Python test frameworks
 */
function detectPythonTests(repoPath: string): TestConfig[] | null {
  const configs: TestConfig[] = [];

  // Check for pytest
  const pyprojectPath = join(repoPath, "pyproject.toml");
  const setupPyPath = join(repoPath, "setup.py");
  const requirementsPath = join(repoPath, "requirements.txt");
  const requirementsDevPath = join(repoPath, "requirements-dev.txt");

  let hasPytest = false;
  // eslint-disable-next-line prefer-const
  let hasUnittest = false; // Reserved for future unittest detection

  // Check pyproject.toml
  if (existsSync(pyprojectPath)) {
    try {
      const content = readFileSync(pyprojectPath, "utf-8");
      if (content.includes("pytest")) hasPytest = true;
    } catch {
      /* ignore */
    }
  }

  // Check requirements files
  for (const reqPath of [requirementsPath, requirementsDevPath]) {
    if (existsSync(reqPath)) {
      try {
        const content = readFileSync(reqPath, "utf-8");
        if (content.includes("pytest")) hasPytest = true;
      } catch {
        /* ignore */
      }
    }
  }

  // Check for test directories
  const testDirs = ["tests", "test", "spec"];
  const hasTestDir = testDirs.some((dir) => existsSync(join(repoPath, dir)));

  if (hasPytest || hasTestDir) {
    configs.push({
      command: "pytest",
      framework: "pytest",
      confidence: hasPytest ? "high" : "medium",
    });
  }

  // Always suggest unittest as fallback for Python projects
  if (existsSync(setupPyPath) || existsSync(pyprojectPath)) {
    configs.push({
      command: "python -m unittest discover",
      framework: "unittest",
      confidence: "low",
    });
  }

  return configs.length > 0 ? configs : null;
}

/**
 * Detect Go tests
 */
function detectGoTests(repoPath: string): TestConfig | null {
  const goModPath = join(repoPath, "go.mod");
  if (!existsSync(goModPath)) return null;

  // Check for test files
  const hasTestFiles = existsSync(join(repoPath, "go.mod"));

  return {
    command: "go test ./...",
    framework: "Go testing",
    confidence: hasTestFiles ? "high" : "medium",
  };
}

/**
 * Detect Rust tests
 */
function detectRustTests(repoPath: string): TestConfig | null {
  const cargoPath = join(repoPath, "Cargo.toml");
  if (!existsSync(cargoPath)) return null;

  return {
    command: "cargo test",
    framework: "Cargo",
    confidence: "high",
  };
}

/**
 * Detect Ruby tests
 */
function detectRubyTests(repoPath: string): TestConfig[] | null {
  const gemfilePath = join(repoPath, "Gemfile");
  if (!existsSync(gemfilePath)) return null;

  const configs: TestConfig[] = [];

  try {
    const content = readFileSync(gemfilePath, "utf-8");

    if (content.includes("rspec")) {
      configs.push({
        command: "bundle exec rspec",
        framework: "RSpec",
        confidence: "high",
      });
    }

    if (content.includes("minitest")) {
      configs.push({
        command: "bundle exec rake test",
        framework: "Minitest",
        confidence: "high",
      });
    }

    // Rails default
    if (content.includes("rails")) {
      configs.push({
        command: "bundle exec rails test",
        framework: "Rails",
        confidence: "medium",
      });
    }
  } catch {
    /* ignore */
  }

  return configs.length > 0 ? configs : null;
}

/**
 * Detect Java/Kotlin tests (Gradle/Maven)
 */
function detectJavaTests(repoPath: string): TestConfig | null {
  // Check Gradle
  if (
    existsSync(join(repoPath, "build.gradle")) ||
    existsSync(join(repoPath, "build.gradle.kts"))
  ) {
    const gradlew = existsSync(join(repoPath, "gradlew"))
      ? "./gradlew"
      : "gradle";
    return {
      command: `${gradlew} test`,
      framework: "Gradle",
      confidence: "high",
    };
  }

  // Check Maven
  if (existsSync(join(repoPath, "pom.xml"))) {
    const mvnw = existsSync(join(repoPath, "mvnw")) ? "./mvnw" : "mvn";
    return {
      command: `${mvnw} test`,
      framework: "Maven",
      confidence: "high",
    };
  }

  return null;
}

/**
 * Detect PHP tests
 */
function detectPhpTests(repoPath: string): TestConfig | null {
  const composerPath = join(repoPath, "composer.json");
  if (!existsSync(composerPath)) return null;

  try {
    const composer = JSON.parse(readFileSync(composerPath, "utf-8"));
    const deps = { ...composer.require, ...composer["require-dev"] };

    if (deps["phpunit/phpunit"]) {
      return {
        command: "./vendor/bin/phpunit",
        framework: "PHPUnit",
        confidence: "high",
      };
    }

    if (deps["pestphp/pest"]) {
      return {
        command: "./vendor/bin/pest",
        framework: "Pest",
        confidence: "high",
      };
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * Detect Elixir tests
 */
function detectElixirTests(repoPath: string): TestConfig | null {
  if (existsSync(join(repoPath, "mix.exs"))) {
    return {
      command: "mix test",
      framework: "ExUnit",
      confidence: "high",
    };
  }
  return null;
}

/**
 * Get a human-readable description of the test configuration
 */
export function describeTestConfig(config: TestConfig): string {
  return `${config.framework} (${config.confidence} confidence): ${config.command}`;
}
