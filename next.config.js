/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingIncludes: {
    '/api/**/*': ['./catalogue_seed/**/*'],
  },
};

module.exports = nextConfig;
