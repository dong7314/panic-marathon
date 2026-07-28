import { expect, test, type Browser, type Page } from "@playwright/test";

async function createRoom(page: Page, code: string, name: string) {
  await page.goto("/");
  await page.locator("#open-create").click();
  await page.locator("#title-runner-name").fill(name);
  await page.locator("#title-invite-code").fill(code);
  await page.locator("#title-lap-count").fill("1");
  await page.locator("#title-player-count").fill("2");
  await page.locator("#title-confirm-room").click();
  await expect(page.locator("#title-waiting-summary")).toBeVisible();
  await expect(page.locator("#title-room-share-code")).toHaveText(code);
}

async function joinRoom(page: Page, code: string, name: string) {
  await page.goto("/");
  await page.locator("#open-join").click();
  await page.locator("#title-runner-name").fill(name);
  await page.locator("#title-room-code").fill(code);
  await page.locator("#title-confirm-room").click();
  await expect(page.locator("#title-waiting-summary")).toBeVisible();
}

async function twoPlayerRoom(browser: Browser, code: string) {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await createRoom(host, code, "Host");
  await joinRoom(guest, code, "Guest");
  await expect(host.locator(".title-waiting-player")).toHaveCount(2);
  await expect(guest.locator(".title-waiting-player")).toHaveCount(2);
  return { hostContext, guestContext, host, guest };
}

test("two browsers move from room waiting UI through countdown into the race HUD", async ({ browser }) => {
  const room = await twoPlayerRoom(browser, "PM-E2E-A");
  try {
    await expect(room.host.locator("#title-confirm-room")).toBeEnabled();
    await expect(room.guest.locator("#title-room-share")).toBeHidden();
    await room.host.locator("#title-confirm-room").click();
    await expect(room.host.locator("#match-countdown")).toBeVisible();
    await expect(room.host.locator("#game-screen")).toBeVisible();
    await expect(room.guest.locator("#game-screen")).toBeVisible();
    await expect(room.host.locator("#race-board .race-row")).toHaveCount(2);

    await expect(room.host.locator("#game-chat")).toBeVisible();
    await expect(room.host.locator("#game-chat-messages")).toBeVisible();
    await expect(room.host.locator("#game-chat-form")).toBeVisible();
    await expect(room.host.locator("#game-chat-input")).toHaveAttribute("readonly", "");
    await room.host.keyboard.press("Enter");
    await expect(room.host.locator("#game-chat")).toHaveClass(/is-open/);
    await expect(room.host.locator("#game-chat-input")).toBeFocused();
    await expect(room.host.locator("#game-chat-input")).not.toHaveAttribute("readonly", "");
    await room.host.locator("#game-chat-input").fill("취소할 메시지");
    await room.host.locator("#game-chat-input").press("Escape");
    await expect(room.host.locator("#game-chat")).not.toHaveClass(/is-open/);
    await expect(room.host.locator("#game-chat-input")).toHaveAttribute("readonly", "");
    await expect(room.host.locator("#game-chat-form")).toBeVisible();

    await room.host.keyboard.press("Enter");
    await room.host.locator("#game-chat-input").fill("같이 선두를 잡자!");
    await room.host.locator("#game-chat-input").press("Enter");
    await expect(room.host.locator("#game-chat")).not.toHaveClass(/is-open/);
    await expect(room.host.locator("#game-chat-input")).toHaveAttribute("readonly", "");
    await expect(room.host.locator("#game-chat-form")).toBeVisible();
    await expect(room.guest.locator(".game-chat-message")).toContainText("Host");
    await expect(room.guest.locator(".game-chat-message")).toContainText("같이 선두를 잡자!");

    const canvasHasRenderedPixels = await room.host.locator("#game-canvas").evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext("2d");
      if (!context) return false;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors = new Set<string>();
      for (let index = 0; index < pixels.length; index += 64) {
        colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}:${pixels[index + 3]}`);
        if (colors.size > 12) return true;
      }
      return false;
    });
    expect(canvasHasRenderedPixels).toBe(true);

    const contextMenuPrevented = await room.host.locator("#game-canvas").evaluate((canvas) => {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(contextMenuPrevented).toBe(true);

    const raceBoard = await room.host.locator("#race-board").boundingBox();
    const frameActions = await room.host.locator(".frame-actions").boundingBox();
    expect(raceBoard).not.toBeNull();
    expect(frameActions).not.toBeNull();
    if (raceBoard && frameActions) {
      const overlaps = raceBoard.x < frameActions.x + frameActions.width
        && raceBoard.x + raceBoard.width > frameActions.x
        && raceBoard.y < frameActions.y + frameActions.height
        && raceBoard.y + raceBoard.height > frameActions.y;
      expect(overlaps).toBe(false);
    }
  } finally {
    await room.hostContext.close();
    await room.guestContext.close();
  }
});

test("create room panel shares the join layout and aligns custom map and skill popovers", async ({ page }) => {
  await page.setViewportSize({ width: 544, height: 906 });
  await page.goto("/");

  await page.locator("#open-join").click();
  const joinLogoBox = await page.locator(".title-logo").boundingBox();
  const joinPanelBox = await page.locator("#title-room-panel").boundingBox();
  await page.locator("#title-panel-back").click();
  await page.locator("#open-create").click();

  const logo = page.locator(".title-logo");
  const panel = page.locator("#title-room-panel");
  await expect(logo).toBeVisible();
  await expect(panel).toBeVisible();

  const logoBox = await logo.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(logoBox).not.toBeNull();
  expect(panelBox).not.toBeNull();
  expect(joinLogoBox).not.toBeNull();
  expect(joinPanelBox).not.toBeNull();
  if (logoBox && panelBox && joinLogoBox && joinPanelBox) {
    expect(Math.abs(logoBox.x - joinLogoBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(logoBox.y - joinLogoBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(logoBox.width - joinLogoBox.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(panelBox.x - joinPanelBox.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(panelBox.y + panelBox.height - (joinPanelBox.y + joinPanelBox.height))).toBeLessThanOrEqual(1);
    expect(logoBox.y + logoBox.height).toBeLessThanOrEqual(panelBox.y);
    expect(panelBox.width).toBeLessThanOrEqual(440);
  }

  const runnerInputBox = await page.locator("#title-runner-name").boundingBox();
  const lapLabelBox = await page.locator('label[for="title-lap-count"]').boundingBox();
  expect(runnerInputBox).not.toBeNull();
  expect(lapLabelBox).not.toBeNull();
  if (runnerInputBox && lapLabelBox) {
    expect(lapLabelBox.y - (runnerInputBox.y + runnerInputBox.height)).toBeGreaterThanOrEqual(8);
  }

  const mapSelect = page.locator("#title-map-select");
  const mapSummary = page.locator("#title-map-select > summary");
  const skillSelect = page.locator("#title-skill-select");
  const skillSummary = page.locator("#title-skill-select > summary");
  await expect(mapSummary).toBeVisible();
  await expect(skillSummary).toBeVisible();
  await expect(mapSummary).toContainText("말썽 운동장 · 안전 난간");
  await expect(skillSummary).toContainText("전체 스킬 · 10개");
  await expect(page.locator("#title-map-options")).toBeHidden();
  await expect(page.locator("#title-skill-pool")).toBeHidden();

  const mapLabelBox = await page.locator(".title-map-label").boundingBox();
  const skillLabelBox = await page.locator(".title-skill-label").boundingBox();
  const mapSummaryBox = await mapSummary.boundingBox();
  const skillSummaryBox = await skillSummary.boundingBox();
  expect(mapLabelBox).not.toBeNull();
  expect(skillLabelBox).not.toBeNull();
  expect(mapSummaryBox).not.toBeNull();
  expect(skillSummaryBox).not.toBeNull();
  if (mapLabelBox && skillLabelBox && mapSummaryBox && skillSummaryBox) {
    expect(Math.abs(mapLabelBox.y - skillLabelBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(mapLabelBox.height - skillLabelBox.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(mapSummaryBox.y - skillSummaryBox.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(mapSummaryBox.height - skillSummaryBox.height)).toBeLessThanOrEqual(1);
  }

  await mapSummary.click();
  await expect(mapSelect).toHaveAttribute("open", "");
  await expect(page.locator("#title-map-options")).toBeVisible();
  const mapPopoverBox = await page.locator("#title-map-options").boundingBox();
  const panelWithMapOpenBox = await panel.boundingBox();
  expect(mapPopoverBox).not.toBeNull();
  expect(panelWithMapOpenBox).not.toBeNull();
  if (panelBox && mapSummaryBox && mapPopoverBox && panelWithMapOpenBox) {
    expect(Math.abs(panelWithMapOpenBox.height - panelBox.height)).toBeLessThanOrEqual(1);
    expect(mapPopoverBox.y + mapPopoverBox.height).toBeLessThanOrEqual(mapSummaryBox.y);
  }
  await page.getByRole("radio", { name: "우주 정거장 · 트랙 이탈 시 추락" }).check();
  await expect(page.locator("#title-map-id")).toHaveValue("space-station");
  await expect(mapSummary).toContainText("우주 정거장 · 트랙 이탈 시 추락");
  await expect(page.locator("#title-map-options")).toBeHidden();

  await skillSummary.click();
  await expect(skillSelect).toHaveAttribute("open", "");
  await expect(page.locator("#title-skill-pool")).toBeVisible();

  const openPanelBox = await panel.boundingBox();
  const openSummaryBox = await skillSummary.boundingBox();
  const skillPopoverBox = await page.locator("#title-skill-pool").boundingBox();
  expect(openPanelBox).not.toBeNull();
  expect(openSummaryBox).not.toBeNull();
  expect(skillPopoverBox).not.toBeNull();
  if (panelBox && openPanelBox && openSummaryBox && skillPopoverBox) {
    expect(Math.abs(openPanelBox.height - panelBox.height)).toBeLessThanOrEqual(1);
    expect(skillPopoverBox.y + skillPopoverBox.height).toBeLessThanOrEqual(openSummaryBox.y);
  }

  const checkboxBox = await page.locator('.title-skill-options input[value="push"]').boundingBox();
  expect(checkboxBox).not.toBeNull();
  if (checkboxBox) {
    expect(checkboxBox.width).toBeLessThanOrEqual(16);
    expect(checkboxBox.height).toBeLessThanOrEqual(16);
  }
  await logo.click();
  await expect(page.locator("#title-skill-pool")).toBeHidden();

  const taglineFontSize = await page.locator(".title-logo > b").evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).fontSize)
  ));
  expect(taglineFontSize).toBeGreaterThanOrEqual(12);
  await expect(page.locator("#title-confirm-room")).toBeVisible();
});

test("jump pads rotate their body and arrow into the launch direction", async ({ page }) => {
  await page.goto("/");
  const layouts = await page.evaluate(async (moduleUrl) => {
    const { getJumpPadLayout } = await import(moduleUrl);
    return {
      left: getJumpPadLayout({ x: 0, y: 0, width: 40, height: 30, pushX: -320, pushY: 0 }),
      up: getJumpPadLayout({ x: 0, y: 0, width: 30, height: 40, pushX: 0, pushY: -320 }),
      down: getJumpPadLayout({ x: 0, y: 0, width: 30, height: 40, pushX: 0, pushY: 320 }),
    };
  }, "/src/game/hazard-renderer.ts");

  expect(layouts.left.length).toBe(40);
  expect(layouts.left.breadth).toBe(30);
  expect(layouts.left.angle).toBeCloseTo(Math.PI);
  expect(layouts.up.angle).toBeCloseTo(-Math.PI / 2);
  expect(layouts.down.angle).toBeCloseTo(Math.PI / 2);
});

test("room configuration feedback and disconnected runner labels stay clean", async ({ browser }) => {
  const validationContext = await browser.newContext();
  const validationPage = await validationContext.newPage();
  await validationPage.goto("/");
  const inputResult = await validationPage.evaluate(async (moduleUrl) => {
    const { installInputController } = await import(moduleUrl);
    const canvas = document.createElement("canvas");
    document.body.append(canvas);
    const calls = { aim: 0, primary: 0, secondary: 0, escape: 0, interaction: 0 };
    let blocked = false;
    const pressed = installInputController({
      canvas,
      isGameActive: () => true,
      isInputBlocked: () => blocked,
      isMatchFinished: () => false,
      onAim: () => { calls.aim += 1; },
      onPrimaryAction: () => { calls.primary += 1; },
      onSecondaryAction: () => { calls.secondary += 1; },
      onEscape: () => { calls.escape += 1; },
      onInteraction: () => { calls.interaction += 1; },
    });
    canvas.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, cancelable: true }));
    canvas.dispatchEvent(new PointerEvent("pointerdown", { button: 2, bubbles: true, cancelable: true }));
    const menu = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    canvas.dispatchEvent(menu);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w", bubbles: true, cancelable: true }));
    const movementRegistered = pressed.has("w");
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW", key: "w", bubbles: true }));
    blocked = true;
    canvas.dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW", key: "w", bubbles: true, cancelable: true }));
    const blockedInputIgnored = !pressed.has("w") && calls.primary === 1;
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape", bubbles: true }));
    canvas.remove();
    return { calls, movementRegistered, movementCleared: !pressed.has("w"), blockedInputIgnored, contextMenuPrevented: menu.defaultPrevented };
  }, "/src/game/input-controller.ts");
  expect(inputResult).toEqual({
    calls: { aim: 2, primary: 1, secondary: 1, escape: 0, interaction: 3 },
    movementRegistered: true,
    movementCleared: true,
    blockedInputIgnored: true,
    contextMenuPrevented: true,
  });

  await validationPage.locator("#open-create").click();
  await expect(validationPage.locator("#title-skill-pool")).toBeHidden();
  await validationPage.locator("#title-skill-select > summary").click();
  await expect(validationPage.locator("#title-skill-pool")).toBeVisible();
  const skillCardMetrics = await validationPage.locator("#title-skill-pool").evaluate((pool) => {
    const cards = [...pool.querySelectorAll("label")].map((label) => label.getBoundingClientRect());
    const checkbox = pool.querySelector<HTMLInputElement>('input[type="checkbox"]')?.getBoundingClientRect();
    return {
      widths: [...new Set(cards.map((card) => Math.round(card.width)))],
      checkboxWidth: checkbox?.width,
      checkboxHeight: checkbox?.height,
    };
  });
  expect(skillCardMetrics.widths).toHaveLength(1);
  expect(skillCardMetrics.checkboxWidth).toBe(16);
  expect(skillCardMetrics.checkboxHeight).toBe(16);
  const skills = validationPage.locator('#title-skill-pool input[type="checkbox"]');
  for (let index = 2; index < await skills.count(); index += 1) {
    await skills.nth(index).uncheck();
  }
  await expect(validationPage.locator("#title-skill-count")).toContainText("2개 · 최소 3개");
  await expect(validationPage.locator("#title-skill-count")).toHaveClass(/invalid/);
  await expect(validationPage.locator("#title-skill-select")).toHaveClass(/invalid/);
  await expect(validationPage.locator("#title-skill-summary")).toContainText("밀치기 · 돌진");
  await validationPage.locator("#title-confirm-room").click();
  await expect(validationPage.locator("#toast")).toHaveClass(/visible/);
  await expect(validationPage.locator("#title-waiting-summary")).toBeHidden();
  await validationContext.close();

  const room = await twoPlayerRoom(browser, "PM-E2E-B");
  try {
    await room.host.locator("#title-confirm-room").click();
    await expect(room.host.locator("#game-screen")).toBeVisible();
    await room.guestContext.close();
    await expect(room.host.locator(".world-label-stack")).toHaveCount(0);
    await expect(room.host.locator("#race-board")).toContainText("REJOIN");
  } finally {
    await room.hostContext.close();
  }
});
