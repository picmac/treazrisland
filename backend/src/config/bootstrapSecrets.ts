import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CONFIG_ROOT_ENV = "TREAZ_CONFIG_ROOT";
const SECRETS_FILE_ENV = "TREAZ_SECRETS_FILE";

export interface BootstrapSecretStatus {
  configRoot: string;
  secretsFile: string;
  didCreateFile: boolean;
  didGenerate: boolean;
}

interface PersistedSecrets {
  jwtSecret?: string;
  mfaEncryptionKey?: string;
}

const ensureDirectory = (dir: string) => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
};

const readPersistedSecrets = (filePath: string): PersistedSecrets => {
  try {
    const contents = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(contents);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }

    const secrets: PersistedSecrets = {};
    if (typeof (parsed as { jwtSecret?: unknown }).jwtSecret === "string") {
      secrets.jwtSecret = (parsed as { jwtSecret: string }).jwtSecret;
    }
    if (
      typeof (parsed as { mfaEncryptionKey?: unknown }).mfaEncryptionKey ===
      "string"
    ) {
      secrets.mfaEncryptionKey = (parsed as { mfaEncryptionKey: string })
        .mfaEncryptionKey;
    }
    return secrets;
  } catch (error) {
    return {};
  }
};

const writePersistedSecrets = (
  filePath: string,
  secrets: PersistedSecrets,
): void => {
  const directory = path.dirname(filePath);
  ensureDirectory(directory);
  writeFileSync(filePath, `${JSON.stringify(secrets, null, 2)}\n`, {
    mode: 0o600,
  });
};

const randomSecret = (bytes = 48) => randomBytes(bytes).toString("base64");

export const ensureBootstrapSecrets = (): BootstrapSecretStatus => {
  const configRoot =
    process.env[CONFIG_ROOT_ENV] ?? path.join(process.cwd(), "var", "config");
  const secretsFile =
    process.env[SECRETS_FILE_ENV] ?? path.join(configRoot, "secrets.json");

  ensureDirectory(configRoot);

  const persisted = readPersistedSecrets(secretsFile);
  const status: BootstrapSecretStatus = {
    configRoot,
    secretsFile,
    didCreateFile: false,
    didGenerate: false,
  };

  if (!process.env.JWT_SECRET) {
    if (persisted.jwtSecret) {
      process.env.JWT_SECRET = persisted.jwtSecret;
    } else {
      const secret = randomSecret();
      process.env.JWT_SECRET = secret;
      persisted.jwtSecret = secret;
      status.didGenerate = true;
    }
  }

  if (!process.env.MFA_ENCRYPTION_KEY) {
    if (persisted.mfaEncryptionKey) {
      process.env.MFA_ENCRYPTION_KEY = persisted.mfaEncryptionKey;
    } else {
      const secret = randomSecret();
      process.env.MFA_ENCRYPTION_KEY = secret;
      persisted.mfaEncryptionKey = secret;
      status.didGenerate = true;
    }
  }

  const fileAlreadyExists = existsSync(secretsFile);
  if (!fileAlreadyExists || status.didGenerate) {
    writePersistedSecrets(secretsFile, persisted);
    status.didCreateFile = !fileAlreadyExists;
  }

  return status;
};
