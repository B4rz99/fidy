import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type CliOptions = {
  readonly entity: string;
  readonly feature: string;
  readonly output: string | null;
  readonly root: string;
  readonly table: string;
  readonly write: boolean;
};

const DEFAULT_ROOT = process.cwd();
const withOptions = (options: CliOptions, patch: Partial<CliOptions>): CliOptions =>
  Object.assign({}, options, patch);

const parseArgs = (argv: readonly string[]): CliOptions =>
  argv.reduce<CliOptions>(
    (options, arg, index, allArgs) => {
      if (arg === "--feature") {
        const feature = allArgs[index + 1];
        return feature ? withOptions(options, { feature }) : options;
      }

      if (arg === "--table") {
        const table = allArgs[index + 1];
        return table ? withOptions(options, { table }) : options;
      }

      if (arg === "--entity") {
        const entity = allArgs[index + 1];
        return entity ? withOptions(options, { entity }) : options;
      }

      if (arg === "--root") {
        const root = allArgs[index + 1];
        return root ? withOptions(options, { root }) : options;
      }

      if (arg === "--output") {
        const output = allArgs[index + 1];
        return output ? withOptions(options, { output }) : options;
      }

      if (arg === "--write") {
        return withOptions(options, { write: true });
      }

      return options;
    },
    {
      entity: "",
      feature: "",
      output: null,
      root: DEFAULT_ROOT,
      table: "",
      write: false,
    }
  );

const requireOption = (value: string, label: string): string => {
  if (value.length === 0) {
    throw new Error(`Missing required option: ${label}`);
  }

  return value;
};

const getDefaultOutputPath = (root: string, feature: string): string =>
  join(root, ".context", "scaffolds", `${feature}-syncable-feature.md`);

export const buildSyncableFeatureChecklist = (input: {
  readonly entity: string;
  readonly feature: string;
  readonly table: string;
}): string => `# Syncable Feature Checklist: ${input.feature}

## Public Surface

- Add or update \`apps/mobile/features/${input.feature}/public.ts\`.
- Add or update \`apps/mobile/features/${input.feature}/bootstrap.ts\` for root startup integration.
- Keep cross-feature imports on explicit \`*.public.ts\` surfaces only.

## Persistence

- Add the entity schema in \`apps/mobile/features/${input.feature}/schema.ts\`.
- Add the table definition in \`apps/mobile/shared/db/schema.ts\` for \`${input.table}\`.
- Generate the SQL migration and then register it in \`apps/mobile/drizzle/migrations.js\`.
- Add branded ID support and trusted constructors for \`${input.entity}\` if they do not exist yet.

## Mutations And Sync

- Add mutation handlers in \`apps/mobile/mutation-runtime/${input.feature}-handlers.ts\`.
- Register handlers in \`apps/mobile/mutations/index.ts\`.
- Ensure every write enqueues sync with \`enqueueSync(db, "${input.table}", rowId, operation)\`.
- Add pull/push mapping if the entity participates in local-first sync.

## Runtime Integration

- Wire feature bootstrap/load behavior into the authenticated shell registry.
- Keep pure derivations in \`lib/\` and side effects in stores/hooks/services.
- Expose only the smallest public API needed by other features.

## Tests

- Add direct unit tests for pure derivations.
- Add repository/store tests for the persistence boundary.
- Add a write-through or sync boundary test proving transaction semantics for \`${input.entity}\`.
- Add navigation or bootstrap tests only if user-visible orchestration changes.
`;

const main = (argv: readonly string[]): number => {
  try {
    const options = parseArgs(argv);
    const feature = requireOption(options.feature, "--feature");
    const table = requireOption(options.table, "--table");
    const entity = requireOption(options.entity, "--entity");
    const checklist = buildSyncableFeatureChecklist({ entity, feature, table });

    if (!options.write) {
      console.log(checklist);
      return 0;
    }

    const outputPath = options.output ?? getDefaultOutputPath(options.root, feature);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, checklist);
    console.log(`Wrote syncable feature checklist to ${outputPath}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    return 1;
  }
};

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
