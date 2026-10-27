import { describe, expect, it } from "vitest";

import { planWallpaperMigration, sameWallpaper } from "@/lib/wallpaper";

describe("shared wallpaper migration", () => {
  it("copies the opener's old choice when the pair has none, and clears the legacy field", () => {
    expect(planWallpaperMigration(undefined, { id: "dots" })).toEqual({ copyToPair: { id: "dots" }, clearMine: true });
    expect(planWallpaperMigration(undefined, null)).toEqual({ copyToPair: null, clearMine: true }); // "plain" counts as a choice
  });
  it("never overrides a wallpaper the pair already has (even plain), but still clears the legacy field", () => {
    expect(planWallpaperMigration({ id: "waves" }, { id: "dots" })).toEqual({ copyToPair: undefined, clearMine: true });
    expect(planWallpaperMigration(null, { id: "dots" })).toEqual({ copyToPair: undefined, clearMine: true });
  });
  it("does nothing once the legacy field is gone", () => {
    expect(planWallpaperMigration(undefined, undefined)).toEqual({ copyToPair: undefined, clearMine: false });
    expect(planWallpaperMigration({ id: "dots" }, undefined)).toEqual({ copyToPair: undefined, clearMine: false });
  });
  it("compares wallpapers by id and photo", () => {
    expect(sameWallpaper(null, undefined)).toBe(true);
    expect(sameWallpaper({ id: "dots" }, { id: "dots" })).toBe(true);
    expect(sameWallpaper({ id: "dots" }, { id: "waves" })).toBe(false);
    expect(sameWallpaper({ id: "photo", photoPublicId: "a" }, { id: "photo", photoPublicId: "b" })).toBe(false);
    expect(sameWallpaper({ id: "photo", photoPublicId: "a" }, { id: "photo", photoPublicId: "a" })).toBe(true);
  });
});
