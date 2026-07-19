import type { NextConfig } from 'next';

const environment = process.env.NEXT_PUBLIC_APP_ENV?.replace(/[^a-z0-9-]/gi, '-');

const config: NextConfig = {
  distDir: environment ? `.next-${environment}` : '.next',
};

export default config;
