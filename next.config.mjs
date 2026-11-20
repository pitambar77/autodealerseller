/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Listing photos come from the API server and from the vehicle images in /public.
  images: { unoptimized: true },
};

export default nextConfig;
