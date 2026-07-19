import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const intent = path.join(root, 'node_modules', '.bin', 'intent')

test('the packed package exposes a loadable, current Intent skill', () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'favicon-env-skill-'))
  try {
    const packOutput = execFileSync('pnpm', ['pack', '--pack-destination', fixture], {
      cwd: root,
      encoding: 'utf8',
    })
    const packed = packOutput.match(/(^|\n)([^\n]+\.tgz)\s*$/)?.[2]
    assert.ok(packed, `could not find the tarball path in pnpm pack output:\n${packOutput}`)
    const tarball = path.resolve(root, packed)

    writeFileSync(
      path.join(fixture, 'package.json'),
      JSON.stringify({ name: 'favicon-env-skill-consumer', private: true }, null, 2),
    )
    execFileSync('pnpm', ['add', '--ignore-workspace', `file:${tarball}`], {
      cwd: fixture,
      stdio: 'pipe',
    })

    const listed = execFileSync(intent, ['list', '--json'], { cwd: fixture, encoding: 'utf8' })
    assert.match(listed, /favicon-env/)
    assert.match(listed, /core/)

    const loaded = execFileSync(intent, ['load', 'favicon-env#core'], {
      cwd: fixture,
      encoding: 'utf8',
    })
    assert.match(loaded, /library_version: ['"]0\.2\.0['"]/)
    assert.match(loaded, /TanStack Start/)
    assert.equal(
      loaded,
      readFileSync(path.join(root, 'skills', 'core', 'SKILL.md'), 'utf8'),
      'the installed skill should exactly match the source skill',
    )
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
