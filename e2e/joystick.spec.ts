import { expect, test, type Page } from "@playwright/test";

async function axes(page: Page) {
  return page.evaluate(async () => {
    const { pollInput } = await import("/src/input.ts");
    const { ax, ay } = pollInput();
    return [ax, ay];
  });
}

for (const interruption of ["lost capture", "window blur", "page hidden"] as const) {
  test(`joystick resets after ${interruption} and accepts the next touch`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Play Game" }).click();
    for (const pokemon of ["Pikachu", "Machamp", "Charizard"]) {
      await page.getByRole("button", { name: new RegExp("^" + pokemon + " ") }).click();
    }
    await page.getByRole("button", { name: "Start Game" }).click();
    await page.locator("#btn-got-it").click();

    const base = page.locator("#stick-base");
    const knob = page.locator("#stick-knob");
    const box = (await base.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const resting = await knob.boundingBox();
    const client = await page.context().newCDPSession(page);
    const sendTouch = (type: "touchStart" | "touchMove" | "touchEnd", touchX?: number) =>
      client.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: touchX === undefined ? [] : [{ x: touchX, y, id: 1 }],
      });

    if (interruption === "lost capture") {
      // Force the browser to deliver the release outside the captured element.
      await base.evaluate(el => el.addEventListener("gotpointercapture", e => {
        el.releasePointerCapture(e.pointerId);
      }, { once: true }));
    }
    await sendTouch("touchStart", x + box.width / 3);
    expect((await axes(page))[0]).toBeGreaterThan(0.5);
    if (interruption === "lost capture") {
      await sendTouch("touchMove", x + box.width);
      await sendTouch("touchEnd");
    } else if (interruption === "window blur") {
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    } else {
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
        Reflect.deleteProperty(document, "hidden");
      });
    }
    expect(await axes(page)).toEqual([0, 0]);
    expect(await knob.boundingBox()).toEqual(resting);

    if (interruption !== "lost capture") await sendTouch("touchEnd");
    await sendTouch("touchStart", x - box.width / 3);
    expect((await axes(page))[0]).toBeLessThan(-0.5);
    await sendTouch("touchEnd");
    expect(await axes(page)).toEqual([0, 0]);
    expect(await knob.boundingBox()).toEqual(resting);
  });
}
