import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

// 데모: 라이브러리 src를 직접 물려 빌드 없이 실동작을 본다.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: {'@': fileURLToPath(new URL('../src', import.meta.url))},
  },
});
