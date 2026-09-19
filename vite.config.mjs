import { defineConfig, transformWithEsbuild } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
    plugins: [
        {
            name: 'treat-js-files-as-jsx',
            async transform(code, id) {
                if (!id.match(/src\/.*\.js$/)) return null

                // Use the exposed transform from vite, instead of directly
                // transforming with esbuild
                return transformWithEsbuild(code, id, {
                    loader: 'jsx',
                    jsx: 'automatic',
                })
            },
        },
        react(),
    ],

    resolve: {
        tsconfigPaths: true
    },

    optimizeDeps: {
        force: true,
        esbuildOptions: {
            loader: {
                '.js': 'jsx',
            },
        },
    },
})
