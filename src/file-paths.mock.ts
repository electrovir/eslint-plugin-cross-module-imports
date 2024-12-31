import {dirname, join} from 'node:path';

export const packageRepoDirPath = dirname(import.meta.dirname);

export const testFilesDirPath = join(packageRepoDirPath, 'test-files');
