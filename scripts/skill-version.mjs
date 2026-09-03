// Keeps every skill's `library_version` in lockstep with package.json.
//
// Version drift is silent otherwise: `intent stale` reports it but exits 0, so a
// release that bumps package.json without touching SKILL.md ships a skill that
// claims the wrong library version. Two modes:
//
//   node scripts/skill-version.mjs           rewrite SKILL.md to match (pnpm run skill:sync)
//   node scripts/skill-version.mjs --check   exit 1 on drift            (pnpm run skill:check)
//
// `pnpm run version` runs the sync so the changesets "Version Packages" PR arrives
// already in sync; CI runs the check so hand-edited drift can't reach main.
import { glob, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');

// Matches the `library_version:` line inside the YAML frontmatter, capturing the
// indentation and quote style so a rewrite leaves the rest of the line untouched.
const FIELD = /^(\s*library_version:\s*)(['"]?)([^'"\n]*)\2\s*$/m;

const { version } = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const skills = [];
for await (const file of glob('skills/*/SKILL.md', { cwd: ROOT })) skills.push(file);
skills.sort();

if (skills.length === 0) {
  console.error('no skills/*/SKILL.md found — did the skills directory move?');
  process.exit(1);
}

const drifted = [];
for (const file of skills) {
  const path = new URL(file, new URL('../', import.meta.url));
  const source = await readFile(path, 'utf8');
  const match = source.match(FIELD);

  if (!match) {
    console.error(`${file}: no \`library_version\` in the frontmatter`);
    process.exit(1);
  }

  const [line, prefix, quote, found] = match;
  if (found === version) continue;

  drifted.push({ file, found });
  if (!CHECK) await writeFile(path, source.replace(line, `${prefix}${quote}${version}${quote}`));
}

if (drifted.length === 0) {
  console.log(`✔ ${skills.length} skill(s) at library_version ${version}`);
  process.exit(0);
}

for (const { file, found } of drifted) {
  console[CHECK ? 'error' : 'log'](`${CHECK ? '✖' : '→'} ${file}: ${found} ${CHECK ? '≠' : '→'} ${version}`);
}

if (CHECK) {
  console.error(`\nlibrary_version is out of sync with package.json (${version}). Run \`pnpm run skill:sync\`.`);
  process.exit(1);
}
