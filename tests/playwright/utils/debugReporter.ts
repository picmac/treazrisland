import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from '@playwright/test/reporter';

const LOG_PREFIX = '[pw-debug]';

const log = (message: string): void => {
  console.log(`${LOG_PREFIX} ${message}`);
};

const indent = (value: string, spaces = 4): string => {
  const pad = ' '.repeat(spaces);
  return value
    .split('\n')
    .map((line) => `${pad}${line}`)
    .join('\n');
};

const formatDuration = (ms: number | undefined): string => {
  if (!ms && ms !== 0) {
    return 'unknown duration';
  }

  if (ms < 1_000) {
    return `${ms}ms`;
  }

  return `${(ms / 1_000).toFixed(2)}s`;
};

const formatTitle = (test: TestCase): string => test.titlePath().join(' › ');

const renderAttachments = (result: TestResult): string[] =>
  result.attachments.map((attachment) => {
    const location = attachment.path ? ` @ ${attachment.path}` : '';
    return `attachment: ${attachment.name} (${attachment.contentType}${location})`;
  });

const renderErrors = (errors: TestError[]): string[] =>
  errors.flatMap((error, index) => {
    const header = `error #${index + 1}: ${error.message ?? 'Unknown failure'}`;
    const stack = error.stack ? indent(error.stack) : undefined;
    return stack ? [header, stack] : [header];
  });

const interestingEnvKeys = [
  'PLAYWRIGHT_BASE_URL',
  'PLAYWRIGHT_API_URL',
  'PLAYWRIGHT_ARTIFACTS_DIR',
  'PLAYWRIGHT_WORKERS',
  'CI',
  'GITHUB_RUN_ID',
  'GITHUB_SHA',
  'NODE_ENV',
];

const require = createRequire(import.meta.url);
const { version: playwrightVersion } = require('@playwright/test/package.json');

class DebugReporter implements Reporter {
  private runStartedAt = Date.now();

  onBegin(config: FullConfig, suite: Suite): void {
    this.runStartedAt = Date.now();
    log('--- Test run diagnostics ---');
    log(`Playwright version: ${playwrightVersion}`);
    log(`Node version: ${process.version}`);
    log(`Suites: ${suite.allTests().length}`);
    log(
      `Projects: ${config.projects
        .map((project) => {
          const base = project.use?.baseURL ?? 'n/a';
          return `${project.name} (baseURL: ${base})`;
        })
        .join(', ')}`,
    );
    log(`Workers: ${config.workers ?? os.cpus().length}`);
    log(`Retries: ${config.retries}`);
    log(`Artifacts directory: ${config.projects.map((project) => project.outputDir).join(', ')}`);

    const envLines = interestingEnvKeys
      .filter((key) => key in process.env)
      .map((key) => `${key}=${process.env[key]}`);

    if (envLines.length > 0) {
      log('Environment variables:');
      envLines.forEach((line) => log(`  ${line}`));
    }

    log(`Host: ${os.hostname()} (${os.type()} ${os.release()})`);
    log(
      `CPU cores: ${os.cpus().length}, total memory: ${Math.round(os.totalmem() / (1024 * 1024))} MB`,
    );
    log(`Working directory: ${process.cwd()}`);
    log('---');
  }

  onTestBegin(test: TestCase): void {
    const relativeFile = path.relative(process.cwd(), test.location.file);
    const projectName = test.parent?.project()?.name ?? 'unknown-project';
    log(
      `↗︎ ${formatTitle(test)} [${relativeFile}:${test.location.line}] (project: ${projectName})`,
    );
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const outcome = result.status.toUpperCase();
    const projectName = test.parent?.project()?.name ?? 'unknown-project';
    const metadata = [
      `project=${projectName}`,
      `worker=${result.workerIndex}`,
      `retry=${result.retry}`,
      `repeat=${result.repeatEachIndex}`,
    ].join(', ');
    log(`⇣ ${formatTitle(test)} -> ${outcome} in ${formatDuration(result.duration)} (${metadata})`);

    if (result.status === 'skipped') {
      return;
    }

    const diagnostics: string[] = [];

    if (result.errors.length > 0) {
      diagnostics.push(...renderErrors(result.errors));
    }

    if (result.stdout.length > 0) {
      diagnostics.push('stdout:', ...result.stdout.map((chunk) => indent(chunk.trim())));
    }

    if (result.stderr.length > 0) {
      diagnostics.push('stderr:', ...result.stderr.map((chunk) => indent(chunk.trim())));
    }

    const attachmentLines = renderAttachments(result);
    if (attachmentLines.length > 0) {
      diagnostics.push('attachments:', ...attachmentLines.map((line) => indent(line)));
    }

    if (diagnostics.length > 0) {
      diagnostics.forEach((line) => log(line));
    }
  }

  onEnd(result: FullResult): void {
    const duration = formatDuration(Date.now() - this.runStartedAt);
    log('--- Test run summary ---');
    log(`Final status: ${result.status}`);
    log(`Total duration: ${duration}`);
    const flakyCount = Array.isArray(result.flaky) ? result.flaky.length : 0;
    const unexpectedCount = Array.isArray(result.unexpected) ? result.unexpected.length : 0;
    log(`Flaky tests: ${flakyCount}`);
    log(`Unexpected failures: ${unexpectedCount}`);
    log('---');
  }
}

export default DebugReporter;
