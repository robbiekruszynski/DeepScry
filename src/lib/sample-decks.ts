import type { DeckArchetype } from "@/lib/deck";

export type ManaColor = "W" | "U" | "B" | "R" | "G";
export type BudgetTier = "budget" | "upgraded" | "optimized" | "cedh";
export type PowerLevel = "casual" | "focused" | "optimized" | "cedh";

export const WISE_MOTHMAN_SAMPLE = {
  name: "The Wise Mothman Sultai sample",
  commanderName: "The Wise Mothman",
  archetype: "midrange" as DeckArchetype,
  decklist: `1 The Wise Mothman
1 Command Tower
1 Exotic Orchard
1 Opulent Palace
1 Zagoth Triome
1 Breeding Pool
1 Watery Grave
1 Overgrown Tomb
1 Hinterland Harbor
1 Drowned Catacomb
1 Woodland Cemetery
1 Yavimaya Coast
1 Underground River
1 Llanowar Wastes
1 Temple of Mystery
1 Temple of Deceit
1 Temple of Malady
1 Bojuka Bog
1 Reliquary Tower
1 Evolving Wilds
1 Terramorphic Expanse
1 Myriad Landscape
6 Forest
6 Island
5 Swamp
1 Sol Ring
1 Arcane Signet
1 Fellwar Stone
1 Dimir Signet
1 Simic Signet
1 Golgari Signet
1 Talisman of Dominance
1 Cultivate
1 Kodama's Reach
1 Farseek
1 Sakura-Tribe Elder
1 Birds of Paradise
1 Llanowar Elves
1 Elvish Mystic
1 Fyndhorn Elves
1 Coiling Oracle
1 Baleful Strix
1 Eternal Witness
1 Solemn Simulacrum
1 Muldrotha, the Gravetide
1 Syr Konrad, the Grim
1 Consuming Aberration
1 Wonder
1 Brawn
1 Acidic Slime
1 Evolution Sage
1 Winding Constrictor
1 Forgotten Ancient
1 Corpsejack Menace
1 Laboratory Maniac
1 Thassa's Oracle
1 Scute Swarm
1 Seedborn Muse
1 Beast Whisperer
1 Tatyova, Benthic Druid
1 Mesmeric Orb
1 Altar of Dementia
1 Fraying Sanity
1 Sphinx's Tutelage
1 Mindcrank
1 Revel in Riches
1 Exquisite Blood
1 Doubling Season
1 Hardened Scales
1 Branching Evolution
1 Lightning Greaves
1 Assassin's Trophy
1 Beast Within
1 Putrefy
1 Counterspell
1 Swan Song
1 Arcane Denial
1 Reality Shift
1 Toxic Deluge
1 Casualties of War
1 Cyclonic Rift
1 Rhystic Study
1 Mystic Remora
1 Fact or Fiction
1 Regrowth
1 Living Death`,
};

const POPULAR_COMMANDERS: Record<string, string> = {
  B: "K'rrik, Son of Yawgmoth",
  BG: "Meren of Clan Nel Toth",
  BGR: "Korvold, Fae-Cursed King",
  BGU: "The Wise Mothman",
  BR: "Prosper, Tome-Bound",
  BRW: "Edgar Markov",
  G: "Goreclaw, Terror of Qal Sisma",
  GR: "Xenagos, God of Revels",
  GRU: "Kalamax, the Stormsire",
  GRW: "Pantlaza, Sun-Favored",
  GU: "Aesi, Tyrant of Gyre Strait",
  GW: "Sythis, Harvest's Hand",
  GWU: "Chulane, Teller of Tales",
  R: "Krenko, Mob Boss",
  RW: "Winota, Joiner of Forces",
  U: "Talrand, Sky Summoner",
  UB: "Yuriko, the Tiger's Shadow",
  UBR: "Marchesa, the Black Rose",
  UR: "Niv-Mizzet, Parun",
  URW: "Narset, Enlightened Exile",
  W: "Giada, Font of Hope",
  WB: "Liesa, Shroud of Dusk",
  WBG: "Tayam, Luminous Enigma",
  WU: "Brago, King Eternal",
  WUB: "Alela, Artful Provocateur",
  WUBRG: "Kenrith, the Returned King",
};

const COLORLESS_STAPLES = [
  "Sol Ring",
  "Arcane Signet",
  "Fellwar Stone",
  "Mind Stone",
  "Thought Vessel",
  "Wayfarer's Bauble",
  "Commander's Sphere",
  "Worn Powerstone",
  "Hedron Archive",
  "Swiftfoot Boots",
  "Lightning Greaves",
  "Skullclamp",
  "Mask of Memory",
  "Sword of the Animist",
  "Solemn Simulacrum",
  "Burnished Hart",
  "Meteor Golem",
  "Duplicant",
  "Steel Hellkite",
  "Myr Battlesphere",
  "Trading Post",
  "Panharmonicon",
  "The Immortal Sun",
  "Endless Atlas",
  "Mind's Eye",
  "Palladium Myr",
  "Ornithopter of Paradise",
  "Foundry Inspector",
  "Jhoira's Familiar",
  "Scrap Trawler",
  "Myr Retriever",
  "Junk Diver",
  "Steel Overseer",
  "Chief of the Foundry",
  "Adaptive Automaton",
  "Universal Automaton",
  "Liberator, Urza's Battlethopter",
  "Walking Ballista",
  "Hangarback Walker",
  "Kuldotha Forgemaster",
  "Nevinyrral's Disk",
  "Unstable Obelisk",
  "Dreamstone Hedron",
  "Thran Dynamo",
  "Gilded Lotus",
  "Planar Bridge",
  "Staff of Nin",
  "Key to the City",
  "Thaumatic Compass",
  "Strionic Resonator",
  "Conjurer's Closet",
  "Caged Sun",
  "Temple Bell",
  "Perilous Vault",
  "Spine of Ish Sah",
];

const COLOR_STAPLES: Record<ManaColor, string[]> = {
  W: [
    "Swords to Plowshares",
    "Path to Exile",
    "Generous Gift",
    "Austere Command",
    "Sun Titan",
    "Esper Sentinel",
    "Smothering Tithe",
    "Teferi's Protection",
    "Wrath of God",
    "Farewell",
    "Welcoming Vampire",
    "Land Tax",
  ],
  U: [
    "Counterspell",
    "Arcane Denial",
    "Swan Song",
    "Negate",
    "Fact or Fiction",
    "Rhystic Study",
    "Mystic Remora",
    "Cyclonic Rift",
    "Ponder",
    "Preordain",
    "Mulldrifter",
    "Reality Shift",
  ],
  B: [
    "Demonic Tutor",
    "Diabolic Tutor",
    "Sign in Blood",
    "Night's Whisper",
    "Phyrexian Arena",
    "Toxic Deluge",
    "Damnation",
    "Feed the Swarm",
    "Go for the Throat",
    "Reanimate",
    "Victimize",
    "Gray Merchant of Asphodel",
  ],
  R: [
    "Chaos Warp",
    "Blasphemous Act",
    "Vandalblast",
    "Jeska's Will",
    "Faithless Looting",
    "Big Score",
    "Dockside Extortionist",
    "Dualcaster Mage",
    "Reverberate",
    "Impact Tremors",
    "Etali, Primal Storm",
    "Comet Storm",
  ],
  G: [
    "Cultivate",
    "Kodama's Reach",
    "Farseek",
    "Nature's Lore",
    "Three Visits",
    "Sakura-Tribe Elder",
    "Beast Within",
    "Heroic Intervention",
    "Eternal Witness",
    "Beast Whisperer",
    "Avenger of Zendikar",
    "Finale of Devastation",
  ],
};

const BUDGET_EXCLUSIONS: Record<BudgetTier, Set<string>> = {
  budget: new Set([
    "Cyclonic Rift",
    "Demonic Tutor",
    "Dockside Extortionist",
    "Doubling Season",
    "Esper Sentinel",
    "Finale of Devastation",
    "Jeska's Will",
    "Land Tax",
    "Mystic Remora",
    "Rhystic Study",
    "Smothering Tithe",
    "Teferi's Protection",
    "Three Visits",
    "Toxic Deluge",
  ]),
  upgraded: new Set(["Dockside Extortionist", "Demonic Tutor", "Teferi's Protection"]),
  optimized: new Set(),
  cedh: new Set(),
};

const BASICS: Record<ManaColor, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

function colorKey(colors: ManaColor[]) {
  return [...colors].sort().join("") || "BGU";
}

function uniqueCards(cards: string[], budget: BudgetTier, commanderName: string) {
  const seen = new Set([commanderName.toLowerCase()]);
  const blocked = BUDGET_EXCLUSIONS[budget];
  return cards.filter((card) => {
    const key = card.toLowerCase();
    if (seen.has(key) || blocked.has(card)) return false;
    seen.add(key);
    return true;
  });
}

export function generateCommanderSample({
  colors,
  commanderName,
  budget,
  powerLevel,
}: {
  colors: ManaColor[];
  commanderName?: string;
  budget: BudgetTier;
  powerLevel: PowerLevel;
}) {
  const pickedColors = colors.length ? colors : (["B", "G", "U"] as ManaColor[]);
  const key = colorKey(pickedColors);
  const commander = commanderName?.trim() || POPULAR_COMMANDERS[key] || POPULAR_COMMANDERS.BGU;
  const landTarget = powerLevel === "cedh" ? 31 : powerLevel === "optimized" ? 34 : 37;
  const nonlandTarget = 100 - landTarget;
  const pool = uniqueCards(
    [
      ...COLORLESS_STAPLES,
      ...pickedColors.flatMap((color) => COLOR_STAPLES[color]),
      ...(powerLevel === "cedh" ? ["Thassa's Oracle", "Laboratory Maniac"] : []),
    ],
    budget,
    commander
  );
  const spells = pool.slice(0, nonlandTarget - 1);
  const nonbasicLands = [
    "Command Tower",
    "Exotic Orchard",
    "Path of Ancestry",
    "Opal Palace",
    "Evolving Wilds",
    "Terramorphic Expanse",
    "Myriad Landscape",
    "Reliquary Tower",
    "Rogue's Passage",
    "Temple of the False God",
  ].slice(0, Math.min(10, landTarget - pickedColors.length));
  const basicsNeeded = landTarget - nonbasicLands.length;
  const basicLines = pickedColors.map((color, idx) => {
    const base = Math.floor(basicsNeeded / pickedColors.length);
    const extra = idx < basicsNeeded % pickedColors.length ? 1 : 0;
    return `${base + extra} ${BASICS[color]}`;
  });

  return {
    name: `${commander} ${budget} ${powerLevel} sample`,
    commanderName: commander,
    archetype: powerLevel === "cedh" || powerLevel === "optimized" ? "combo" as DeckArchetype : "midrange" as DeckArchetype,
    powerLevel,
    budget,
    colors: pickedColors,
    decklist: [
      `1 ${commander}`,
      ...spells.map((card) => `1 ${card}`),
      ...nonbasicLands.map((card) => `1 ${card}`),
      ...basicLines,
    ].join("\n"),
  };
}
