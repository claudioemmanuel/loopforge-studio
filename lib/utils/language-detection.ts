/**
 * Detects the Prism language identifier from a file path.
 * Used for syntax highlighting in the diff viewer.
 */

const extensionMap: Record<string, string> = {
  // TypeScript / JavaScript
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",

  // Python
  ".py": "python",

  // Go
  ".go": "go",

  // Rust
  ".rs": "rust",

  // Ruby
  ".rb": "ruby",

  // Java
  ".java": "java",

  // JSON
  ".json": "json",

  // CSS
  ".css": "css",

  // HTML / Markup
  ".html": "markup",
  ".xml": "markup",
  ".svg": "markup",

  // Markdown
  ".md": "markdown",

  // Shell
  ".sh": "bash",

  // SQL
  ".sql": "sql",

  // YAML
  ".yaml": "yaml",
  ".yml": "yaml",

  // C / C++
  ".c": "c",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".h": "c",

  // C#
  ".cs": "csharp",

  // Swift
  ".swift": "swift",

  // Kotlin
  ".kt": "kotlin",

  // PHP
  ".php": "php",

  // R
  ".r": "r",

  // Scala
  ".scala": "scala",
};

const specialFilenames: Record<string, string> = {
  Dockerfile: "docker",
  Makefile: "makefile",
  ".env": "bash",
};

/**
 * Detect the Prism language for a given file path based on its extension
 * or special filename.
 *
 * @param filePath - The file path or filename to detect language for
 * @returns The Prism language identifier, or empty string if unknown
 */
export function detectLanguage(filePath: string): string {
  // Extract the filename from the path
  const parts = filePath.split("/");
  const filename = parts[parts.length - 1] || "";

  // Check special filenames first
  if (specialFilenames[filename]) {
    return specialFilenames[filename];
  }

  // Check if the filename starts with .env (e.g., .env.local, .env.production)
  if (filename.startsWith(".env")) {
    return "bash";
  }

  // Extract the extension
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }

  const ext = filename.slice(dotIndex).toLowerCase();
  return extensionMap[ext] || "";
}
