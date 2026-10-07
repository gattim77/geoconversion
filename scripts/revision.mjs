import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
writeFileSync('src/revision.ts',`export const revision=${JSON.stringify(revision)};\n`);
