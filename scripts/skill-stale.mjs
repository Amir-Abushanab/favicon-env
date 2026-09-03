// Turns `intent stale` into a CI gate. The bare command reports and exits 0, so
// anything it finds rides to main unnoticed — this fails the build instead.
//
// Covers every flag `intent stale` can raise, not just version drift:
//   - per-skill reasons: version drift, and `new source (…)` once
//     skills/sync-state.json records source SHAs
//   - signals: artifact parse warnings, a skill path that no longer resolves,
//     artifact/frontmatter source drift, artifact/SKILL.md version drift
//     (all inert until an _artifacts/ tree exists)
//
// Version drift is deliberately also checked by skill-version.mjs --check:
// `intent stale` only flags a skill version *behind* package.json, so a skill
// left ahead of it — after an abandoned bump — reads as clean here.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const intent = join(ROOT, 'node_modules', '.bin', 'intent');

let report;
try {
  report = JSON.parse(execFileSync(intent, ['stale', 'skills', '--json'], { cwd: ROOT, encoding: 'utf8' }));
} catch (error) {
  console.error(`could not run \`intent stale skills --json\`:\n${error.stderr || error.message}`);
  process.exit(1);
}

const problems = [];
for (const entry of report) {
  for (const skill of entry.skills ?? []) {
    for (const reason of skill.reasons ?? []) problems.push(`${entry.library} › ${skill.name}: ${reason}`);
  }
  for (const signal of entry.signals ?? []) {
    const where = signal.artifactPath ?? signal.subject;
    for (const reason of signal.reasons ?? []) problems.push(`${entry.library} › ${where} [${signal.type}]: ${reason}`);
  }
}

if (problems.length === 0) {
  const libraries = report.map((entry) => `${entry.library}@${entry.currentVersion}`).join(', ');
  console.log(`✔ no staleness reported (${libraries || 'no packages'})`);
  process.exit(0);
}

for (const problem of problems) console.error(`✖ ${problem}`);
console.error('\nThe published skill no longer matches the package. Re-review it, then run `pnpm run skill:sync` if only the version moved.');
process.exit(1);
