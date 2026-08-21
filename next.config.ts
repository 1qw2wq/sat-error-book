import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  allowedDevOrigins: ['ais-dev-z3t2ubiumpueajxl4u6b7e-605402587611.europe-west2.run.app'],
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow access to remote image placeholder.
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.hdfedu.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'r.latexeasy.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: process.env.OUTPUT_STANDALONE === 'true' ? 'standalone' : undefined,
  transpilePackages: ['motion'],
  webpack: (config, {dev}) => {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    if (dev && process.env.DISABLE_HMR === 'true') {
      config.watchOptions = {
        ignored: /.*/,
      };
    }
    return config;
  },
};

export default nextConfig;
