import {Linter} from '@typescript-eslint/utils/ts-eslint';
import {noBadCjsImportsRule} from './no-bad-cjs-imports.js';
import {createRules} from './rule.js';

const plugin: Linter.Plugin = {
    // preferred location of name and version
    meta: {
        name: 'eslint-plugin-cross-module-imports',
        version: '0.0.1',
    },
    rules: createRules([
        noBadCjsImportsRule,
    ]),
};

export default plugin;
