#!/usr/bin/env ts-node
import fs from 'fs';
import path from 'path';

type EntryType = 'build' | 'playtest' | 'approval';

type CliArgs = Record<string, string | undefined>;

const repoRoot = path.resolve(__dirname, '..', '..');
const logbookPath = path.join(repoRoot, 'docs', 'logbook', 'launch-log.md');
const artifactsDir = path.join(repoRoot, 'docs', 'logbook', 'artifacts');

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new Error(`Unexpected argument "${token}". Use --key value syntax.`);
    }
    const [rawKey, inlineValue] = token.slice(2).split('=');
    const key = rawKey.trim();
    if (!key) {
      throw new Error('Argument keys cannot be empty.');
    }
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}.`);
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function requireArg(args: CliArgs, name: string): string {
  const value = args[name];
  if (!value) {
    throw new Error(`Missing required --${name} argument.`);
  }
  return value.trim();
}

function assertLogbookExists(): void {
  if (!fs.existsSync(logbookPath)) {
    throw new Error(`Launch log not found at ${logbookPath}.`);
  }
}

function normaliseArtifactPath(input: string): { displayName: string; linkTarget: string } {
  const cleaned = input.replace(/\\/g, '/').trim();
  if (!cleaned) {
    throw new Error('Artifact names cannot be empty.');
  }
  if (cleaned.includes('..')) {
    throw new Error(`Artifact path "${cleaned}" cannot traverse directories.`);
  }

  let absolutePath: string;
  if (cleaned.startsWith('docs/logbook/artifacts/')) {
    absolutePath = path.join(repoRoot, cleaned);
  } else if (cleaned.startsWith('artifacts/')) {
    absolutePath = path.join(path.dirname(logbookPath), cleaned);
  } else {
    absolutePath = path.join(artifactsDir, cleaned);
  }

  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(path.resolve(artifactsDir))) {
    throw new Error(`Artifact must live inside docs/logbook/artifacts. Received "${cleaned}".`);
  }

  if (!fs.existsSync(resolved)) {
    throw new Error(`Artifact file not found: ${resolved}`);
  }

  const relativeLink = path.relative(path.dirname(logbookPath), resolved).split(path.sep).join('/');

  return {
    displayName: path.basename(resolved),
    linkTarget: relativeLink,
  };
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function main(): void {
  try {
    assertLogbookExists();

    const args = parseArgs(process.argv.slice(2));
    const entryType = requireArg(args, 'type').toLowerCase();

    if (!['build', 'playtest', 'approval'].includes(entryType)) {
      throw new Error('--type must be one of: build, playtest, approval.');
    }

    const title = requireArg(args, 'title');
    const summary = requireArg(args, 'summary');
    const artifactsArg = requireArg(args, 'artifacts');
    const notes = args['notes']?.trim();
    const timestamp = (args['timestamp'] ?? new Date().toISOString()).trim();

    const artifacts = artifactsArg
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(normaliseArtifactPath);

    if (artifacts.length === 0) {
      throw new Error('At least one artifact must be provided via --artifacts.');
    }

    const entryLines: string[] = [
      '',
      `### ${timestamp} — ${capitalise(entryType)} — ${title}`,
      '',
      `- **Summary:** ${summary}`,
      '- **Artifacts:**',
      ...artifacts.map((artifact) => `  - [${artifact.displayName}](${artifact.linkTarget})`),
    ];

    if (notes) {
      entryLines.push(`- **Notes:** ${notes}`);
    }

    entryLines.push('');

    fs.appendFileSync(logbookPath, `${entryLines.join('\n')}\n`, { encoding: 'utf8' });
    console.log(`Entry appended to ${path.relative(repoRoot, logbookPath)}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nLogbook entry failed: ${error.message}`);
    } else {
      console.error('\nLogbook entry failed due to an unknown error.');
    }
    process.exit(1);
  }
}

main();
