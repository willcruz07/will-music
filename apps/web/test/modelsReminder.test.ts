import { beforeEach, describe, expect, it } from 'vitest';
import { SNOOZE_MS, neverRemind, reminderDue, reminderWait, snoozeReminder } from '../src/lib/modelsReminder.ts';

beforeEach(() => localStorage.clear());

describe('models reminder', () => {
  it('is due until the user hides it', () => {
    expect(reminderDue(1000)).toBe(true);
    expect(reminderWait(1000)).toBe(0);
  });

  it('"Me lembre mais tarde" hides it for a while, then it comes back', () => {
    snoozeReminder(1000);
    expect(reminderDue(1000 + SNOOZE_MS - 1)).toBe(false);
    expect(reminderWait(1000)).toBe(SNOOZE_MS);
    expect(reminderDue(1000 + SNOOZE_MS)).toBe(true);
  });

  it('"Não me exiba mais" hides it for good', () => {
    neverRemind();
    expect(reminderDue(Number.MAX_SAFE_INTEGER)).toBe(false);
    expect(reminderWait()).toBeNull();
  });
});
