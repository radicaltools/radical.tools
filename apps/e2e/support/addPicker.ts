import type { Locator, Page } from '@playwright/test'

/** Add or link (AddPicker), opened under `under` (null: at the top). */
export function addPicker(page: Page, under: string | null) {
  const dialog = page.getByRole('dialog', { name: under ? `Add under ${under}` : 'Add at the top' })
  return {
    dialog,
    /** The way whose sentence holds `text` ("a container", "uses…"). */
    async choose(text: string): Promise<void> {
      const select = dialog.getByRole('combobox', { name: 'What to add or link' })
      const value = await select.locator('option', { hasText: text }).first().getAttribute('value')
      await select.selectOption(value!)
    },
    option: (name: string | RegExp): Locator => dialog.getByRole('option', { name }),
    field: (): Locator => dialog.getByRole('textbox'),
  }
}
