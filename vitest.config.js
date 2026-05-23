import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
    test: {
        environment: 'happy-dom',
        globals: true,
        include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
        coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/lib/**'] },
        setupFiles: ['tests/setup.ts'],
    },
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
