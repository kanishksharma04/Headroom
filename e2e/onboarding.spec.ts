import { expect, test } from "@playwright/test";

/**
 * The one end-to-end path that must never break: a brand-new user signs up,
 * completes the minimal onboarding, and sees a real Headroom Number. Every
 * other screen is covered by unit/integration tests against the engines
 * directly — this test exists to catch wiring mistakes those can't see
 * (routing, form-to-server-action plumbing, session handling).
 */
test("sign-up through onboarding renders a real Headroom Number", async ({ page }) => {
  const email = `e2e-smoke-${Date.now()}@example.com`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Smoke Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery-1");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("/onboarding");

  // Step 1: salary.
  await page.locator("#salaryAmount").fill("85000");
  await page.locator("#salaryDayOfMonth").fill("1");
  await page.getByRole("button", { name: "Next" }).click();

  // Step 2: where the money sits.
  await page.locator("#accountName").fill("HDFC Savings");
  await page.locator("#accountBalance").fill("120000");
  await page.getByRole("button", { name: "Next" }).click();

  // Step 3: loans — skip, none to add.
  await page.getByRole("button", { name: "Next" }).click();

  // Step 4: everyday spending, then submit.
  await page.locator("#variableSpendAmount").fill("25000");
  await page.getByRole("button", { name: "See my headroom" }).click();

  await page.waitForURL("/today");

  await expect(page.getByText("Yours to spend before")).toBeVisible();
  const headroomAmount = page.locator(".text-hero");
  await expect(headroomAmount).toBeVisible();
  await expect(headroomAmount).toContainText("₹");
});
