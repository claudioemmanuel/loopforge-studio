export interface ExtractedFile {
  path: string
  language: string
  content: string
}

/**
 * Extracts code blocks from AI-generated output.
 * Expected format: ```typescript\n// File: path/to/file.ts\n[code]\n```
 */
export function extractCodeBlocks(aiOutput: string): ExtractedFile[] {
  // Regex: ```(typescript|javascript|tsx|jsx)?\n// File: (.+?)\n([\s\S]+?)```
  const codeBlockRegex = /```(?:typescript|javascript|tsx|jsx)?\n\/\/ File: (.+?)\n([\s\S]+?)```/g
  const files: ExtractedFile[] = []

  let match
  while ((match = codeBlockRegex.exec(aiOutput)) !== null) {
    const [, path, content] = match
    const ext = path.split('.').pop() || 'ts'
    const language = ['ts', 'tsx'].includes(ext) ? 'typescript' : 'javascript'

    files.push({
      path: path.trim(),
      language,
      content: content.trim(),
    })
  }

  return files
}
