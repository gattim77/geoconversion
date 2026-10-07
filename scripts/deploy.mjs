import {execFileSync} from 'node:child_process';
const revision=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
execFileSync('npx',['wrangler','deploy','--tag',revision,'--var',`COMMIT_SHA:${revision}`],{stdio:'inherit'});
