import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'public', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Colour literals belong in src/design/tokens.ts, not in class strings.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "JSXAttribute[name.name='className'] Literal[value=/\\b(emerald|violet|fuchsia|pink|purple|lime|teal|sky|indigo|rose|amber|cyan|yellow|orange)-\\d{2,3}\\b/]",
          message:
            'Use a semantic token (accent / reward / danger / info / special) from src/design/tokens.ts instead of a raw Tailwind colour.',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['*.js'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
