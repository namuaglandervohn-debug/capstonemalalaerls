import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/styles/globals.css', // Points to your Tailwind CSS
                'resources/ts/main.tsx'          // Points to your React entry file
            ],
            refresh: true,
        }),
        tailwindcss(),
        react(),
    ],
    resolve: {
        alias: {
            '@': '/resources/ts',
        },
    },
});