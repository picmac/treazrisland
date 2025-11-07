import {
  EnrichmentProvider,
  RomAssetSource,
  RomAssetType
} from "@prisma/client";

export type RomMetadataSeed = {
  source: EnrichmentProvider;
  language?: string;
  region?: string;
  summary?: string;
  storyline?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  rating?: number;
};

export type RomAssetSeed = {
  providerId: string;
  type: RomAssetType;
  source: RomAssetSource;
  language?: string;
  region?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  format?: string;
  checksum?: string;
  storageKey?: string;
  externalUrl?: string;
};

export type RomSeed = {
  title: string;
  releaseYear?: number;
  players?: number;
  romSize?: number;
  romHash?: string;
  screenscraperId?: number;
  metadata?: RomMetadataSeed[];
  assets?: RomAssetSeed[];
};

export type PlatformSeed = {
  slug: string;
  name: string;
  shortName?: string;
  screenscraperId?: number;
  roms: RomSeed[];
};

export type TopListSeed = {
  slug: string;
  title: string;
  description?: string;
  publishedAt: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  entries: Array<{
    rank: number;
    platformSlug: string;
    romTitle: string;
    blurb?: string;
  }>;
};

export const PLATFORM_SEEDS: PlatformSeed[] = [
  {
    slug: "nes",
    name: "Nintendo Entertainment System",
    shortName: "NES",
    screenscraperId: 1,
    roms: [
      {
        title: "The Legend of Zelda",
        releaseYear: 1986,
        players: 1,
        romSize: 131072,
        romHash: "8f5619edc76bf7af1296c5bff8d7f729d99c1b7f8c950b6a7e97560e9bc5b3d1",
        screenscraperId: 734,
        metadata: [
          {
            source: EnrichmentProvider.MANUAL,
            language: "en",
            region: "USA",
            summary:
              "Embark on a quest across Hyrule to recover the Triforce of Wisdom and rescue Princess Zelda from the clutches of Ganon.",
            storyline:
              "Armed with a wooden sword and a spirit for exploration, Link scours labyrinths, uncovers secret caves, and assembles the relic needed to defeat darkness.",
            developer: "Nintendo EAD",
            publisher: "Nintendo",
            genre: "Action Adventure",
            rating: 4.8
          }
        ],
        assets: [
          {
            providerId: "nes-legend-of-zelda-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.MANUAL_ENTRY,
            width: 512,
            height: 720,
            fileSize: 198234,
            format: "jpg",
            checksum: "3fb4c3b1b654ad0fa5f18b8e7e3f995cf6ffaf36c3de0f1d70bb64a2395c9df2",
            storageKey: "seed/nes/the-legend-of-zelda/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/nes/the-legend-of-zelda.jpg"
          },
          {
            providerId: "nes-legend-of-zelda-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.MANUAL_ENTRY,
            width: 512,
            height: 448,
            fileSize: 145332,
            format: "png",
            checksum: "b65a3f8d0f9b46b2e8c9c2fddad5d7d708c0ed9495820c6057627a4c63884d20",
            storageKey: "seed/nes/the-legend-of-zelda/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/nes/the-legend-of-zelda-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "snes",
    name: "Super Nintendo Entertainment System",
    shortName: "SNES",
    screenscraperId: 4,
    roms: [
      {
        title: "Chrono Trigger",
        releaseYear: 1995,
        players: 1,
        romSize: 41943040,
        romHash: "5c0a8cb90f0660a4e4a6d15dc67a8f03ed94f1a1b1fa7b48a1660a6a7308ec49",
        screenscraperId: 2005,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Travel through time to assemble an unlikely party of heroes and prevent the apocalyptic rise of Lavos.",
            storyline:
              "An accident at the Millennial Fair launches Crono and his friends across the ages, weaving together eras and destinies in a quest to reshape history.",
            developer: "Square",
            publisher: "Square",
            genre: "Role-Playing",
            rating: 5
          }
        ],
        assets: [
          {
            providerId: "snes-chrono-trigger-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 600,
            height: 840,
            fileSize: 253441,
            format: "jpg",
            checksum: "bd593d85a2a9e0ea2d885e5f8bfc68013a503d17f6a69f615cff815dd2c3a957",
            storageKey: "seed/snes/chrono-trigger/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/snes/chrono-trigger.jpg"
          },
          {
            providerId: "snes-chrono-trigger-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 640,
            height: 448,
            fileSize: 178552,
            format: "png",
            checksum: "15f0c6fa1456b0ec50c8f123cb90a28b3d62d5ecfd4a4c36b3f83db9dcb6e5fb",
            storageKey: "seed/snes/chrono-trigger/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/snes/chrono-trigger-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "n64",
    name: "Nintendo 64",
    shortName: "N64",
    screenscraperId: 14,
    roms: [
      {
        title: "The Legend of Zelda: Ocarina of Time",
        releaseYear: 1998,
        players: 1,
        romSize: 33554432,
        romHash: "a6de228a5821a673d9fa3a501f9f4c1091cf07bba468e5794d7d1cf2db3bb4f6",
        screenscraperId: 168,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Master time itself with the Ocarina to thwart Ganondorf and restore peace to the land of Hyrule.",
            storyline:
              "Young Link pulls the Master Sword, awakening seven years later to a world consumed by darkness. Guided by sages, he navigates dungeons and eras to reclaim the Triforce.",
            developer: "Nintendo EAD",
            publisher: "Nintendo",
            genre: "Action Adventure",
            rating: 4.9
          }
        ],
        assets: [
          {
            providerId: "n64-ocarina-of-time-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 600,
            height: 840,
            fileSize: 221004,
            format: "jpg",
            checksum: "4da971c5a6390d68799f56e7bb854e101b43f5a812f7985435fce82e8a7d689c",
            storageKey: "seed/n64/ocarina-of-time/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/n64/ocarina-of-time.jpg"
          },
          {
            providerId: "n64-ocarina-of-time-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 640,
            height: 480,
            fileSize: 190112,
            format: "png",
            checksum: "b2a7c7fcb6b1ce37a17e75e5947cc4c4bf081819f5d3ba2b6264e2f8dd62d59b",
            storageKey: "seed/n64/ocarina-of-time/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/n64/ocarina-of-time-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "gba",
    name: "Nintendo Game Boy Advance",
    shortName: "GBA",
    screenscraperId: 12,
    roms: [
      {
        title: "Metroid Fusion",
        releaseYear: 2002,
        players: 1,
        romSize: 16777216,
        romHash: "9c3bbd77366a997b372cc13a5c777c2b481e5f351eadc92335fba2a5f0b93baa",
        screenscraperId: 5439,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Samus returns to the Biologic Space Laboratories station to eradicate a parasitic threat and uncover a Galactic Federation conspiracy.",
            storyline:
              "After being infected by the X parasite, Samus awakens with Metroid DNA and a new suit, delving into a derelict station to stop the SA-X doppelgänger.",
            developer: "Nintendo R&D1",
            publisher: "Nintendo",
            genre: "Action Platformer",
            rating: 4.7
          }
        ],
        assets: [
          {
            providerId: "gba-metroid-fusion-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 512,
            height: 720,
            fileSize: 201884,
            format: "jpg",
            checksum: "46b8184f7a75e05b601a6b2d6f6d62206fd9332a6004b8a55d4c263b2d6b6dcd",
            storageKey: "seed/gba/metroid-fusion/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/gba/metroid-fusion.jpg"
          },
          {
            providerId: "gba-metroid-fusion-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 480,
            height: 320,
            fileSize: 132884,
            format: "png",
            checksum: "2ebcbe0c0d5598b64059a5b514eb82b3bd68d0e05baea1c6d856b8f9ef49fe9a",
            storageKey: "seed/gba/metroid-fusion/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/gba/metroid-fusion-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "gb",
    name: "Nintendo Game Boy",
    shortName: "GB",
    screenscraperId: 9,
    roms: [
      {
        title: "Tetris",
        releaseYear: 1989,
        players: 2,
        romSize: 65536,
        romHash: "f0d155926d8abf2d9a73b7df1c1b00a98952ded3ac1c5819fb719c41b6bd5c4a",
        screenscraperId: 16,
        metadata: [
          {
            source: EnrichmentProvider.MANUAL,
            language: "en",
            region: "World",
            summary:
              "Arrange falling tetrominoes to clear lines and chase the satisfying rocket launch at higher levels.",
            storyline:
              "Nintendo's handheld rendition of Alexey Pajitnov's puzzle phenomenon became the quintessential pack-in title, sparking the portable revolution.",
            developer: "Nintendo",
            publisher: "Nintendo",
            genre: "Puzzle",
            rating: 4.5
          }
        ],
        assets: [
          {
            providerId: "gb-tetris-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.MANUAL_ENTRY,
            width: 512,
            height: 720,
            fileSize: 184220,
            format: "jpg",
            checksum: "4f2f67ca9bba9c3aa2ec06ebebf2dbfea76d5f4b4801b1bff95524177ad4d4fb",
            storageKey: "seed/gb/tetris/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/gb/tetris.jpg"
          },
          {
            providerId: "gb-tetris-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.MANUAL_ENTRY,
            width: 320,
            height: 288,
            fileSize: 98544,
            format: "png",
            checksum: "0e116dd86f0426ad2f6b3727d78b1b4b2a0cdbd43e17ace5b8bc2ad0f859cd6e",
            storageKey: "seed/gb/tetris/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/gb/tetris-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "gbc",
    name: "Nintendo Game Boy Color",
    shortName: "GBC",
    screenscraperId: 10,
    roms: [
      {
        title: "Pokémon Crystal",
        releaseYear: 2000,
        players: 2,
        romSize: 2097152,
        romHash: "2c6e1f7dfd12b3e58dcb6a6e123a5648d1e27856e086c4da98f93ec4f764e19f",
        screenscraperId: 14195,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Journey through Johto and Kanto to complete the Pokédex, uncover the secrets of Suicune, and challenge the Champion.",
            storyline:
              "An expanded version of Gold and Silver introduces the Battle Tower, animated sprites, and Kris—the first playable female protagonist in the series.",
            developer: "Game Freak",
            publisher: "Nintendo",
            genre: "Role-Playing",
            rating: 4.6
          }
        ],
        assets: [
          {
            providerId: "gbc-pokemon-crystal-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 512,
            height: 720,
            fileSize: 210332,
            format: "jpg",
            checksum: "e3085a720fd9f4b61505e4f8deecbb6f8d6ee68140bcd0991cfbfae766ba1345",
            storageKey: "seed/gbc/pokemon-crystal/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/gbc/pokemon-crystal.jpg"
          },
          {
            providerId: "gbc-pokemon-crystal-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 320,
            height: 288,
            fileSize: 104556,
            format: "png",
            checksum: "0d6304a6325490c4ff35bd5ef27405b1b05b01d627dd251f69f5c13f1bbec5c3",
            storageKey: "seed/gbc/pokemon-crystal/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/gbc/pokemon-crystal-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "genesis",
    name: "Sega Mega Drive / Genesis",
    shortName: "Genesis",
    screenscraperId: 29,
    roms: [
      {
        title: "Sonic the Hedgehog 2",
        releaseYear: 1992,
        players: 2,
        romSize: 2097152,
        romHash: "c99b19592a66b2eb42d3266d0c0ae7c304f26c7c0f17dfd1237064d2ca9f0c0b",
        screenscraperId: 454,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Dash with Sonic and Tails to stop Dr. Robotnik's Death Egg scheme and liberate flickies across Emerald Hill.",
            storyline:
              "After returning from West Side Island, the duo uncovers the villain's plan to power a space station with the Chaos Emeralds, launching through loops and special stages to stop him.",
            developer: "Sonic Team",
            publisher: "Sega",
            genre: "Action Platformer",
            rating: 4.4
          }
        ],
        assets: [
          {
            providerId: "genesis-sonic-2-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 600,
            height: 840,
            fileSize: 215884,
            format: "jpg",
            checksum: "f85e3db23460fcb4a1c91e5f46a2cd1b04a5a1fdbd635c9cbe8f257a7e8ef8b4",
            storageKey: "seed/genesis/sonic-2/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/genesis/sonic-2.jpg"
          },
          {
            providerId: "genesis-sonic-2-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 640,
            height: 448,
            fileSize: 170220,
            format: "png",
            checksum: "1eb8b1628ac88a55fd70a0d3fabc8100bad2dc76f2b8bb210c2ae95f0d0711d5",
            storageKey: "seed/genesis/sonic-2/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/genesis/sonic-2-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "dreamcast",
    name: "Sega Dreamcast",
    shortName: "Dreamcast",
    screenscraperId: 23,
    roms: [
      {
        title: "Jet Set Radio",
        releaseYear: 2000,
        players: 1,
        romSize: 104857600,
        romHash: "3b1d6b239a64a47ac9b5a724765ddf9cf9be3fd4f322f3c43b0d4e79c96e6a44",
        screenscraperId: 791,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Roll through Tokyo-to on magnetized skates, tagging turf and outmaneuvering the Rokkaku Police.",
            storyline:
              "The GGs crew recruits graffiti renegades, discovers conspiracies, and sparks a counter-culture revolution backed by Professor K's pirate radio.",
            developer: "Smilebit",
            publisher: "Sega",
            genre: "Action",
            rating: 4.3
          }
        ],
        assets: [
          {
            providerId: "dreamcast-jet-set-radio-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 600,
            height: 840,
            fileSize: 228440,
            format: "jpg",
            checksum: "5b25d49e9c6f35b860815249b0c4e99648b2fbe099c0990994f824a182d20a5f",
            storageKey: "seed/dreamcast/jet-set-radio/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/dreamcast/jet-set-radio.jpg"
          },
          {
            providerId: "dreamcast-jet-set-radio-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 640,
            height: 480,
            fileSize: 195114,
            format: "png",
            checksum: "9229d57f81c64ce39fa915cfdf65ec2bc45a4f53e759c339f2cc38e0c98ce0ef",
            storageKey: "seed/dreamcast/jet-set-radio/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/dreamcast/jet-set-radio-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "ps1",
    name: "Sony PlayStation",
    shortName: "PS1",
    screenscraperId: 57,
    roms: [
      {
        title: "Final Fantasy VII",
        releaseYear: 1997,
        players: 1,
        romSize: 524288000,
        romHash: "0a0d87543224e34eb58bcf2c529d7a3ea2746871a6ec97e64b7aa90bf34c9b52",
        screenscraperId: 173,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Lead the eco-terrorist group AVALANCHE against the Shinra Electric Company and the fallen SOLDIER Sephiroth.",
            storyline:
              "Cloud Strife's shattered past unravels as the party pursues Sephiroth across a dying planet, confronting Jenova, WEAPONs, and existential questions about identity.",
            developer: "Square",
            publisher: "Square",
            genre: "Role-Playing",
            rating: 4.9
          }
        ],
        assets: [
          {
            providerId: "ps1-final-fantasy-vii-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 600,
            height: 840,
            fileSize: 240884,
            format: "jpg",
            checksum: "9b65a2a603c3aa09c6c9f091b6f1aa7cd0a1aefec96fb7d526e346ba137c6eb3",
            storageKey: "seed/ps1/final-fantasy-vii/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/ps1/final-fantasy-vii.jpg"
          },
          {
            providerId: "ps1-final-fantasy-vii-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 640,
            height: 480,
            fileSize: 182223,
            format: "png",
            checksum: "b707833a0ef649c4e41fb6e6be1a12387a8d75902dd89d64046777e8ecfdbbe9",
            storageKey: "seed/ps1/final-fantasy-vii/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/ps1/final-fantasy-vii-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "ps2",
    name: "Sony PlayStation 2",
    shortName: "PS2",
    screenscraperId: 80,
    roms: [
      {
        title: "Shadow of the Colossus",
        releaseYear: 2005,
        players: 1,
        romSize: 209715200,
        romHash: "3f5ac8a8e1e14a705a1a90a3f88d0bd41b9cc9b4a8913a2518dc47999a4d1472",
        screenscraperId: 983,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Traverse the Forbidden Lands on Agro to topple sixteen colossi and bargain for the life of Mono.",
            storyline:
              "Wander strikes a pact with Dormin, each towering foe testing resolve as the line between sacrifice and obsession blurs.",
            developer: "Team Ico",
            publisher: "Sony Computer Entertainment",
            genre: "Action Adventure",
            rating: 4.8
          }
        ],
        assets: [
          {
            providerId: "ps2-shadow-of-the-colossus-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 600,
            height: 840,
            fileSize: 236900,
            format: "jpg",
            checksum: "f20a6c05cd65bf84f3f6f05139c867ea9f0b5a9856133c9e65976f9116c7cd69",
            storageKey: "seed/ps2/shadow-of-the-colossus/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/ps2/shadow-of-the-colossus.jpg"
          },
          {
            providerId: "ps2-shadow-of-the-colossus-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 640,
            height: 480,
            fileSize: 205442,
            format: "png",
            checksum: "7fa2d6b44c4d969555d69e9268940106d9863725c4d8ea2a1e3d3c1464d5cf29",
            storageKey: "seed/ps2/shadow-of-the-colossus/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/ps2/shadow-of-the-colossus-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "psp",
    name: "Sony PlayStation Portable",
    shortName: "PSP",
    screenscraperId: 86,
    roms: [
      {
        title: "Lumines",
        releaseYear: 2004,
        players: 2,
        romSize: 94371840,
        romHash: "6b95ef59f827c4fd356765cf189e44b6b3d407879541974808d8cd24cf7fd2b3",
        screenscraperId: 15356,
        metadata: [
          {
            source: EnrichmentProvider.MANUAL,
            language: "en",
            region: "USA",
            summary:
              "Blend falling blocks with Mizuguchi's hypnotic soundtrack in this launch-era PSP puzzle classic.",
            storyline:
              "Each cleared line shifts the timeline bar in sync with the beat, opening skins and rivals in an ever-accelerating synesthetic chase.",
            developer: "Q Entertainment",
            publisher: "Ubisoft",
            genre: "Puzzle",
            rating: 4.2
          }
        ],
        assets: [
          {
            providerId: "psp-lumines-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.MANUAL_ENTRY,
            width: 512,
            height: 720,
            fileSize: 195772,
            format: "jpg",
            checksum: "9dc6885db5a58a5484b41e4c0d8ef5e6de8f3b0a0c7417f9ca6421e4bdc43d9f",
            storageKey: "seed/psp/lumines/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/psp/lumines.jpg"
          },
          {
            providerId: "psp-lumines-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.MANUAL_ENTRY,
            width: 480,
            height: 272,
            fileSize: 123884,
            format: "png",
            checksum: "f7cc648b893b1a749f2ec5df9af8f9b9101f5f64d2b562da8db1d4f83956a6af",
            storageKey: "seed/psp/lumines/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/psp/lumines-1.png"
          }
        ]
      }
    ]
  },
  {
    slug: "saturn",
    name: "Sega Saturn",
    shortName: "Saturn",
    screenscraperId: 46,
    roms: [
      {
        title: "NiGHTS into Dreams...",
        releaseYear: 1996,
        players: 2,
        romSize: 73400320,
        romHash: "471e4caa3f1d51472b90b998d84d89bdf81383fde028f1088a92f1fb26a88c7b",
        screenscraperId: 987,
        metadata: [
          {
            source: EnrichmentProvider.SCREEN_SCRAPER,
            language: "en",
            region: "USA",
            summary:
              "Soar through dreamscapes as NiGHTS, freeing dreamers from Wizeman's nightmares in acrobatic flights.",
            storyline:
              "Separated from their personas, Elliott and Claris unite with the jester NiGHTS to reclaim Ideya and defeat Wizeman's invasion of Nightopia.",
            developer: "Sonic Team",
            publisher: "Sega",
            genre: "Action",
            rating: 4.1
          }
        ],
        assets: [
          {
            providerId: "saturn-nights-cover",
            type: RomAssetType.COVER,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 600,
            height: 840,
            fileSize: 223004,
            format: "jpg",
            checksum: "188b80d7bdac1e9fb854a7a8ebf1aa5619f0c6a4ca6fef51e5570ec7fcd5c07f",
            storageKey: "seed/saturn/nights/cover.jpg",
            externalUrl: "https://assets.treazris.land/covers/saturn/nights.jpg"
          },
          {
            providerId: "saturn-nights-screenshot-1",
            type: RomAssetType.SCREENSHOT,
            source: RomAssetSource.SCREEN_SCRAPER,
            width: 640,
            height: 480,
            fileSize: 177552,
            format: "png",
            checksum: "92af8d8f0e4f4d68bc8882db1f25ed520aa1c76a2cd85cc8df1e8906a5d9f833",
            storageKey: "seed/saturn/nights/screenshot-1.png",
            externalUrl: "https://assets.treazris.land/screenshots/saturn/nights-1.png"
          }
        ]
      }
    ]
  }
];

export const TOP_LIST_SEEDS: TopListSeed[] = [
  {
    slug: "golden-age-adventures",
    title: "Golden Age Adventures",
    description:
      "An all-hands list of narrative epics that define TREAZRISLAND's time-hopping storytelling canon.",
    publishedAt: "2024-06-15T12:00:00Z",
    effectiveFrom: "2024-06-01T00:00:00Z",
    entries: [
      {
        rank: 1,
        platformSlug: "snes",
        romTitle: "Chrono Trigger",
        blurb: "Time-traveling bonds forged on the SNES deck."
      },
      {
        rank: 2,
        platformSlug: "ps1",
        romTitle: "Final Fantasy VII",
        blurb: "Midgar's resistance echoing across the stars."
      },
      {
        rank: 3,
        platformSlug: "ps2",
        romTitle: "Shadow of the Colossus",
        blurb: "Sixteen colossi felled for a whispered wish."
      },
      {
        rank: 4,
        platformSlug: "dreamcast",
        romTitle: "Jet Set Radio",
        blurb: "Cel-shaded rebellion on Tokyo-to's rails."
      },
      {
        rank: 5,
        platformSlug: "n64",
        romTitle: "The Legend of Zelda: Ocarina of Time",
        blurb: "A hero awakened to rewrite destiny."
      }
    ]
  },
  {
    slug: "handheld-heroes",
    title: "Handheld Heroes",
    description:
      "Pocket-sized legends that keep crews entertained while waiting for the next voyage.",
    publishedAt: "2024-07-20T15:30:00Z",
    effectiveFrom: "2024-07-01T00:00:00Z",
    entries: [
      {
        rank: 1,
        platformSlug: "gba",
        romTitle: "Metroid Fusion",
        blurb: "Samus' most intimate mission, now in palm-sized form."
      },
      {
        rank: 2,
        platformSlug: "gbc",
        romTitle: "Pokémon Crystal",
        blurb: "Johto journeys with animated flair."
      },
      {
        rank: 3,
        platformSlug: "psp",
        romTitle: "Lumines",
        blurb: "Synesthetic puzzle vibes for long flights."
      },
      {
        rank: 4,
        platformSlug: "gb",
        romTitle: "Tetris",
        blurb: "Falling blocks that launched a thousand voyages."
      },
      {
        rank: 5,
        platformSlug: "nes",
        romTitle: "The Legend of Zelda",
        blurb: "The original overworld adventure, endlessly replayable."
      }
    ]
  }
];
