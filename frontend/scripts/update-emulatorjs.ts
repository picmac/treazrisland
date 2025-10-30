import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";

type GitHubAsset = {
  name: string;
  browser_download_url: string;
};

type GitHubRelease = {
  assets: GitHubAsset[];
  tag_name: string;
  published_at: string;
  html_url: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPO = "EmulatorJS/EmulatorJS";
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const TARGET_DIR = path.resolve(__dirname, "../public/vendor/emulatorjs");

async function downloadAsset(url: string, token?: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "treazrisland-update-script",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function getLatestRelease(token?: string): Promise<GitHubRelease> {
  const response = await fetch(API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "treazrisland-update-script",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch latest release: ${response.status} ${response.statusText}`);
  }

  const release = (await response.json()) as GitHubRelease;
  return release;
}

async function extractZip(buffer: Buffer, destination: string) {
  const zip = new AdmZip(buffer);
  zip.extractAllTo(destination, true);
}

async function main() {
  const githubToken = process.env.GITHUB_TOKEN;

  console.log(`Fetching latest EmulatorJS release from ${API_URL}`);
  const release = await getLatestRelease(githubToken);
  if (!release.assets || !Array.isArray(release.assets)) {
    throw new Error("No assets found on the latest release");
  }

  const archiveAsset = release.assets.find((asset) => asset.name.endsWith(".zip"));

  if (!archiveAsset) {
    throw new Error("Could not find a .zip archive in the latest release");
  }

  console.log(`Downloading ${archiveAsset.name} (${archiveAsset.browser_download_url})`);
  const archiveBuffer = await downloadAsset(archiveAsset.browser_download_url, githubToken);

  console.log(`Preparing target directory ${TARGET_DIR}`);
  await rm(TARGET_DIR, { recursive: true, force: true });
  await mkdir(TARGET_DIR, { recursive: true });

  console.log("Extracting EmulatorJS bundle…");
  await extractZip(archiveBuffer, TARGET_DIR);

  const metadataPath = path.join(TARGET_DIR, "treazrisland-emulatorjs.json");
  const metadata = {
    releaseTag: release.tag_name,
    publishedAt: release.published_at,
    sourceUrl: release.html_url,
    extractedAt: new Date().toISOString(),
    asset: archiveAsset.name
  };
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), "utf8");

  console.log(`EmulatorJS updated to ${release.tag_name}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
