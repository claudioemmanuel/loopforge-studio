import * as fs from "fs";
import * as path from "path";

function findRepoRoot(startDir: string): string {
  let current = startDir;

  while (true) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error("Unable to locate repository root from test path");
    }

    current = parent;
  }
}

export function readSourceFile(
  testDir: string,
  workspaceRelativePath: string,
): string {
  const root = findRepoRoot(testDir);
  const filePath = path.join(root, workspaceRelativePath);
  return fs.readFileSync(filePath, "utf-8");
}
