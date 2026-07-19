const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');
const output = instance ? `.output-${instance}` : '.output';

await import(`./${output}/server/index.mjs`);
