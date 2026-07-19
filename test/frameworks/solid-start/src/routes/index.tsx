const appEnv = import.meta.env.VITE_APP_ENV ?? 'prod';

export default function Home() {
  return <main data-app-env={appEnv}>SolidStart fixture</main>;
}
