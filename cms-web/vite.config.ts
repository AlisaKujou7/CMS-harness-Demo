import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The API is reached through the same origin, because the refresh cookie is SameSite=Strict.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Not a bare /api, which would also claim the /api-keys screen on a reload.
    proxy: { '^/api/': { target: process.env['CMS_API_PROXY'] ?? 'http://localhost:3000' } },
  },
  build: {
    sourcemap: true,
    // M-BUN-02: the editor is one route, but more than one route's budget as a single file.
    rolldownOptions: {
      output: {
        // Only libraries that do not reach React. A group takes its dependencies with it, and leaving
        // them behind instead (includeDependenciesRecursively) breaks ProseMirror's load order.
        advancedChunks: {
          groups: [
            { name: 'prosemirror', test: /[\/]prosemirror-|@tiptap[\/]pm/ },
            { name: 'tiptap-core', test: /@tiptap[\/]core/ },
          ],
        },
      },
    },
  },
});
