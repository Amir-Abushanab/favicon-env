import { dev } from 'astro';

const port = Number(process.env.PORT ?? 4321);

const server = await dev({
  root: new URL('./', import.meta.url),
  server: { host: '127.0.0.1', port },
});

console.log(`Astro fixture ready at http://127.0.0.1:${server.address.port}`);

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await server.stop();
    process.exit(0);
  });
}
