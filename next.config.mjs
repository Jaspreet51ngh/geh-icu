/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/predict/:patientId',
        destination: 'http://localhost:8000/api/predict/:patientId',
      },
    ]
  },
}

export default nextConfig
