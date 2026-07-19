// npm-check-updates config — controls `pnpm ncu`.
//
// Because package.json is `"type": "module"`, this file MUST be `.ncurc.cjs`
// (CommonJS). A `.ncurc.js` would be loaded as ESM and `module.exports` would throw.
module.exports = {
  // Skip versions younger than 7 days. Buys time for the ecosystem to catch
  // regressions / supply-chain compromises before we pull them in.
  // Defense-in-depth alongside pnpm's `minimumReleaseAge` in pnpm-workspace.yaml.
  cooldown: '7d',

  // Respect each package's `latest` dist-tag instead of just picking the
  // numerically-highest published version.
  target: 'latest',

  // Hold TypeScript on 6.x: 7.x is the native (Go) port, whose compiler API isn't
  // yet consumable by tsup's .d.ts generation (rollup-plugin-dts) — bumping it
  // breaks `pnpm build`. Remove once the dts toolchain supports TS 7.
  reject: ['typescript'],
};
