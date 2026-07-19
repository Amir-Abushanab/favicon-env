import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { FaviconEnv } from './favicon-env';

export const metadata: Metadata = {
  title: 'favicon-env Next.js integration',
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <FaviconEnv />
        {children}
      </body>
    </html>
  );
}
