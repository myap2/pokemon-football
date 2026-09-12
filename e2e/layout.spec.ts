import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900, controls: "#game-bar" },
  { name: "portrait phone", width: 320, height: 568, controls: "#touch-pad" },
  { name: "landscape phone", width: 844, height: 390, controls: "#touch-pad" },
] as const;

async function startGame(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Play Game" }).click();
  await page.getByRole("button", { name: /^Pikachu / }).click();
  await page.getByRole("button", { name: /^Machamp / }).click();
  await page.getByRole("button", { name: /^Charizard / }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
}

for (const viewport of viewports) {
  test(`keeps the full game HUD inside the ${viewport.name} viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await startGame(page);

    for (const selector of ["#scoreboard", "#field", viewport.controls]) {
      const box = await page.locator(selector).boundingBox();
      expect(box, `${selector} should be visible`).not.toBeNull();
      expect(box!.x, `${selector} should not overflow left`).toBeGreaterThanOrEqual(0);
      expect(box!.y, `${selector} should not overflow above`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${selector} should not overflow right`).toBeLessThanOrEqual(
        viewport.width,
      );
      expect(box!.y + box!.height, `${selector} should not overflow below`).toBeLessThanOrEqual(
        viewport.height,
      );
    }
  });
}

test("allows browser zoom for accessibility", async ({ page }) => {
  await page.goto("/");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");

  expect(viewport).not.toContain("maximum-scale");
  expect(viewport).not.toContain("user-scalable=no");
});
