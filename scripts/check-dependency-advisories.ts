/**
 * Fails when the locked pnpm tree carries a security advisory that is not
 * already recorded in scripts/dependency-advisories-baseline.json, or when a
 * recorded advisory no longer applies.
 *
 * Dependabot cannot lift a transitive dependency the lockfile pins, so an
 * advisory on one sits open with no pull request and no failing build until
 * Dependabot's own job errors (`security_update_not_possible`, MIS-186 and
 * MIS-191). This turns that silence into a red build with the fix path named.
 *
 * The baseline is a ratchet, not a waiver list: it can only shrink. A new
 * advisory fails the build; a baselined advisory that has been fixed also fails
 * it until the entry is deleted.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const BASELINE_PATH = "scripts/dependency-advisories-baseline.json";

const REMEDIATION = [
  "Fix path (Dependabot cannot bump a locked transitive dependency):",
  '  1. Add a floor to "pnpm.overrides" in package.json, for example',
  '     "<package>": "^<patched version>", or upgrade the parent dependency.',
  "  2. Run `pnpm install --lockfile-only`, then `pnpm audit`.",
  "  3. Verify Dependabot can still resolve the lockfile: run",
  "     `pnpm update <package> --lockfile-only --no-save -r` on a copy.",
].join("\n");

export interface AdvisoryFinding {
  /** Baseline key: `<GHSA id> <package>`. */
  key: string;
  line: string;
}

export interface AdvisoryDiff {
  /** In the tree, absent from the baseline. */
  fresh: AdvisoryFinding[];
  /** In the baseline, no longer in the tree. */
  stale: string[];
}

interface AuditAdvisory {
  id: number;
  github_advisory_id?: string;
  module_name: string;
  severity: string;
  vulnerable_versions: string;
  patched_versions: string;
  title: string;
}

interface AuditReport {
  advisories: Record<string, AuditAdvisory>;
  actions?: {
    resolves?: { id: number; path: string }[];
  }[];
}

function parseReport(report: unknown): AuditReport {
  if (
    !report ||
    typeof report !== "object" ||
    !("advisories" in report) ||
    !report.advisories ||
    typeof report.advisories !== "object"
  ) {
    throw new Error("audit report has no advisories object");
  }
  // Boundary: only the fields read in diffAdvisories are used.
  return report as AuditReport;
}

/**
 * @param report parsed `pnpm audit --json` output
 * @param baseline advisory keys accepted as existing debt
 */
export function diffAdvisories(
  report: unknown,
  baseline: readonly string[],
): AdvisoryDiff {
  const parsed = parseReport(report);

  const pathsById = new Map<number, Set<string>>();
  for (const action of parsed.actions ?? []) {
    for (const resolve of action.resolves ?? []) {
      const paths = pathsById.get(resolve.id) ?? new Set<string>();
      paths.add(resolve.path);
      pathsById.set(resolve.id, paths);
    }
  }

  const known = new Set(baseline);
  const present = new Set<string>();
  const fresh = new Map<string, AdvisoryFinding>();

  for (const advisory of Object.values(parsed.advisories)) {
    const key = `${advisory.github_advisory_id ?? advisory.id} ${advisory.module_name}`;
    present.add(key);
    if (known.has(key) || fresh.has(key)) continue;

    const paths = [...(pathsById.get(advisory.id) ?? [])].join(", ");
    fresh.set(key, {
      key,
      line:
        `${advisory.severity} ${key} ${advisory.vulnerable_versions}` +
        ` (patched: ${advisory.patched_versions})` +
        `${paths ? ` via ${paths}` : ""}: ${advisory.title}`,
    });
  }

  return {
    fresh: [...fresh.values()],
    stale: baseline.filter((key) => !present.has(key)),
  };
}

function main(): void {
  const baseline: string[] = JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
  const result = spawnSync("pnpm", ["audit", "--json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  let diff: AdvisoryDiff;
  try {
    diff = diffAdvisories(JSON.parse(result.stdout), baseline);
  } catch (error) {
    // Fail closed: an unreachable or changed audit endpoint is not a pass.
    console.error(
      `dependency-advisories: audit unavailable (${(error as Error).message})`,
    );
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(1);
  }

  if (diff.fresh.length > 0) {
    console.error("Locked dependencies with advisories not in the baseline:");
    for (const finding of diff.fresh) console.error(`- ${finding.line}`);
    console.error(REMEDIATION);
  }
  if (diff.stale.length > 0) {
    console.error(
      `Advisories fixed in the tree but still listed in ${BASELINE_PATH}; delete them:`,
    );
    for (const key of diff.stale) console.error(`- ${key}`);
  }
  if (diff.fresh.length > 0 || diff.stale.length > 0) process.exit(1);

  console.log(
    `dependency-advisories: no advisories beyond the ${baseline.length} baselined`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
