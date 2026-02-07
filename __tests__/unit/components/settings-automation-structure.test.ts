import { beforeEach, describe, expect, it } from "vitest";
import { readSourceFile } from "../../helpers/source-file";

describe("Settings automation structure", () => {
  let automationPageSource: string;
  let preferencesPageSource: string;

  beforeEach(() => {
    automationPageSource = readSourceFile(
      __dirname,
      "app/(dashboard)/settings/automation/page.tsx",
    );
    preferencesPageSource = readSourceFile(
      __dirname,
      "app/(dashboard)/settings/preferences/page.tsx",
    );
  });

  it("uses a node-based flow in automation settings", () => {
    expect(automationPageSource).toContain("ReactFlow");
    expect(automationPageSource).toContain("default-behaviors");
  });

  it("keeps default behaviors out of the preferences page", () => {
    expect(preferencesPageSource).not.toContain("Default Behaviors");
    expect(preferencesPageSource).not.toContain("Require plan approval");
  });
});
