const instance = process.env.FAVICON_ENV_INSTANCE?.replace(/[^a-z0-9-]/gi, '-');
const output = instance ? `build-${instance}` : 'build';

await import(`./${output}/index.js`);
