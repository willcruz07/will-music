import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const instances: { options: Record<string, unknown>; render: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn>; resolve: () => void }[] = [];
vi.mock('opensheetmusicdisplay', () => ({
  OpenSheetMusicDisplay: class {
    options: Record<string, unknown>;
    render = vi.fn();
    clear = vi.fn();
    resolve: () => void = () => {};
    constructor(_host: unknown, options: Record<string, unknown>) {
      this.options = options;
      instances.push(this);
    }
    load() {
      return new Promise<void>((r) => (this.resolve = r));
    }
  },
}));
const { ScoreView } = await import('../src/components/ScoreView.tsx');

describe('ScoreView', () => {
  it('leaves no live sheet behind when the score changes mid-load', async () => {
    const { rerender } = render(<ScoreView xml="<a/>" />);
    await waitFor(() => expect(instances).toHaveLength(1));
    rerender(<ScoreView xml="<b/>" />);
    await waitFor(() => expect(instances).toHaveLength(2));
    instances[0]!.resolve();
    instances[1]!.resolve();
    await waitFor(() => expect(instances[1]!.render).toHaveBeenCalled());
    expect(instances[0]!.render).not.toHaveBeenCalled();
    expect(instances[0]!.clear).toHaveBeenCalled();
    // Resizing is ours (a ResizeObserver), so a dropped sheet can never redraw itself.
    expect(instances.every((i) => i.options.autoResize === false)).toBe(true);
  });
});
