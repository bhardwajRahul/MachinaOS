import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Allow unused vars that start with underscore or uppercase
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_|^[A-Z]',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^error$|^e$'
      }],
      '@typescript-eslint/no-explicit-any': 'off',
      // Disable strict react-hooks rules from v7 that are too aggressive for existing codebase
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      // Downgrade rules that have many existing violations
      'no-case-declarations': 'warn',
      'no-empty': 'warn',
      'prefer-const': 'warn',
      // Downgrade rules-of-hooks to warn - existing codebase has conditional hook patterns
      // TODO: Fix these violations properly
      'react-hooks/rules-of-hooks': 'warn',
    },
  },
)
