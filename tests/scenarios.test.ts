import { describe, expect, it } from 'vitest';
import {
  ciScenarioCatalog,
  executeScenario,
  scenarioCatalog,
} from './scenarios/catalog';

const includeOptional = process.env.SCENARIO_INCLUDE_OPTIONAL === 'true';
const scenarios = includeOptional ? scenarioCatalog : ciScenarioCatalog;

/*
 * Execute scenarios one at a time. KERIA integration flows mutate local agent
 * state and share fixed service ports, so parallel execution would make failure
 * output harder to trust.
 */
describe.sequential('scenario runners', () => {
  for (const scenario of scenarios) {
    it(
      scenario.title,
      async () => {
        const result = await executeScenario(scenario);

        if (result.status === 'skipped') {
          expect(scenario.ci).toBe(false);
          return;
        }

        expect(result.status, result.error).toBe('passed');
        expect(result.steps.length).toBeGreaterThan(0);
      },
      180_000
    );
  }
});
