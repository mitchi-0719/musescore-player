/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack 設定（Next.js 16 では必須）
  turbopack: {},

  webpack: (config, { isServer }) => {
    // webmscore はブラウザ環境では別のエントリーポイントを使う
    // Client Component では require("fs") を避けるため、webmscore の default export は使わない
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }

    return config
  },
}

module.exports = nextConfig
