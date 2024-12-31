import {assertWrap, check} from '@augment-vir/assert';
import {log, type ArrayElement} from '@augment-vir/common';
import {type ImportDeclaration} from 'estree';
import {resolve} from 'import-meta-resolve';
import {readFileSync} from 'node:fs';
import {dirname, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {packageUpSync} from 'package-up';
import {type PackageJson} from 'type-fest';
import {defineRule} from './rule.js';

const isEsmCache: {[PackageJsonOrSourceCodeFilePath in string]: boolean} = {};

function isFileInEsmPackage(filePath: string): boolean | undefined {
    const cachedFileIsEsm = isEsmCache[filePath];
    if (check.isBoolean(cachedFileIsEsm)) {
        return cachedFileIsEsm;
    }

    const packageJsonPath = packageUpSync({
        cwd: dirname(filePath),
    });

    if (!packageJsonPath) {
        return undefined;
    }

    const cachedPackageJsonIsEsm = isEsmCache[packageJsonPath];
    if (check.isBoolean(cachedPackageJsonIsEsm)) {
        isEsmCache[filePath] = cachedPackageJsonIsEsm;
        return cachedPackageJsonIsEsm;
    }

    const packageJson = JSON.parse(String(readFileSync(packageJsonPath))) as PackageJson;

    const isEsm = packageJson.type === 'module';

    isEsmCache[filePath] = isEsm;
    isEsmCache[packageJsonPath] = isEsm;
    return isEsm;
}

export const noBadCjsImportsRule = defineRule(
    'no-bad-cjs-imports',
    {
        badDestructure: 'Do not destructure CJS imports in ESM files. Use default imports.',
        badNamespace: 'Do import CJS namespaces in ESM files. Use default imports.',
    },
    ({context, messageIds, ruleName}) => {
        const filePath = context.filename;
        const isFileEsm = isFileInEsmPackage(filePath);

        if (isFileEsm === undefined) {
            log.warning(
                `Cannot execute ESLint rule '${ruleName}' on file '${relative(process.cwd(), filePath)}' because it has no parent package.json file.`,
            );
            return {};
        } else if (!isFileEsm) {
            /** Nothing to check because the current file is not ESM. */
            return {};
        }

        return {
            ImportDeclaration(node) {
                const importPath = String(node.source.value);
                const resolvedPath = fileURLToPath(
                    resolve(importPath, String(pathToFileURL(filePath))),
                );

                const isImportEsm = isFileInEsmPackage(resolvedPath);

                if (isImportEsm === undefined) {
                    log.warning(
                        `Cannot execute ESLint rule '${ruleName}' on file '${relative(process.cwd(), filePath)}' on import '${importPath}' because the imported file has no parent package.json file.`,
                    );
                    return;
                } else if (
                    /** Nothing to check because the imported file is ESM. */
                    isImportEsm ||
                    /** We don't care about type imports. */
                    node.importKind === 'type'
                ) {
                    return;
                }

                node.specifiers.forEach((specifier) => {
                    if (
                        /** Default imports are okay. */
                        specifier.type === 'ImportDefaultSpecifier' ||
                        /** We don't care about type imports. */
                        (specifier as Pick<typeof node, 'importKind'>).importKind === 'type'
                    ) {
                        return;
                    }

                    if (specifier.type === 'ImportSpecifier') {
                        context.report({
                            loc: assertWrap.isDefined(specifier.loc),
                            messageId: messageIds.badDestructure,
                            node: specifier,
                        });
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    } else if (specifier.type === 'ImportNamespaceSpecifier') {
                        context.report({
                            loc: assertWrap.isDefined(specifier.loc),
                            messageId: messageIds.badNamespace,
                            node: specifier,
                        });
                    } else {
                        throw new Error(
                            `Unexpected import specifier type: '${(specifier as ArrayElement<ImportDeclaration['specifiers']>).type}'`,
                        );
                    }
                });
            },
        };
    },
);
