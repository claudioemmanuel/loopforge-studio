import { beforeEach, describe, expect, it } from "vitest";
import { readSourceFile } from "../../helpers/source-file";

describe("Activity health navigation wiring", () => {
  let desktopSidebarContent: string;
  let mobileSidebarContent: string;
  let bannerContent: string;
  let nextConfigContent: string;

  beforeEach(() => {
    desktopSidebarContent = readSourceFile(
      __dirname,
      "components/sidebar/desktop-sidebar.tsx",
    );
    mobileSidebarContent = readSourceFile(
      __dirname,
      "components/sidebar/mobile-sidebar.tsx",
    );
    bannerContent = readSourceFile(
      __dirname,
      "components/layout/system-status-banner.tsx",
    );
    nextConfigContent = readSourceFile(__dirname, "next.config.ts");
  });

  it("adds health as an Activity sub-item in desktop sidebar", () => {
    expect(desktopSidebarContent).toContain('href: "/activity/health"');
    expect(desktopSidebarContent).toContain('labelKey: "health"');
  });

  it("adds health as an Activity sub-item in mobile sidebar", () => {
    expect(mobileSidebarContent).toContain('href: "/activity/health"');
    expect(mobileSidebarContent).toContain('labelKey: "health"');
  });

  it("routes worker health banner actions to /activity/health", () => {
    expect(bannerContent).toContain('actionUrl: "/activity/health"');
    expect(bannerContent).not.toContain('actionUrl: "/workers/health"');
  });

  it("redirects legacy /workers/health to /activity/health", () => {
    expect(nextConfigContent).toContain('source: "/workers/health"');
    expect(nextConfigContent).toContain('destination: "/activity/health"');
  });
});
