// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * ESLint flat config (ESLint 10 + typescript-eslint 8).
 *
 * Uses type-aware linting (`recommendedTypeChecked`) so rules can reason about
 * types — worth the small performance cost for a long-lived codebase.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'prisma/migrations/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
      sourceType: 'module',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Interfaces/DI patterns in Nest legitimately use empty-ish shapes.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Require explicit handling of floating promises — important for async
      // controllers/services in a backend.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Allow `@Injectable()` classes without members-only enforcement noise.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    // Test files legitimately traffic in `any` (jest mocks, supertest bodies),
    // so type-aware rules are disabled here — the recommended typescript-eslint
    // pattern. Formatting and non-type rules still apply.
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  // Must be last so Prettier formatting wins over stylistic ESLint rules.
  eslintPluginPrettierRecommended,
);
