/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the Neon serverless driver and `ws` out of the webpack/minifier bundle.
  // Bundling `ws` mangles its WebSocket masking (`t.mask is not a function`) on
  // Vercel; loading these from node_modules at runtime keeps them intact.
  experimental: {
    serverComponentsExternalPackages: ["@prisma/adapter-neon", "@neondatabase/serverless", "ws"],
  },
};

export default nextConfig;
