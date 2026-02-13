import type { ExtractedFile } from './code-extractor.js'

/**
 * Resolves and validates file paths from extracted code blocks.
 * Prevents directory traversal attacks and ensures paths are within repository bounds.
 */
export function resolveFilePaths(
  extractedFiles: ExtractedFile[],
  repositoryStructure: string[]
): Map<string, string> {
  const resolved = new Map<string, string>()

  for (const file of extractedFiles) {
    // Security: prevent directory traversal
    if (file.path.includes('..')) {
      throw new Error(`Invalid path (directory traversal detected): ${file.path}`)
    }

    // Normalize path (remove leading slash if present)
    const normalizedPath = file.path.startsWith('/') ? file.path.slice(1) : file.path

    // Additional validation: ensure path doesn't start with dangerous patterns
    if (normalizedPath.startsWith('/') || normalizedPath.startsWith('~')) {
      throw new Error(`Invalid path (absolute path not allowed): ${file.path}`)
    }

    resolved.set(normalizedPath, file.content)
  }

  return resolved
}
