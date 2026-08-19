/** @type {import('next').NextConfig} */
const nextConfig = {
  // Matches the multi-stage Dockerfile, which copies `.next/standalone`.
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
