import type { AppConfig } from '../../src/config';

/**
 * Requirement tags document which local services or fixtures a scenario needs.
 *
 * They are intentionally descriptive rather than executable. CI inclusion is
 * controlled by `ScenarioDefinition.ci`, while these tags help maintainers
 * understand why a scenario is skipped or excluded.
 */
export type ScenarioRequirement =
  | 'keria'
  | 'witnesses'
  | 'schema'
  | 'external-fixture';

export type ScenarioStatus = 'passed' | 'failed' | 'skipped';

export interface ScenarioStep {
  /** Short phase name shown in Vitest failure output and future reporters. */
  label: string;
  /** Optional prefix, operation name, OOBI URL, or other debugging detail. */
  detail?: string;
}

/**
 * Optional fixture configuration for scenarios that are not default CI-safe.
 *
 * Keep this separate from app config so production/runtime UI code does not
 * learn about schema-server or external-fixture testing knobs.
 */
export interface ScenarioFixtureConfig {
  /** Optional schema SAID for credential scenarios. */
  schemaSaid?: string;
  /** Optional schema OOBI URL for credential scenarios. */
  schemaOobiUrl?: string;
  /** Optional delegator prefix for the delegation fixture scenario. */
  delegatorPre?: string;
  /** Optional delegator OOBI for the delegation fixture scenario. */
  delegatorOobi?: string;
  /** Optional member OOBIs for the multisig fixture scenario. */
  multisigMemberOobis: string[];
}

export interface ScenarioRuntimeConfig extends AppConfig {
  scenarios: ScenarioFixtureConfig;
}

/**
 * Stable output contract for all scenario runners.
 */
export interface ScenarioResult {
  id: string;
  title: string;
  status: ScenarioStatus;
  summary: string;
  durationMs: number;
  steps: ScenarioStep[];
  details?: Record<string, string | number | boolean>;
  error?: string;
}

export interface ScenarioContext {
  /** Merged app defaults plus test-only fixture config. */
  config: ScenarioRuntimeConfig;
  /** Optional cancellation signal supplied by a runner or future CLI wrapper. */
  signal?: AbortSignal;
  /** Append a human-readable phase to the scenario result. */
  step(label: string, detail?: string): void;
}

/**
 * Scenario catalog entry consumed by Vitest and smoke tooling.
 */
export interface ScenarioDefinition {
  /** Stable machine id used in docs, logs, and future filtering. */
  id: string;
  /** Human-readable name shown by Vitest. */
  title: string;
  description: string;
  requirements: ScenarioRequirement[];
  /** True only when CI starts every service required by this scenario. */
  ci: boolean;
  run(context: ScenarioContext): Promise<ScenarioOutcome>;
}

export interface ScenarioOutcome {
  summary: string;
  details?: Record<string, string | number | boolean>;
}

export class ScenarioSkip extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScenarioSkip';
  }
}
