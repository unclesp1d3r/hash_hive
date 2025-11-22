import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import nextConfig from 'eslint-config-next';
import love from 'eslint-config-love';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root/base config – mirrors the old .eslintrc.json at repo root using flat configs
const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    plugins: {
      react: reactPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'react/react-in-jsx-scope': 'off',
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
];

// Backend-specific config: type-aware linting for backend sources
const backendConfig = {
  files: ['backend/**/*.{ts,tsx,js,jsx}'],
  languageOptions: {
    parserOptions: {
      projectService: false,
      project: './backend/tsconfig.eslint.json',
      tsconfigRootDir: __dirname,
    },
  },
  ignores: ['backend/src/examples/**'],
};

// Shared package config: type-aware linting using its tsconfig
const sharedConfig = {
  files: ['shared/**/*.{ts,tsx,js,jsx}'],
  languageOptions: {
    parserOptions: {
      project: ['./shared/tsconfig.json'],
      tsconfigRootDir: __dirname,
    },
  },
};

// Backend examples: lint without TS project (no type awareness needed)
const backendExamplesConfig = {
  files: ['backend/src/examples/**/*.ts'],
  languageOptions: {
    parserOptions: {
      tsconfigRootDir: __dirname,
    },
  },
};

// Frontend config: Next.js core-web-vitals via flat import
const frontendConfig = {
  ...nextConfig['core-web-vitals'],
  files: [
    'frontend/app/**/*.{ts,tsx,js,jsx}',
    'frontend/components/**/*.{ts,tsx,js,jsx}',
    'frontend/lib/**/*.{ts,tsx,js,jsx}',
  ],
  languageOptions: {
    parserOptions: {
      project: ['./frontend/tsconfig.json'],
      tsconfigRootDir: __dirname,
    },
  },
};

const nodeConfigFiles = {
  files: [
    'frontend/jest.config.{js,cjs,mjs,ts}',
    'frontend/jest.setup.{js,ts}',
    'frontend/next.config.{js,cjs,mjs,ts}',
    'frontend/postcss.config.{js,cjs,mjs,ts}',
    'frontend/tailwind.config.{js,cjs,mjs,ts}',
  ],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script',
    parserOptions: {
      tsconfigRootDir: __dirname,
    },
    globals: {
      module: 'readonly',
      require: 'readonly',
      process: 'readonly',
    },
  },
  rules: {
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/triple-slash-reference': 'off',
  },
};

// Final override: always allow Next's generated triple-slash refs
const nextEnvOverride = {
  files: ['frontend/next-env.d.ts'],
  rules: {
    '@typescript-eslint/triple-slash-reference': 'off',
  },
};

const backendExamplesNoProjectOverride = {
  files: ['backend/src/examples/**/*.ts'],
  languageOptions: {
    parserOptions: {
      project: undefined,
      tsconfigRootDir: __dirname,
    },
  },
};

const frontendConfigFilesNoProjectOverride = {
  files: ['frontend/postcss.config.{js,cjs,mjs,ts}'],
  languageOptions: {
    parserOptions: {
      project: undefined,
      tsconfigRootDir: __dirname,
    },
  },
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/src/examples/**',
      '**/jest.config.*',
      '**/postcss.config.*',
      '**/tailwind.config.*',
      '**/next-env.d.ts',
    ],
  },
  ...baseConfig,
  love,
  backendConfig,
  sharedConfig,
  backendExamplesConfig,
  frontendConfig,
  nodeConfigFiles,
  nextEnvOverride,
  backendExamplesNoProjectOverride,
  frontendConfigFilesNoProjectOverride,
];
