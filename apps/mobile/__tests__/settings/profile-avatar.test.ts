import { describe, expect, it } from "vitest";
import { deriveProfileAvatar } from "@/features/settings/lib/profile-avatar";

describe("profile avatar", () => {
  it("uses provider image urls until image loading fails", () => {
    expect(
      deriveProfileAvatar({
        fullName: "Remote User",
        email: "remote@example.com",
        profileImageUrl: "https://accounts.google.com/avatar.png",
        didImageFail: false,
      })
    ).toEqual({ type: "image", uri: "https://accounts.google.com/avatar.png" });

    expect(
      deriveProfileAvatar({
        fullName: "Remote User",
        email: "remote@example.com",
        profileImageUrl: "https://accounts.google.com/avatar.png",
        didImageFail: true,
      })
    ).toEqual({ type: "initials", initials: "RU" });
  });

  it("falls back to initials when no provider image exists", () => {
    expect(
      deriveProfileAvatar({
        fullName: "",
        email: "remote@example.com",
        profileImageUrl: null,
        didImageFail: false,
      })
    ).toEqual({ type: "initials", initials: "R" });
  });
});
