# eslint-plugin-cross-module-imports

Prevent accidental imports from cross-module packages that will fail in run time but not in TypeScript type checking.

Rule name: `no-bad-cjs-imports`

## Config Usage

```javascript
import crossModuleImports from 'eslint-plugin-cross-module-imports';

export default [
    {
        plugins: {
            '@cross-module': crossModuleImports,
        },
        rules: {
            '@cross-module/no-bad-cjs-imports': 'error',
        },
    },
];
```
