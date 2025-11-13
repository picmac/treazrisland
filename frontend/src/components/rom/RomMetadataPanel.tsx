import type { RomAsset, RomDetails } from '@/types/rom';

interface RomMetadataPanelProps {
  rom: RomDetails;
}

export function RomMetadataPanel({ rom }: RomMetadataPanelProps) {
  const primaryAsset = rom.assets[0];
  const rows = [
    { label: 'Platform', value: rom.platformId.toUpperCase() },
    { label: 'Release', value: rom.releaseYear ? rom.releaseYear.toString() : 'Unannounced' },
    {
      label: 'Genres',
      value: rom.genres.length > 0 ? rom.genres.join(', ') : 'Awaiting tags'
    },
    {
      label: 'Primary asset',
      value: primaryAsset ? describeAsset(primaryAsset) : 'Pending upload'
    },
    {
      label: 'Checksum',
      value: primaryAsset ? shortenChecksum(primaryAsset.checksum) : '—'
    },
    {
      label: 'Updated',
      value: new Date(rom.updatedAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    }
  ];

  return (
    <aside className="rom-metadata" aria-label="ROM metadata">
      <h2>Build Sheet</h2>
      <dl className="rom-metadata__grid">
        {rows.map((row) => (
          <div key={row.label} className="rom-metadata__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <section className="rom-metadata__assets" aria-label="Assets">
        <h3>Assets</h3>
        {rom.assets.length === 0 ? (
          <p>No assets registered yet.</p>
        ) : (
          <ul className="rom-metadata__asset-list">
            {rom.assets.map((asset) => (
              <li key={asset.id}>
                <div>
                  <p className="rom-metadata__asset-type">{asset.type}</p>
                  <p className="rom-metadata__asset-meta">
                    {asset.contentType} · {formatBytes(asset.size)}
                  </p>
                </div>
                <a href={asset.url} target="_blank" rel="noreferrer">
                  Open
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function describeAsset(asset: RomAsset): string {
  return `${asset.type} · ${formatBytes(asset.size)}`;
}

function shortenChecksum(checksum: string): string {
  return checksum.length > 12 ? `${checksum.slice(0, 12)}…` : checksum;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
