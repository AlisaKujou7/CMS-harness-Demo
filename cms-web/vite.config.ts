import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API is reached through the same origin, because the refresh cookie is SameSite=Strict.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Not a bare /api, which would also claim the /api-keys screen on a reload.
    proxy: { '^/api/': { target: 'http://localhost:3000' } },
  },
  build: {
    sourcemap: true,
    // M-BUN-02: the editor is one route, but more than one route's budget as a single file.
    rolldownOptions: {
      output: {
        advancedChunks: {
          // Dependencies stay where they are, or React would move in here and load up front.
          includeDependenciesRecursively: false,
          groups: [
            { name: 'prosemirror', test: /[\\/]prosemirror-|@tiptap[\\/]pm/ },
            { name: 'tiptap-core', test: /@tiptap[\\/]core/ },
            { name: 'tiptap', test: /@tiptap[\\/]|linkifyjs/ },
          ],
        },
      },
    },
  },
});
