import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({ component: Page });

function Page() {
  return <main data-app-env={import.meta.env.VITE_APP_ENV}>TanStack Start fixture</main>;
}
