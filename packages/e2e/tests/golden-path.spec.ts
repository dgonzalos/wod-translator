import { expect, test } from '@playwright/test';

// example → card → edit → simulated adaptation → save → reload → copy
// (spec §11's required E2E flow). Uses the built-in "thrustersTtbRun"
// example, which is zero-AI-call and has no pre-existing issues, so the
// review card is immediately in the "listo" state after loading it.
test('golden path: example, edit, adapt, save, reload, copy', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /AMRAP con thrusters, TTB y carrera/ }).click();
  await expect(page.getByText('Listo. La ficha está revisada.')).toBeVisible();

  // Edit a reviewed field before requesting adaptation (editing afterwards
  // would discard the proposals — spec §5 — so this must happen first).
  const quantityInput = page.getByLabel('Cantidad').first();
  await expect(quantityInput).toHaveValue('10');
  await quantityInput.fill('12');
  await expect(quantityInput).toHaveValue('12');

  await page.getByRole('checkbox', { name: 'Mancuernas' }).check();
  await page.getByRole('button', { name: 'Adaptar' }).click();

  const proposalItem = page.locator('li', { hasText: 'Sustituto simulado (E2E)' });
  await expect(proposalItem).toBeVisible();
  await proposalItem.getByRole('checkbox').check();

  await page.getByRole('button', { name: 'Guardar en este navegador' }).click();
  await expect(page.getByText('WOD guardado en este navegador.')).toBeVisible();

  await page.reload();
  await expect(page.getByText(/Se encontró un WOD guardado/)).toBeVisible();
  await page.getByRole('button', { name: 'Cargar' }).click();

  await expect(page.getByLabel('Cantidad').first()).toHaveValue('12');
  await expect(page.getByText('Sustituto simulado (E2E)')).toBeVisible();

  await page.getByRole('button', { name: 'Copiar' }).click();
  await expect(
    page.getByText('Copiado al portapapeles.').or(page.getByText(/No se pudo copiar automáticamente/)),
  ).toBeVisible();
});
