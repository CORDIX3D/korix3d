/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'korix3d.pl' },
      { protocol: 'https', hostname: 'www.korix3d.pl' },
    ],
  },
};

module.exports = nextConfig;
