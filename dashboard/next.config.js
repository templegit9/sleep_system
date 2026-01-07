/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // For offline Proxmox deployment
    output: 'standalone',
}

module.exports = nextConfig
