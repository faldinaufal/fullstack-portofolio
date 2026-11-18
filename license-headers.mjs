// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Copyright (c) 2026 Farhan Aldi Naufal
/* eslint-disable no-console -- command-line tool: console output is its interface */

/**
 * Checks (default) or adds (--fix) the license header on every source file.
 *
 *   node license-headers.mjs              check all files in the repository
 *   node license-headers.mjs --fix        add missing headers to all files
 *   node license-headers.mjs --fix a.ts   only the given files (used by the pre-commit hook)
 *
 * Runs in CI and before every commit, so new files get the header automatically.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, relative } from 'node:path';

const SPDX = 'SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0';
const COPYRIGHT = 'Copyright (c) 2026 Farhan Aldi Naufal';

/** Comment syntax per file type; files of other types are not checked. */
const LINE = { prefix: '// ' };
const HASH = { prefix: '# ' };
const STYLES = {
  '.ts': LINE,
  '.tsx': LINE,
  '.mts': LINE,
  '.cts': LINE,
  '.js': LINE,
  '.jsx': LINE,
  '.mjs': LINE,
  '.cjs': LINE,
  '.prisma': LINE,
  '.css': { prefix: '/* ', suffix: ' */' },
  '.py': HASH,
  '.sh': HASH,
  '.sql': { prefix: '-- ' },
};

/** Generated files that tools rewrite or checksum. */
const SKIPPED = [/(^|\/)prisma\/migrations\//, /(^|\/)next-env\.d\.ts$/, /(^|\/)generated\//];

function styleFor(path) {
  if (SKIPPED.some((pattern) => pattern.test(path))) return undefined;
  if (basename(path) === 'Dockerfile') return HASH;
  return STYLES[extname(path)];
}

/** Lines that must stay first: shebangs, Dockerfile parser directives, Python encodings. */
function isPreamble(line) {
  return /^#!/.test(line) || /^#\s*(syntax|escape|check)=/.test(line) || /coding[:=]/.test(line);
}

function header({ prefix, suffix = '' }) {
  return [`${prefix}${SPDX}${suffix}`, `${prefix}${COPYRIGHT}${suffix}`];
}

function repositoryFiles() {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });
  return output.split('\n').filter(Boolean);
}

const args = process.argv.slice(2);
const fix = args.includes('--fix');
const given = args.filter((arg) => arg !== '--fix');
const files = (given.length > 0 ? given : repositoryFiles()).map((file) =>
  relative(process.cwd(), file).replaceAll('\\', '/'),
);

const missing = [];
for (const file of files) {
  const style = styleFor(file);
  if (!style) continue;

  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue; // deleted or unreadable: nothing to check
  }
  if (text.split('\n', 5).some((line) => line.includes(SPDX))) continue;

  if (!fix) {
    missing.push(file);
    continue;
  }
  const lines = text.split('\n');
  let at = 0;
  while (at < lines.length && isPreamble(lines[at])) at += 1;
  lines.splice(at, 0, ...header(style), ...(lines[at]?.trim() ? [''] : []));
  writeFileSync(file, lines.join('\n'));
  console.log(`license header added: ${file}`);
}

if (missing.length > 0) {
  console.error(`Missing license header in ${missing.length} file(s):`);
  for (const file of missing) console.error(`  ${file}`);
  console.error('Run "pnpm headers:fix" to add them.');
  process.exit(1);
}
