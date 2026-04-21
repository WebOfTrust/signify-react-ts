import {
  runClientBoundarySmoke,
  type ClientBoundarySmokeMode,
} from '../tests/scenarios/clientBoundarySmoke';

/**
 * Thin CLI wrapper for `runClientBoundarySmoke`.
 *
 * Keep parsing intentionally small. The scenario module owns KERIA behavior;
 * this file owns process arguments and JSON output.
 */
const valueFor = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const main = async () => {
  const mode = (valueFor('--mode') ?? 'witness') as ClientBoundarySmokeMode;

  if (mode !== 'connect' && mode !== 'witness') {
    throw new Error(`Unsupported smoke mode: ${mode}`);
  }

  const summary = await runClientBoundarySmoke({
    mode,
    passcode: valueFor('--passcode'),
    alias: valueFor('--alias'),
  });

  console.log(JSON.stringify(summary, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
