// dependency-cruiser config — controls `pnpm depcruise` (runs against `src`).
// Must be `.cjs` (CommonJS) because package.json is `"type": "module"`.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular imports make the graph hard to reason about and break tree-shaking.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      comment: 'Modules that import nothing and are imported by nothing are usually dead code.',
      from: {
        orphan: true,
        pathNot: ['\\.d\\.ts$'],
      },
      to: {},
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      comment: 'Import points at something that cannot be resolved — likely a typo or missing dep.',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: '(^|/)node_modules($|/)' },
    parser: 'swc', // TS 7's native port breaks the TS-compiler parser; SWC parses TS without it
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'node', 'default'],
      extensions: ['.ts', '.js'],
    },
  },
};
