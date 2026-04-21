import { coreScenarios } from './coreScenarios';
import { optionalScenarios } from './optionalScenarios';
import type { ScenarioDefinition } from './types';

/**
 * Single scenario registry.
 *
 * This replaces the old `TestsComponent` import/render list with a test-owned
 * list that is still easy to scan. Add new scenarios here only by exporting
 * them from `coreScenarios` or `optionalScenarios`.
 */
export const scenarioCatalog: ScenarioDefinition[] = [
  ...coreScenarios,
  ...optionalScenarios,
];

/**
 * Default CI subset. Optional scenarios stay visible in `scenarioCatalog` but
 * are excluded until CI starts their schema or external fixture dependencies.
 */
export const ciScenarioCatalog: ScenarioDefinition[] = scenarioCatalog.filter(
  (scenario) => scenario.ci
);

export * from './helpers';
export * from './types';
