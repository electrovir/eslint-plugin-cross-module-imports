import {describe, it} from '@augment-vir/test';
import {RuleTester} from '@typescript-eslint/rule-tester';
import {join} from 'node:path';
import {after} from 'node:test';
import {testFilesDirPath} from './file-paths.mock.js';
import {noBadCjsImportsRule} from './no-bad-cjs-imports.js';

RuleTester.afterAll = after;
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester();

ruleTester.run(noBadCjsImportsRule.name, noBadCjsImportsRule, {
    invalid: [
        {
            name: 'fails destructure imports',
            code: `
                        import {doThing} from '../cjs-package/cjs.js';
                    `,
            errors: [
                {
                    messageId: noBadCjsImportsRule.messageIds.badDestructure,
                },
            ],
            filename: join(testFilesDirPath, 'esm-package', 'esm.ts'),
        },
        {
            name: 'fails namespace imports',
            code: `
                        import * as doThing from '../cjs-package/cjs.js';
                    `,
            errors: [
                {
                    messageId: noBadCjsImportsRule.messageIds.badNamespace,
                },
            ],
            filename: join(testFilesDirPath, 'esm-package', 'esm.ts'),
        },
        {
            name: 'fails combined destructure and default imports',
            code: `
                        import doThing, {doThing as doThing2} from '../cjs-package/cjs.js';
                    `,
            errors: [
                {
                    messageId: noBadCjsImportsRule.messageIds.badDestructure,
                },
            ],
            filename: join(testFilesDirPath, 'esm-package', 'esm.ts'),
        },
    ],
    valid: [
        {
            name: 'accepts default imports',
            code: `
                        import doThing from '../cjs-package/cjs.js';
                    `,
            filename: join(testFilesDirPath, 'esm-package', 'esm.ts'),
        },
        {
            name: 'accepts node imports',
            code: `
                        import * as fs from 'fs';
                        import * as fs from 'node:fs';
                    `,
            filename: join(testFilesDirPath, 'esm-package', 'esm.ts'),
        },
        {
            name: 'accepts type namespace imports',
            code: `
                        import type * as doThing from '../cjs-package/cjs.js';
                    `,
            filename: join(testFilesDirPath, 'esm-package', 'esm.ts'),
        },
        {
            name: 'accepts type destructure imports',
            code: `
                        import type {doThing} from '../cjs-package/cjs.js';
                        import {type doThing} from '../cjs-package/cjs.js';
                    `,
            filename: join(testFilesDirPath, 'esm-package', 'esm.ts'),
        },
    ],
});
