import { describe, expect, it } from "vitest";
import {
  buildCloneCompletedFields,
  buildCloneFailedFields,
  buildCloneStartedFields,
  buildVerifiedCloneFields,
} from "@/lib/contexts/repository/application/repository-service";

describe("buildVerifiedCloneFields", () => {
  it("builds clone verification fields with completed status", () => {
    const now = new Date("2026-02-06T10:00:00.000Z");

    const fields = buildVerifiedCloneFields("/tmp/repos/acme_api", now);

    expect(fields).toEqual({
      localPath: "/tmp/repos/acme_api",
      clonePath: "/tmp/repos/acme_api",
      isCloned: true,
      cloneStatus: "completed",
      clonedAt: now,
      cloneCompletedAt: now,
      indexingStatus: "pending",
      updatedAt: now,
    });
  });
});

describe("clone status update builders", () => {
  it("builds clone started fields", () => {
    const now = new Date("2026-02-06T10:10:00.000Z");
    expect(buildCloneStartedFields(now)).toEqual({
      cloneStatus: "cloning",
      cloneStartedAt: now,
      updatedAt: now,
    });
  });

  it("builds clone completed fields", () => {
    const now = new Date("2026-02-06T10:20:00.000Z");
    expect(buildCloneCompletedFields("/tmp/repos/acme_api", now)).toEqual({
      localPath: "/tmp/repos/acme_api",
      isCloned: true,
      clonedAt: now,
      cloneStatus: "completed",
      clonePath: "/tmp/repos/acme_api",
      cloneCompletedAt: now,
      indexingStatus: "pending",
      updatedAt: now,
    });
  });

  it("builds clone failed fields", () => {
    const now = new Date("2026-02-06T10:30:00.000Z");
    expect(buildCloneFailedFields(now)).toEqual({
      cloneStatus: "failed",
      updatedAt: now,
    });
  });
});
