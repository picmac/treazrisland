#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();

async function readJson(filePath) {
  const fullPath = path.join(repoRoot, filePath);
  const data = await readFile(fullPath, 'utf8');
  return JSON.parse(data);
}

async function readText(filePath) {
  const fullPath = path.join(repoRoot, filePath);
  return readFile(fullPath, 'utf8');
}

function parseToolVersions(content) {
  const entries = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const [tool, version] = trimmed.split(/\s+/);
    if (tool && version) {
      entries.set(tool, version);
    }
  }
  return entries;
}

function parseComposeImages(content) {
  const images = new Map();
  let inServices = false;
  let currentService = null;
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      currentService = null;
      continue;
    }
    if (!inServices) {
      continue;
    }
    if (/^[^\s]/.test(line)) {
      // Left the services block.
      inServices = false;
      currentService = null;
      continue;
    }
    const serviceMatch = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (serviceMatch) {
      currentService = serviceMatch[1];
      continue;
    }
    const imageMatch = line.match(/^ {4}image:\s+(.+)\s*$/);
    if (imageMatch && currentService) {
      images.set(currentService, imageMatch[1].trim());
    }
  }
  return images;
}

function parseMatrix(content) {
  const lines = content.split(/\r?\n/);
  const tableStart = lines.findIndex((line) => line.trimStart().startsWith('|'));
  if (tableStart === -1) {
    throw new Error('Could not find dependency matrix table.');
  }
  const dataLines = [];
  for (let i = tableStart + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !line.trim().startsWith('|')) {
      break;
    }
    dataLines.push(line);
  }
  const records = new Map();
  for (const line of dataLines) {
    if (/^\|\s*-/.test(line.trim())) {
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 5) {
      continue;
    }
    const [dependency,, version, imageTag, updateCadence] = cells;
    records.set(dependency, {
      version,
      imageTag,
      updateCadence,
    });
  }
  return records;
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeImage(value) {
  const normalized = normalize(value);
  if (normalized.toUpperCase() === 'N/A') {
    return 'N/A';
  }
  return normalized;
}

(async () => {
  const [matrixContent, packageJson, toolVersionsContent, composeContent] = await Promise.all([
    readText('docs/dependency-matrix.md'),
    readJson('package.json'),
    readText('.tool-versions'),
    readText('infrastructure/compose/docker-compose.yml'),
  ]);

  const matrix = parseMatrix(matrixContent);
  const toolVersions = parseToolVersions(toolVersionsContent);
  const composeImages = parseComposeImages(composeContent);

  const expected = new Map();

  const nodeToolVersion = toolVersions.get('nodejs');
  const nodeEngineVersion = packageJson.engines?.node;
  if (!nodeToolVersion) {
    throw new Error('Missing nodejs entry in .tool-versions.');
  }
  if (nodeEngineVersion && normalize(nodeEngineVersion) !== normalize(nodeToolVersion)) {
    throw new Error('Node.js version mismatch between package.json engines and .tool-versions.');
  }
  expected.set('Node.js', {
    version: nodeToolVersion,
    imageTag: 'N/A',
  });

  const pnpmToolVersion = toolVersions.get('pnpm');
  const pnpmEngineVersion = packageJson.engines?.pnpm;
  if (!pnpmToolVersion) {
    throw new Error('Missing pnpm entry in .tool-versions.');
  }
  if (pnpmEngineVersion && normalize(pnpmEngineVersion) !== normalize(pnpmToolVersion)) {
    throw new Error('pnpm version mismatch between package.json engines and .tool-versions.');
  }
  expected.set('pnpm', {
    version: pnpmToolVersion,
    imageTag: 'N/A',
  });

  const postgresToolVersion = toolVersions.get('postgres');
  const postgresImage = composeImages.get('postgres');
  if (!postgresToolVersion) {
    throw new Error('Missing postgres entry in .tool-versions.');
  }
  if (!postgresImage) {
    throw new Error('Missing postgres image definition in docker-compose.yml.');
  }
  expected.set('PostgreSQL', {
    version: postgresToolVersion,
    imageTag: postgresImage,
  });

  const redisToolVersion = toolVersions.get('redis');
  const redisImage = composeImages.get('redis');
  if (!redisToolVersion) {
    throw new Error('Missing redis entry in .tool-versions.');
  }
  if (!redisImage) {
    throw new Error('Missing redis image definition in docker-compose.yml.');
  }
  expected.set('Redis', {
    version: redisToolVersion,
    imageTag: redisImage,
  });

  const minioImage = composeImages.get('minio');
  if (!minioImage) {
    throw new Error('Missing minio image definition in docker-compose.yml.');
  }
  const minioVersion = minioImage.includes(':') ? minioImage.split(':')[1] : minioImage;
  expected.set('MinIO', {
    version: minioVersion,
    imageTag: minioImage,
  });

  const localstackImage = composeImages.get('emulator');
  if (!localstackImage) {
    throw new Error('Missing emulator (LocalStack) image definition in docker-compose.yml.');
  }
  const localstackVersion = localstackImage.includes(':') ? localstackImage.split(':')[1] : localstackImage;
  expected.set('LocalStack', {
    version: localstackVersion,
    imageTag: localstackImage,
  });

  const issues = [];

  for (const [dependency, expectation] of expected.entries()) {
    const row = matrix.get(dependency);
    if (!row) {
      issues.push(`Missing row for ${dependency} in dependency matrix.`);
      continue;
    }
    if (normalize(row.version) !== normalize(expectation.version)) {
      issues.push(
        `Version mismatch for ${dependency}: matrix has "${row.version}", expected "${expectation.version}".`,
      );
    }
    if (normalizeImage(row.imageTag) !== normalizeImage(expectation.imageTag)) {
      issues.push(
        `Image tag mismatch for ${dependency}: matrix has "${row.imageTag}", expected "${expectation.imageTag}".`,
      );
    }
  }

  if (issues.length > 0) {
    console.error('Dependency matrix verification failed:');
    for (const issue of issues) {
      console.error(` - ${issue}`);
    }
    process.exit(1);
  }

  console.log('Dependency matrix is up to date.');
})();
