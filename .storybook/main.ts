import {fileURLToPath} from 'node:url';
import type {StorybookConfig} from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: {name: '@storybook/react-vite', options: {}},
  viteFinal: (cfg) => {
    cfg.resolve ??= {};
    cfg.resolve.alias = {
      ...cfg.resolve.alias,
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    };
    return cfg;
  },
};

export default config;
