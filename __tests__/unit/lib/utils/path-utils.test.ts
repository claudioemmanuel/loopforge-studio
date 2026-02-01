import { describe, it, expect } from "vitest";
import { expandPath, getDefaultCloneDirectory } from "@/lib/utils/path-utils";
import os from "os";
import path from "path";

describe("expandPath", () => {
  it("should expand ~ to home directory", () => {
    const result = expandPath("~/Documents/GitHub");
    expect(result).toBe(path.join(os.homedir(), "Documents", "GitHub"));
  });

  it("should return absolute paths unchanged", () => {
    expect(expandPath("/absolute/path")).toBe("/absolute/path");
  });

  it("should handle paths with ~ in the middle unchanged", () => {
    expect(expandPath("/home/user/~something")).toBe("/home/user/~something");
  });

  it("should handle empty string", () => {
    expect(expandPath("")).toBe("");
  });

  it("should handle relative paths without ~ unchanged", () => {
    expect(expandPath("relative/path")).toBe("relative/path");
  });
});

describe("getDefaultCloneDirectory", () => {
  it("should return path in home directory", () => {
    const result = getDefaultCloneDirectory();
    expect(result).toContain(os.homedir());
  });

  it("should include loopforge-repos in the path", () => {
    const result = getDefaultCloneDirectory();
    expect(result).toContain("loopforge-repos");
  });

  it("should return an absolute path", () => {
    const result = getDefaultCloneDirectory();
    expect(path.isAbsolute(result)).toBe(true);
  });
});
