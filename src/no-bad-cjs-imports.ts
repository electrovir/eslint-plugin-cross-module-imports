import {assertWrap, check} from '@augment-vir/assert';
import {log, type ArrayElement} from '@augment-vir/common';
import {findAncestor, resolveImportPath} from '@augment-vir/node';
import {type ImportDeclaration} from 'estree';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {builtinModules} from 'node:module';
import {dirname, extname, join, relative, resolve} from 'node:path';
import {type PackageJson} from 'type-fest';
import {defineRule} from './rule.js';

const isEsmCache: {[PackageJsonOrSourceCodeFilePath in string]: boolean} = {};

function isFileInEsmPackage(filePath: string): boolean | undefined {
    const cachedFileIsEsm = isEsmCache[filePath];
    if (check.isBoolean(cachedFileIsEsm)) {
        return cachedFileIsEsm;
    }

    const packageJsonDirPath = findAncestor(filePath, (path) =>
        existsSync(join(path, 'package.json')),
    );

    if (!packageJsonDirPath) {
        return undefined;
    }

    const packageJsonPath = join(packageJsonDirPath, 'package.json');

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

function findExactImportFile(importPath: string | undefined) {
    if (
        !importPath ||
        /** We can't figure anything out if the path doesn't actually exist. */
        !existsSync(importPath) ||
        /** Import path is already to a file. */
        !statSync(importPath).isDirectory()
    ) {
        return importPath;
    }

    const packageJsonPath = join(importPath, 'package.json');

    if (!existsSync(packageJsonPath)) {
        return packageJsonPath;
    }

    const packageJson = JSON.parse(String(readFileSync(packageJsonPath))) as PackageJson;

    /** Might as well cache this since we already have the `package.json` parsed. */
    isEsmCache[packageJsonPath] = packageJson.type === 'module';

    const packageEntryPoint = packageJson.module || packageJson.main;

    if (!packageEntryPoint) {
        throw new Error(`No package entry point found for ${packageJsonPath}`);
    }

    const packageEntryPointPath = resolve(dirname(packageJsonPath), packageEntryPoint);

    if (!existsSync(packageEntryPointPath)) {
        throw new Error(`Package entry point does not exist: '${packageEntryPointPath}'`);
    }

    return packageEntryPointPath;
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

                if (importPath.startsWith('node:') || builtinModules.includes(importPath)) {
                    /** No need to lint imports from Node.js's own built-in packages. */
                    return;
                }

                const resolvedPath = findExactImportFile(resolveImportPath(filePath, importPath));

                if (!resolvedPath) {
                    throw new Error(
                        `Unable to resolve import path for '${importPath}' from '${filePath}'`,
                    );
                }
                const extension = extname(resolvedPath);

                if (!extension) {
                    throw new Error(
                        `No extension found for import path: '${importPath}' resolved to '${resolvedPath}' from '${filePath}'`,
                    );
                } else if (!extension.includes('ts')) {
                    /** Don't bother checking non-ts files. */
                    return;
                }

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
