import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { PROBLEMS, PROBLEM_TYPE_BASE } from '../src/shared/problem.js';

type Json = Record<string, any>;

const spec = parse(
  readFileSync(fileURLToPath(new URL('../../openapi/openapi.yaml', import.meta.url)), 'utf8'),
) as Json;

function resolveRef(ref: string): unknown {
  return ref
    .replace('#/', '')
    .split('/')
    .reduce<any>((node, key) => node?.[key], spec);
}

function collectRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    node.forEach((item) => collectRefs(item, found));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') found.push(value);
      else collectRefs(value, found);
    }
  }
  return found;
}

describe('специфікація OpenAPI', () => {
  it('має версію 3.1', () => {
    expect(String(spec.openapi).startsWith('3.1')).toBe(true);
  });

  it('усі $ref вказують на існуючі елементи', () => {
    const broken = collectRefs(spec).filter((ref) => resolveRef(ref) === undefined);
    expect(broken).toEqual([]);
  });

  it('кожна операція має унікальний operationId і опис відповідей', () => {
    const ids: string[] = [];
    for (const item of Object.values<Json>(spec.paths)) {
      for (const [method, op] of Object.entries<Json>(item)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
        expect(op.operationId, `${method} без operationId`).toBeTruthy();
        expect(Object.keys(op.responses).length).toBeGreaterThan(0);
        ids.push(op.operationId);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('перелік Problem.type збігається з кодами помилок у коді', () => {
    const documented = [...spec.components.schemas.Problem.properties.type.enum].sort();
    const implemented = Object.keys(PROBLEMS)
      .map((code) => PROBLEM_TYPE_BASE + code)
      .sort();
    expect(documented).toEqual(implemented);
  });
});
