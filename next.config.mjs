import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const faceDetectionShim = path.join(__dirname, 'lib/mediapipe-face-detection-shim.ts')
const faceMeshShim = path.join(__dirname, 'lib/mediapipe-face-mesh-shim.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['172.31.192.1', 'localhost:3000', '127.0.0.1', '192.168.1.4'],
  images: {
    unoptimized: true,
  },
  turbopack: {
    resolveAlias: {
      '@mediapipe/face_detection': './lib/mediapipe-face-detection-shim.ts',
      '@mediapipe/face_mesh': './lib/mediapipe-face-mesh-shim.ts',
    },
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@mediapipe/face_detection': faceDetectionShim,
      '@mediapipe/face_mesh': faceMeshShim,
    }
    return config
  },
  // Security headers applied to all responses
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
