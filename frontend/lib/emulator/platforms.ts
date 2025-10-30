export type EmulatorPlatformConfig = {
  /**
   * Identifier understood by EmulatorJS to group compatible cores.
   */
  systemId: string;
  /**
   * Default core to boot when none is explicitly selected.
   */
  defaultCore: string;
  /**
   * Ordered list of preferred cores for this platform.
   */
  preferredCores: readonly string[];
};

const canonicalConfigs: Record<string, EmulatorPlatformConfig> = {
  nes: {
    systemId: "nes",
    defaultCore: "fceumm",
    preferredCores: ["fceumm", "nestopia"]
  },
  snes: {
    systemId: "snes",
    defaultCore: "snes9x",
    preferredCores: ["snes9x", "bsnes"]
  },
  n64: {
    systemId: "n64",
    defaultCore: "mupen64plus_next",
    preferredCores: ["mupen64plus_next", "parallel_n64"]
  },
  gba: {
    systemId: "gba",
    defaultCore: "mgba",
    preferredCores: ["mgba"]
  },
  gb: {
    systemId: "gb",
    defaultCore: "gambatte",
    preferredCores: ["gambatte"]
  },
  arcade: {
    systemId: "arcade",
    defaultCore: "fbneo",
    preferredCores: ["fbneo", "fbalpha2012_cps1", "fbalpha2012_cps2", "same_cdi"]
  },
  mame: {
    systemId: "mame",
    defaultCore: "mame2003_plus",
    preferredCores: ["mame2003_plus", "mame2003"]
  },
  nds: {
    systemId: "nds",
    defaultCore: "melonds",
    preferredCores: ["melonds", "desmume", "desmume2015"]
  },
  psp: {
    systemId: "psp",
    defaultCore: "ppsspp",
    preferredCores: ["ppsspp"]
  },
  psx: {
    systemId: "psx",
    defaultCore: "pcsx_rearmed",
    preferredCores: ["pcsx_rearmed", "mednafen_psx_hw"]
  },
  "sega-md": {
    systemId: "segaMD",
    defaultCore: "genesis_plus_gx",
    preferredCores: ["genesis_plus_gx", "genesis_plus_gx_wide", "picodrive"]
  },
  "sega-ms": {
    systemId: "segaMS",
    defaultCore: "smsplus",
    preferredCores: ["smsplus", "genesis_plus_gx", "genesis_plus_gx_wide", "picodrive"]
  },
  "sega-gg": {
    systemId: "segaGG",
    defaultCore: "genesis_plus_gx",
    preferredCores: ["genesis_plus_gx", "genesis_plus_gx_wide"]
  },
  "sega-cd": {
    systemId: "segaCD",
    defaultCore: "genesis_plus_gx",
    preferredCores: ["genesis_plus_gx", "genesis_plus_gx_wide", "picodrive"]
  },
  "sega-32x": {
    systemId: "sega32x",
    defaultCore: "picodrive",
    preferredCores: ["picodrive"]
  },
  lynx: {
    systemId: "lynx",
    defaultCore: "handy",
    preferredCores: ["handy"]
  },
  ngp: {
    systemId: "ngp",
    defaultCore: "mednafen_ngp",
    preferredCores: ["mednafen_ngp"]
  },
  pce: {
    systemId: "pce",
    defaultCore: "mednafen_pce",
    preferredCores: ["mednafen_pce"]
  },
  pcfx: {
    systemId: "pcfx",
    defaultCore: "mednafen_pcfx",
    preferredCores: ["mednafen_pcfx"]
  },
  ws: {
    systemId: "ws",
    defaultCore: "mednafen_wswan",
    preferredCores: ["mednafen_wswan"]
  },
  "3do": {
    systemId: "3do",
    defaultCore: "opera",
    preferredCores: ["opera"]
  },
  atari2600: {
    systemId: "atari2600",
    defaultCore: "stella2014",
    preferredCores: ["stella2014"]
  },
  atari5200: {
    systemId: "atari5200",
    defaultCore: "a5200",
    preferredCores: ["a5200"]
  },
  atari7800: {
    systemId: "atari7800",
    defaultCore: "prosystem",
    preferredCores: ["prosystem"]
  },
  jaguar: {
    systemId: "jaguar",
    defaultCore: "virtualjaguar",
    preferredCores: ["virtualjaguar"]
  },
  vb: {
    systemId: "vb",
    defaultCore: "beetle_vb",
    preferredCores: ["beetle_vb"]
  },
  amiga: {
    systemId: "amiga",
    defaultCore: "puae",
    preferredCores: ["puae"]
  },
  coleco: {
    systemId: "coleco",
    defaultCore: "gearcoleco",
    preferredCores: ["gearcoleco"]
  },
  saturn: {
    systemId: "segaSaturn",
    defaultCore: "yabause",
    preferredCores: ["yabause"]
  },
  c64: {
    systemId: "c64",
    defaultCore: "vice_x64sc",
    preferredCores: ["vice_x64sc"]
  },
  c128: {
    systemId: "c128",
    defaultCore: "vice_x128",
    preferredCores: ["vice_x128"]
  },
  pet: {
    systemId: "pet",
    defaultCore: "vice_xpet",
    preferredCores: ["vice_xpet"]
  },
  plus4: {
    systemId: "plus4",
    defaultCore: "vice_xplus4",
    preferredCores: ["vice_xplus4"]
  },
  vic20: {
    systemId: "vic20",
    defaultCore: "vice_xvic",
    preferredCores: ["vice_xvic"]
  },
  dos: {
    systemId: "dos",
    defaultCore: "dosbox_pure",
    preferredCores: ["dosbox_pure"]
  }
};

const aliasEntries: Array<[string, keyof typeof canonicalConfigs]> = [
  ["famicom", "nes"],
  ["supernintendo", "snes"],
  ["super-nes", "snes"],
  ["nintendo64", "n64"],
  ["gameboy", "gb"],
  ["gbc", "gb"],
  ["gameboycolor", "gb"],
  ["gameboy-color", "gb"],
  ["gameboyadvance", "gba"],
  ["game-boy-advance", "gba"],
  ["nintendo-ds", "nds"],
  ["ds", "nds"],
  ["playstation", "psx"],
  ["playstation1", "psx"],
  ["ps1", "psx"],
  ["psx", "psx"],
  ["playstation-portable", "psp"],
  ["panasonic3do", "3do"],
  ["fbneo", "arcade"],
  ["neo-geo", "arcade"],
  ["neogeo", "arcade"],
  ["mame2003", "mame"],
  ["turbo-grafx-16", "pce"],
  ["turbografx16", "pce"],
  ["pc-engine", "pce"],
  ["pcengine", "pce"],
  ["pcfx", "pcfx"],
  ["wonderswan", "ws"],
  ["wonderswan-color", "ws"],
  ["virtualboy", "vb"],
  ["neo-geo-pocket", "ngp"],
  ["neo-geo-pocket-color", "ngp"],
  ["ngpc", "ngp"],
  ["atarilynx", "lynx"],
  ["atarijaguar", "jaguar"],
  ["sms", "sega-ms"],
  ["master-system", "sega-ms"],
  ["megadrive", "sega-md"],
  ["mega-drive", "sega-md"],
  ["genesis", "sega-md"],
  ["sega-genesis", "sega-md"],
  ["32x", "sega-32x"],
  ["sega32x", "sega-32x"],
  ["sega-cd", "sega-cd"],
  ["segacd", "sega-cd"],
  ["mega-cd", "sega-cd"],
  ["sega-game-gear", "sega-gg"],
  ["gamegear", "sega-gg"],
  ["gg", "sega-gg"],
  ["saturn", "saturn"],
  ["sega-saturn", "saturn"],
  ["commodore-64", "c64"],
  ["commodore-128", "c128"],
  ["commodore-amiga", "amiga"],
  ["commodore-pet", "pet"],
  ["commodore-plus4", "plus4"],
  ["commodore-vic20", "vic20"],
  ["ms-dos", "dos"],
  ["msdos", "dos"],
  ["colecovision", "coleco"],
  ["lynx", "lynx"],
  ["jaguar", "jaguar"],
  ["arcade", "arcade"],
  ["mame", "mame"],
  ["dosbox", "dos"],
  ["vb", "vb"]
];

const platformConfigMap: Record<string, EmulatorPlatformConfig> = Object.fromEntries(
  Object.entries(canonicalConfigs).map(([slug, config]) => [slug, config])
);

for (const [alias, target] of aliasEntries) {
  const normalizedAlias = alias.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  const config = platformConfigMap[normalizedTarget];
  if (config) {
    platformConfigMap[normalizedAlias] = config;
  }
}

export function getPlatformConfig(platform: string): EmulatorPlatformConfig | null {
  if (!platform) {
    return null;
  }

  return platformConfigMap[platform.toLowerCase()] ?? null;
}

export function listSupportedPlatforms(): string[] {
  return Object.keys(platformConfigMap).sort();
}
