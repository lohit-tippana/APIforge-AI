import { expect, test } from "@playwright/test";

// E2E smoke: sign up → workspace → project → collection → request → send → response.
// Requires seeded dev DB (demo@apiforge.dev / demo1234) and network access to dummyjson.com.

test("marketing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /build, test/i })).toBeVisible();
});

test("login → workspace → collections → send request", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@company.com").fill("demo@apiforge.dev");
  await page.getByPlaceholder("••••••••").fill("demo1234");
  await page.getByRole("button", { name: "Sign in" }).click();

  await page.waitForURL(/\/w\//);
  // Enter the seeded project
  await page.getByText("E-Commerce API").first().click();
  await page.waitForURL(/collections/);

  // Open a request from the tree
  await page.getByText("List products").first().click();
  await expect(page.getByPlaceholder(/https:\/\/api\.example\.com|BASE_URL/)).toHaveValue(/products/);

  // Send — real HTTP via the API executor to dummyjson
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/200 OK/)).toBeVisible({ timeout: 30_000 });
});
