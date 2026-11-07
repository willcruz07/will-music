import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/** Picks an option of a SheetSelect: opens the sheet from the field and taps the row. */
export const choose = async (field: HTMLElement | string, option: string | RegExp) => {
  await userEvent.click(typeof field === 'string' ? screen.getByLabelText(field) : field);
  await userEvent.click(screen.getByRole('option', { name: option }));
};
