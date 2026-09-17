import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

function missingAssetFallback(): Plugin {
    return {
        name: 'missing-asset-fallback',
        resolveId(id, importer) {
            if (importer && importer.includes('node_modules') && /\.(webp|png|svg|jpg|jpeg)$/.test(id)) {
                return '\0missing-asset:' + id;
            }
        },
        load(id) {
            if (id.startsWith('\0missing-asset:')) {
                return 'export default ""';
            }
        },
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const replitDomains = [env.REPLIT_DEV_DOMAIN, ...(env.REPLIT_DOMAINS ?? '').split(',')]
        .map(domain => domain.trim())
        .filter(Boolean);

    return {
        plugins: [
            missingAssetFallback(),
            react({
                babel: {
                    plugins: [
                        ['@babel/plugin-proposal-decorators', { legacy: true }],
                        ['@babel/plugin-proposal-class-properties', { loose: true }],
                    ],
                },
            }),
        ],
        resolve: {
            alias: {
                '@/external': path.resolve(__dirname, './src/external'),
                '@/components': path.resolve(__dirname, './src/components'),
                '@/hooks': path.resolve(__dirname, './src/hooks'),
                '@/utils': path.resolve(__dirname, './src/utils'),
                '@/constants': path.resolve(__dirname, './src/constants'),
                '@/stores': path.resolve(__dirname, './src/stores'),
                '@/services': path.resolve(__dirname, './src/services'),
                '@/pages': path.resolve(__dirname, './src/pages'),
                '@/adapters': path.resolve(__dirname, './src/adapters'),
                '@/..': path.resolve(__dirname, '.'),
            },
        },
        define: {
            'process.env.NEXT_PUBLIC_DERIV_APP_ID': JSON.stringify(env.NEXT_PUBLIC_DERIV_APP_ID ?? ''),
            'process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI': JSON.stringify(env.NEXT_PUBLIC_DERIV_REDIRECT_URI ?? ''),
            'process.env.NEXT_PUBLIC_DERIV_ENV': JSON.stringify(env.NEXT_PUBLIC_DERIV_ENV ?? ''),
            'process.env.NEXT_PUBLIC_DERIV_REFERRAL_LINK': JSON.stringify(env.NEXT_PUBLIC_DERIV_REFERRAL_LINK ?? ''),
            'process.env.NEXT_PUBLIC_DERIV_APP_NAME': JSON.stringify(env.NEXT_PUBLIC_DERIV_APP_NAME ?? ''),
            'process.env.NEXT_PUBLIC_APP_BUILD': JSON.stringify(env.NEXT_PUBLIC_APP_BUILD ?? ''),
            'process.env.GD_CLIENT_ID': JSON.stringify(env.GD_CLIENT_ID ?? ''),
            'process.env.GD_APP_ID': JSON.stringify(env.GD_APP_ID ?? ''),
            'process.env.GD_API_KEY': JSON.stringify(env.GD_API_KEY ?? ''),
            'process.env.NODE_ENV': JSON.stringify(mode),
        },
        css: {
            preprocessorOptions: {
                scss: {
                    quietDeps: true,
                    loadPaths: [path.resolve(__dirname, 'src')],
                },
            },
        },
        server: {
            port: 5000,
            host: '0.0.0.0',
            allowedHosts: [
                'localhost',
                '127.0.0.1',
                '2fad663f-f2dd-49ee-a2cf-c31476c0feae-00-30vl7t7zuve52.picard.replit.dev',
                ...replitDomains,
            ],
        },
        build: {
            outDir: 'dist',
            cssMinify: false,
        },
        assetsInclude: ['**/*.xml'],
        optimizeDeps: {
            exclude: ['@deriv/quill-icons'],
        },
    };
});
