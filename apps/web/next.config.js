/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_OUTPUT === 'export';

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  ...(isStaticExport ? { output: 'export' } : {}),
  ...(isStaticExport
    ? {}
    : {
        async rewrites() {
          return [
            {
              source: '/api/:path*',
              destination: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/:path*',
            },
          ];
        },
      }),
};

module.exports = nextConfig;
