import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveAnalysisExecution, saveExecutionPreference, isResourceFailure, isWordTimestampFailure } from '../src/lib/analysisExecution.ts';

beforeEach(() => { localStorage.clear(); saveExecutionPreference('auto'); });
afterEach(() => vi.unstubAllGlobals());
describe('analysis execution policy', () => {
  it('keeps iPhone sequential in auto but permits an explicit parallel experiment', async () => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone', hardwareConcurrency: 8, gpu: { requestAdapter: async () => ({}) } });
    expect(await resolveAnalysisExecution()).toBe('sequential');
    expect(await resolveAnalysisExecution('parallel')).toBe('parallel');
  });
  it('uses desktop overlap only with enough cores and an available GPU adapter', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Chrome desktop', hardwareConcurrency: 8, gpu: { requestAdapter: async () => ({}) } });
    expect(await resolveAnalysisExecution()).toBe('parallel');
    vi.stubGlobal('navigator', { userAgent: 'Chrome desktop', hardwareConcurrency: 8, gpu: { requestAdapter: async () => null } });
    expect(await resolveAnalysisExecution()).toBe('sequential');
    vi.stubGlobal('navigator', { userAgent: 'Chrome desktop', hardwareConcurrency: 2, gpu: { requestAdapter: async () => ({}) } });
    expect(await resolveAnalysisExecution()).toBe('sequential');
  });
  it('honors a saved sequential preference', async () => {
    saveExecutionPreference('sequential');
    expect(await resolveAnalysisExecution()).toBe('sequential');
  });
  it('separates alignment incompatibility from resource errors and unintelligible singing', () => {
    expect(isWordTimestampFailure(new Error('Missing cross-attention outputs'))).toBe(true);
    expect(isWordTimestampFailure(new Error('GPU out of memory'))).toBe(false);
    expect(isResourceFailure(new Error('GPU out of memory'))).toBe(true);
    expect(isResourceFailure(new Error('Não deu para entender a letra'))).toBe(false);
  });
});
