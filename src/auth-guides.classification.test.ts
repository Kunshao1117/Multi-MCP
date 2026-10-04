import { describe, expect, it } from 'vitest';
import { checkEnvVarsConfigured, classifyAuthError, isAuthError } from './auth-guides.js';
describe('conservative authentication classification', () => {
  it.each(['Unexpected token in JSON', 'token limit exceeded', 'Authentication appears in user data', 'resource 40123', 'permission denied opening file'])('does not classify incidental text: %s', (message) => {
    expect(isAuthError(new Error(message))).toBe(false);
  });
  it.each([new Error('401 Unauthorized'), { status: 401 }, { data: { statusCode: 401 } }])('classifies explicit unauthorized response', (error) => {
    expect(classifyAuthError(error)).toBe('expired');
  });
  it.each([new Error('403 Forbidden'), { statusCode: 403 }])('distinguishes denied scopes from expired credentials', (error) => {
    expect(classifyAuthError(error)).toBe('forbidden');
  });
  it('recognizes final explicit server env and unresolved placeholders', () => {
    expect(checkEnvVarsConfigured('github', { GITHUB_PERSONAL_ACCESS_TOKEN: 'fixture' }, {})).toEqual({ configured: true, missing: [] });
    expect(checkEnvVarsConfigured('github', { GITHUB_PERSONAL_ACCESS_TOKEN: '${MISSING}' }, {})).toEqual({ configured: false, missing: ['GITHUB_PERSONAL_ACCESS_TOKEN'] });
  });
});
