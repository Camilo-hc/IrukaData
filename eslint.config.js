import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/statistics/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'dexie', 'react-router-dom', '*/application/*', '*/infrastructure/*', '*/ui/*', '*/app/*', '*/demo/*'], message: 'El dominio y las estadísticas no dependen de UI, casos de uso ni adaptadores.' },
        ],
      }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['react', 'react/*', 'react-dom', 'dexie', 'react-router-dom', '*/application/*', '*/infrastructure/*', '*/ui/*', '*/app/*', '*/demo/*', '*/statistics/*'] }],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['react', 'react/*', 'dexie', '*/infrastructure/*', '*/ui/*', '*/app/*'] }] },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: ['dexie', '*/infrastructure/*'] }] },
  },
)
