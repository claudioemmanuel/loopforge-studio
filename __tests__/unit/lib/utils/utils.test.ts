import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("Utils", () => {
  describe("cn (className merger)", () => {
    it("should merge class names", () => {
      const result = cn("px-2 py-1", "bg-red-500");
      expect(result).toBe("px-2 py-1 bg-red-500");
    });

    it("should handle conflicting classes (tailwind-merge)", () => {
      const result = cn("px-2", "px-4");
      expect(result).toBe("px-4");
    });

    it("should handle conditional classes", () => {
      const isActive = true;
      const result = cn("base-class", isActive && "active-class");
      expect(result).toBe("base-class active-class");
    });

    it("should filter out falsy values", () => {
      const result = cn("base", false, null, undefined, "end");
      expect(result).toBe("base end");
    });

    it("should handle objects (clsx style)", () => {
      const result = cn("base", {
        "active": true,
        "disabled": false,
      });
      expect(result).toBe("base active");
    });

    it("should handle arrays", () => {
      const result = cn(["class1", "class2"]);
      expect(result).toBe("class1 class2");
    });
  });
});
