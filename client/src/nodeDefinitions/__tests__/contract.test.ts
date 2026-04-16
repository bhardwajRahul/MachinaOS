/**
 * Single sweep test - validates every entry in `nodeDefinitions` against the
 * INodeTypeDescription contract. One assertion per node guarantees a refactor
 * that breaks any definition's shape will fail loudly here.
 */

import { describe, expect, it } from 'vitest';
import { nodeDefinitions } from '../../nodeDefinitions';
import {
  formatIssues,
  validateNodeDefinition,
  validateRegistry,
} from '../../test/nodeDefinitionContract';

describe('nodeDefinitions registry', () => {
  it('exports at least one node', () => {
    expect(Object.keys(nodeDefinitions).length).toBeGreaterThan(0);
  });

  it('every registry entry passes the INodeTypeDescription contract', () => {
    const issues = validateRegistry(nodeDefinitions);
    if (issues.length > 0) {
      throw new Error(`Contract violations:\n${formatIssues(issues)}`);
    }
  });

  describe.each(Object.entries(nodeDefinitions))('%s', (key, def) => {
    it('matches its registry key', () => {
      expect(def.name).toBe(key);
    });

    it('has a valid INodeTypeDescription shape', () => {
      const issues = validateNodeDefinition(key, def);
      if (issues.length > 0) {
        throw new Error(formatIssues(issues));
      }
    });
  });
});
