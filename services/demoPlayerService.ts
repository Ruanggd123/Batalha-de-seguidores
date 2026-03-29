// A simple service to generate demo players for spectator mode.

const demoNames = [
  "CyberNinja", "PixelPirate", "GlitchWitch", "DataDragon", "QuantumQueen",
  "SynthSamurai", "VoidViper", "ChronoCaster", "MechaMage", "GridGuardian",
  "AstroAce", "BioBrawler", "CryoCleric", "Dreadnought", "EchoEnigma",
  "FusionFiend", "GeoGoliath", "HydroHarbinger", "InfernoImp", "JoltJester",
  "KineticKnight", "LaserLancer", "MagnetoMonk", "NovaNomad", "OmegaOracle",
  "PsiPaladin", "RuneReaper", "SolarSorcerer", "TerraTitan", "UmbraUsurper",
  "VenomValkyrie", "WarpWarlock", "XenoXiphos", "YottaYojimbo", "ZeroZealot",
  "Arcanist", "Barbarian", "Cleric", "Druid", "Enchanter", "Fighter",
  "Gunslinger", "Hunter", "Illusionist", "Juggernaut", "Knight", "Loremaster",
  "Monk", "Necromancer", "Outlaw", "Paladin", "Questor", "Ranger",
  "ShadowStriker", "Stormcaller", "TimeTwister", "BladeDancer", "RiftWalker",
  "Ironclad", "SpellSlinger", "BeastMaster", "Nightshade", "Sunfire",
  "Voidgazer", "Starcaller", "Mindbender", "Soulreaver", "Earthshaker",
  "Windwalker", "Frostfang", "Pyromancer", "Chronomancer", "Technomancer"
];

export const generateDemoPlayers = (count: number): { name: string; imageUrl: string }[] => {
  const players = [];
  const usedNames = new Set<string>();
  const safeCount = Math.min(count, demoNames.length * 1000); // Prevent infinite loop if count is too high

  for (let i = 0; i < safeCount; i++) {
    let name = demoNames[i % demoNames.length];
    let suffix = Math.floor(i / demoNames.length);
    if (suffix > 0) {
      name = `${name}${suffix}`;
    }

    usedNames.add(name);

    players.push({
      name,
      // Use a unique seed for each player to get different images
      imageUrl: `https://picsum.photos/seed/${name}/96/96`,
    });
  }

  return players;
};