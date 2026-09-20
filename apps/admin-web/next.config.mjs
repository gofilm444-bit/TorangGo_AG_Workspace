/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@platform/shared-types', '@platform/config', '@platform/validation', '@platform/api-client', '@platform/utils'],
};

export default nextConfig;
