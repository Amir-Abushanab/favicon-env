// npm-check-updates config (`pnpm ncu`). Must be `.ncurc.cjs`: package.json is
// `"type": "module"`, so a `.ncurc.js` would load as ESM and `module.exports` would throw.
module.exports = {
  // Skip versions younger than 7 days. Buys time for the ecosystem to catch
  // regressions / supply-chain compromises before we pull them in.
  // Defense-in-depth alongside pnpm's `minimumReleaseAge` in pnpm-workspace.yaml.
  cooldown: '7d',

  // Respect each package's `latest` dist-tag instead of just picking the
  // numerically-highest published version.
  target: 'latest',
};
