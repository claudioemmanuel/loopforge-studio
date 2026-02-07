import { beforeEach, describe, expect, it } from "vitest";
import { readSourceFile } from "../../helpers/source-file";

describe("Worker health pulse alignment", () => {
  let workerStatusCard: string;
  let redisStatusCard: string;

  beforeEach(() => {
    workerStatusCard = readSourceFile(
      __dirname,
      "components/workers/worker-status-card.tsx",
    );
    redisStatusCard = readSourceFile(
      __dirname,
      "components/workers/redis-status-card.tsx",
    );
  });

  it("anchors pulse ring to worker icon container without offset hacks", () => {
    expect(workerStatusCard).toContain("relative");
    expect(workerStatusCard).toContain("absolute inset-0");
    expect(workerStatusCard).not.toContain("ml-[-1.25rem]");
    expect(workerStatusCard).not.toContain("mt-[-1.25rem]");
  });

  it("anchors pulse ring to redis icon container without offset hacks", () => {
    expect(redisStatusCard).toContain("relative");
    expect(redisStatusCard).toContain("absolute inset-0");
    expect(redisStatusCard).not.toContain("ml-[-1.25rem]");
    expect(redisStatusCard).not.toContain("mt-[-1.25rem]");
  });
});
