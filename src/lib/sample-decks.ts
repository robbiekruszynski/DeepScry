import type { DeckArchetype } from "@/lib/deck";
import type { EdhrecCard } from "@/app/api/edhrec/route";

export type ManaColor = "W" | "U" | "B" | "R" | "G";
export type BudgetTier = "budget" | "upgraded" | "optimized" | "cedh";
export type PowerLevel = "casual" | "focused" | "optimized" | "cedh";

// Price ceiling per card for each budget tier
export const BUDGET_PRICE_CAPS: Record<BudgetTier, number | null> = {
  budget: 5,
  upgraded: 20,
  optimized: 60,
  cedh: null,
};

// ── Commander pools ──────────────────────────────────────────────────────────
// Four tiers per color identity so the picked commander matches the expected
// power level. Random selection within a tier gives variety on repeated rolls.
// Only include commanders that have real EDHREC pages.

type TieredPool = {
  casual: string[];
  focused: string[];
  optimized: string[];
  cedh: string[];
};

const COMMANDER_POOLS: Record<string, TieredPool> = {
  // ─ Mono ──────────────────────────────────────────────────────────────────
  W: {
    casual:    ["Odric, Lunarch Marshal", "Darien, King of Kjeldor", "Lena, Selfless Champion", "Kwende, Pride of Femeref"],
    focused:   ["Giada, Font of Hope", "Heliod, God of the Sun", "Teshar, Ancestor's Apostle", "Oketra the True"],
    optimized: ["Elesh Norn, Grand Cenobite", "Heliod, Sun-Crowned", "Kemba, Kha Regent"],
    cedh:      ["Heliod, Sun-Crowned", "Mavinda, Students' Advocate"],
  },
  U: {
    casual:    ["Talrand, Sky Summoner", "Orvar, the All-Form", "Rayne, Academy Chancellor", "Brudiclad, Telchor Engineer"],
    focused:   ["Baral, Chief of Compliance", "Teferi, Temporal Archmage", "Jalira, Master Polymorphist"],
    optimized: ["Urza, Lord High Artificer", "Sai, Master Thopterist"],
    cedh:      ["Urza, Lord High Artificer", "Baral, Chief of Compliance"],
  },
  B: {
    casual:    ["Ayara, First of Locthwain", "Drana, Liberator of Malakir", "Nevinyrral, Urborg Tyrant", "Lim-Dul the Necromancer"],
    focused:   ["Tergrid, God of Fright", "Gonti, Lord of Luxury", "Geth, Lord of the Vault", "Shirei, Shizo's Caretaker"],
    optimized: ["Sheoldred, the Apocalypse", "Erebos, Bleak-Hearted", "Yawgmoth, Thran Physician"],
    cedh:      ["K'rrik, Son of Yawgmoth", "Yawgmoth, Thran Physician", "Razaketh, the Foulblooded"],
  },
  R: {
    casual:    ["Krenko, Mob Boss", "Purphoros, God of the Forge", "Pia Nalaar", "Wulfgar of Icewind Dale"],
    focused:   ["Magda, Brazen Outlaw", "Grenzo, Havoc Raiser", "Etali, Primal Storm"],
    optimized: ["Daretti, Scrap Savant", "Laelia, the Blade Reforged"],
    cedh:      ["Zada, Hedron Grinder", "Dargo, the Shipwrecker"],
  },
  G: {
    casual:    ["Goreclaw, Terror of Qal Sisma", "Yeva, Nature's Herald", "Jolrael, Mwonvuli Recluse", "Ayula, Queen Among Bears"],
    focused:   ["Titania, Protector of Argoth", "Selvala, Heart of the Wilds", "Azusa, Lost but Seeking"],
    optimized: ["Vorinclex, Monstrous Raider", "Ghalta, Primal Hunger", "Kogla, the Titan Ape"],
    cedh:      ["Selvala, Heart of the Wilds", "Marwyn, the Nurturer"],
  },
  // ─ Two-color ─────────────────────────────────────────────────────────────
  WU: {
    casual:    ["Brago, King Eternal", "Raff Capashen, Ship's Mage", "Kangee, Aerie Keeper"],
    focused:   ["Ephara, God of the Polis", "Isperia, Supreme Judge", "Lavinia, Azorius Renegade"],
    optimized: ["Hanna, Ship's Navigator", "Shorikai, Genesis Engine"],
    cedh:      ["Brago, King Eternal"],
  },
  WB: {
    casual:    ["Teysa, Orzhov Scion", "Kambal, Consul of Allocation", "Athreos, God of Passage"],
    focused:   ["Liesa, Shroud of Dusk", "Vito, Thorn of the Dusk Rose", "Karlov of the Ghost Council"],
    optimized: ["Edgar Markov", "Ayli, Eternal Pilgrim"],
    cedh:      ["Zur the Enchanter", "Daxos the Returned"],
  },
  WR: {
    casual:    ["Tajic, Legion's Edge", "Aurelia, the Warleader", "Iroas, God of Victory"],
    focused:   ["Winota, Joiner of Forces", "Firesong and Sunspeaker"],
    optimized: ["Feather, the Redeemed", "Zirda, the Dawnwaker"],
    cedh:      ["Winota, Joiner of Forces"],
  },
  WG: {
    casual:    ["Sythis, Harvest's Hand", "Karametra, God of Harvests", "Sigarda, Host of Herons"],
    focused:   ["Rhys the Redeemed", "Hamza, Guardian of Arashin", "Emmara, Soul of the Accord"],
    optimized: ["Selvala, Explorer Returned", "Lathiel, the Bounteous Dawn"],
    cedh:      ["Selvala, Explorer Returned"],
  },
  UB: {
    casual:    ["Yuriko, the Tiger's Shadow", "Lazav, Dimir Mastermind", "Wrexial, the Risen Deep"],
    focused:   ["Phenax, God of Deception", "Oona, Queen of the Fae", "Etrata, the Silencer"],
    optimized: ["Araumi of the Dead Tide", "Zareth San, the Trickster"],
    cedh:      ["Yuriko, the Tiger's Shadow", "Circu, Dimir Lobotomist"],
  },
  UR: {
    casual:    ["Niv-Mizzet, Parun", "Melek, Izzet Paragon", "Jori En, Ruin Diver"],
    focused:   ["Mizzix of the Izmagnus", "Keranos, God of Storms", "Saheeli, the Gifted"],
    optimized: ["Elsha of the Infinite", "Niv-Mizzet, Parun"],
    cedh:      ["Niv-Mizzet, Parun"],
  },
  UG: {
    casual:    ["Aesi, Tyrant of Gyre Strait", "Tatyova, Benthic Druid", "Edric, Spymaster of Trest"],
    focused:   ["Kruphix, God of Horizons", "Rashmi, Eternities Crafter", "Momir Vig, Simic Visionary"],
    optimized: ["Kinnan, Bonder Prodigy", "Vorel of the Hull Clade"],
    cedh:      ["Kinnan, Bonder Prodigy"],
  },
  BR: {
    casual:    ["Prosper, Tome-Bound", "Grenzo, Dungeon Warden", "Olivia Voldaren"],
    focused:   ["Mogis, God of Slaughter", "Judith, the Scourge Diva"],
    optimized: ["Kroxa, Titan of Death's Hunger", "Ob Nixilis of the Black Oath"],
    cedh:      ["Prosper, Tome-Bound"],
  },
  BG: {
    casual:    ["Meren of Clan Nel Toth", "Jarad, Golgari Lich Lord", "Savra, Queen of the Golgari"],
    focused:   ["Hapatra, Vizier of Poisons", "Izoni, Thousand-Eyed", "Skullbriar, the Walking Grave"],
    optimized: ["Mazirek, Kraul Death Priest", "Slimefoot, the Stowaway"],
    cedh:      ["Meren of Clan Nel Toth"],
  },
  RG: {
    casual:    ["Xenagos, God of Revels", "Wulfgar of Icewind Dale", "Klothys, God of Destiny"],
    focused:   ["Ruric Thar, the Unbowed", "Radha, Heart of Keld", "Rosheen Meanderer"],
    optimized: ["Atarka, World Render", "Borborygmos Enraged"],
    cedh:      ["Xenagos, God of Revels"],
  },
  // ─ Three-color ────────────────────────────────────────────────────────────
  WUB: {
    casual:    ["Alela, Artful Provocateur", "Oloro, Ageless Ascetic", "Zur the Enchanter"],
    focused:   ["Aminatou, the Fateshifter", "Yennett, Cryptic Sovereign"],
    optimized: ["Sen Triplets", "Zur the Enchanter"],
    cedh:      ["Zur the Enchanter", "Aminatou, the Fateshifter"],
  },
  WUR: {
    casual:    ["Narset, Enlightened Exile", "Kykar, Wind's Fury", "Ruhan of the Fomori"],
    focused:   ["Shu Yun, the Silent Tempest", "Elsha of the Infinite"],
    optimized: ["Narset, Enlightened Master", "Vadrik, Astral Archmage"],
    cedh:      ["Narset, Enlightened Master"],
  },
  WUG: {
    casual:    ["Chulane, Teller of Tales", "Tuvasa the Sunlit", "Roon of the Hidden Realm"],
    focused:   ["Jenara, Asura of War", "Rafiq of the Many"],
    optimized: ["Chulane, Teller of Tales", "Arcades, the Strategist"],
    cedh:      ["Chulane, Teller of Tales"],
  },
  WBR: {
    casual:    ["Edgar Markov", "Kaalia of the Vast", "Licia, Sanguine Tribune"],
    focused:   ["Alesha, Who Smiles at Death", "Tariel, Reckoner of Souls"],
    optimized: ["Kaalia of the Vast", "Oros, the Avenger"],
    cedh:      ["Kaalia of the Vast"],
  },
  WBG: {
    casual:    ["Tayam, Luminous Enigma", "Teysa Karlov", "Ghave, Guru of Spores"],
    focused:   ["Anafenza, the Foremost", "Doran, the Siege Tower"],
    optimized: ["Ghave, Guru of Spores", "Karador, Ghost Chieftain"],
    cedh:      ["Karador, Ghost Chieftain"],
  },
  WRG: {
    casual:    ["Pantlaza, Sun-Favored", "Marath, Will of the Wild", "Gahiji, Honored One"],
    focused:   ["Atla Palani, Nest Tender", "Mirri, Weatherlight Duelist"],
    optimized: ["Marath, Will of the Wild", "Samut, Voice of Dissent"],
    cedh:      ["Marath, Will of the Wild"],
  },
  UBR: {
    casual:    ["Marchesa, the Black Rose", "Jeleva, Nephalia's Scourge", "Kess, Dissident Mage"],
    focused:   ["Sedris, the Traitor King", "Yidris, Maelstrom Wielder"],
    optimized: ["Kess, Dissident Mage", "Nekusar, the Mindrazer"],
    cedh:      ["Kess, Dissident Mage"],
  },
  UBG: {
    casual:    ["The Wise Mothman", "Muldrotha, the Gravetide", "Tasigur, the Golden Fang"],
    focused:   ["Damia, Sage of Stone", "Sidisi, Brood Tyrant"],
    optimized: ["Muldrotha, the Gravetide", "The Gitrog Monster"],
    cedh:      ["The Gitrog Monster", "Tasigur, the Golden Fang"],
  },
  URG: {
    casual:    ["Kalamax, the Stormsire", "Animar, Soul of Elements", "Surrak Dragonclaw"],
    focused:   ["Riku of Two Reflections", "Intet, the Dreamer"],
    optimized: ["Animar, Soul of Elements", "Kalamax, the Stormsire"],
    cedh:      ["Animar, Soul of Elements"],
  },
  BRG: {
    casual:    ["Korvold, Fae-Cursed King", "Prossh, Skyraider of Kher", "Sek'Kuar, Deathkeeper"],
    focused:   ["Kresh the Bloodbraided", "Xira Arien"],
    optimized: ["Korvold, Fae-Cursed King", "Prossh, Skyraider of Kher"],
    cedh:      ["Korvold, Fae-Cursed King"],
  },
  // ─ Four-color ─────────────────────────────────────────────────────────────
  // WUBR (sans Green) — Breya is the canonical WUBR commander
  WUBR: {
    casual:    ["Breya, Etherium Shaper"],
    focused:   ["Breya, Etherium Shaper"],
    optimized: ["Breya, Etherium Shaper"],
    cedh:      ["Breya, Etherium Shaper"],
  },
  // WUBG (sans Red) — Atraxa is W/U/B/G
  WUBG: {
    casual:    ["Atraxa, Praetors' Voice"],
    focused:   ["Atraxa, Praetors' Voice"],
    optimized: ["Atraxa, Praetors' Voice"],
    cedh:      ["Atraxa, Praetors' Voice"],
  },
  // WURG (sans Black) — Kynaios and Tiro of Meletis is the canonical WURG commander
  WURG: {
    casual:    ["Kynaios and Tiro of Meletis"],
    focused:   ["Kynaios and Tiro of Meletis"],
    optimized: ["Kynaios and Tiro of Meletis"],
    cedh:      ["Kynaios and Tiro of Meletis"],
  },
  // WBRG (sans Blue) — Saskia is W/B/R/G
  WBRG: {
    casual:    ["Saskia the Unyielding"],
    focused:   ["Saskia the Unyielding"],
    optimized: ["Saskia the Unyielding"],
    cedh:      ["Saskia the Unyielding"],
  },
  // UBRG (sans White) — Yidris is U/B/R/G
  UBRG: {
    casual:    ["Yidris, Maelstrom Wielder"],
    focused:   ["Yidris, Maelstrom Wielder"],
    optimized: ["Yidris, Maelstrom Wielder"],
    cedh:      ["Yidris, Maelstrom Wielder"],
  },
  // ─ Five-color ─────────────────────────────────────────────────────────────
  WUBRG: {
    casual:    ["Kenrith, the Returned King", "Jodah, Archmage Eternal", "Progenitus"],
    focused:   ["Najeela, the Blade-Blossom", "Jodah, Archmage Eternal"],
    optimized: ["Najeela, the Blade-Blossom", "The Ur-Dragon"],
    cedh:      ["Najeela, the Blade-Blossom", "Kenrith, the Returned King"],
  },
};

const BASICS: Record<ManaColor, string> = {
  W: "Plains",
  U: "Island",
  B: "Swamp",
  R: "Mountain",
  G: "Forest",
};

// Universal staples guaranteed in any generated deck
const UNIVERSAL_STAPLES = ["Sol Ring", "Command Tower", "Arcane Signet"];

// ── Fallback spell pools ──────────────────────────────────────────────────────
// Used when EDHREC doesn't return enough non-land cards (e.g. network error,
// rare commander, or strict budget filter). These are real, legal Commander cards
// that are broadly useful regardless of strategy. They keep the deck from being
// padded with dozens of basic lands.

// Only truly colorless cards here — artifacts, colorless lands, and colorless
// creatures. Color-restricted staples live in COLOR_FALLBACK_SPELLS so they're
// never added to a deck whose commander doesn't share that color identity.
const UNIVERSAL_FALLBACK_SPELLS = [
  // Mana rocks / ramp
  "Wayfarer's Bauble", "Burnished Hart", "Mind Stone", "Thought Vessel",
  "Commander's Sphere", "Solemn Simulacrum", "Chromatic Lantern",
  "Fellwar Stone", "Darksteel Ingot",
  // Utility lands (colorless)
  "Reliquary Tower", "Myriad Landscape", "Evolving Wilds", "Terramorphic Expanse",
  // Card draw
  "Skullclamp", "Staff of Nin", "Lifecrafter's Bestiary",
  // Protection / equipment
  "Lightning Greaves", "Swiftfoot Boots",
  // Broadly useful colorless creatures
  "Ornithopter of Paradise", "Burnished Hart",
];

const COLOR_FALLBACK_SPELLS: Record<ManaColor, string[]> = {
  W: [
    "Swords to Plowshares", "Path to Exile", "Wrath of God", "Day of Judgment",
    "Return to Dust", "Austere Command", "Smothering Tithe", "Generous Gift",
    "Sun Titan", "Teferi's Protection", "Cathars' Crusade", "Mentor of the Meek",
  ],
  U: [
    "Counterspell", "Negate", "Swan Song", "Arcane Denial",
    "Ponder", "Preordain", "Brainstorm", "Fact or Fiction",
    "Rhystic Study", "Mystic Remora", "Cyclonic Rift",
    "Reality Shift", "Imprisoned in the Moon", "Bident of Thassa",
  ],
  B: [
    "Sign in Blood", "Night's Whisper", "Read the Bones",
    "Reanimate", "Animate Dead", "Feed the Swarm",
    "Shriekmaw", "Gray Merchant of Asphodel", "Phyrexian Arena",
    "Deadly Rollick", "Diabolic Intent", "Bolas's Citadel",
  ],
  R: [
    "Blasphemous Act", "Jeska's Will", "Deflecting Swat",
    "Vandalblast", "Faithless Looting", "Dualcaster Mage",
    "Dragon Tempest", "Chaos Warp", "Mizzium Mortars",
    "Goblin Bombardment", "Torbran, Thane of Red Fell",
  ],
  G: [
    "Kodama's Reach", "Cultivate", "Rampant Growth", "Farseek",
    "Nature's Lore", "Three Visits", "Llanowar Elves", "Elvish Mystic",
    "Birds of Paradise", "Beast Within", "Heroic Intervention",
    "Sylvan Library", "Eternal Witness", "Regrowth",
  ],
};

function colorKey(colors: ManaColor[]): string {
  return [...colors].sort().join("") || "UBG";
}

function pickFromPool(pool: TieredPool, powerLevel: PowerLevel): string {
  const tier = pool[powerLevel];
  const options = tier.length > 0 ? tier : pool.focused;
  return options[Math.floor(Math.random() * options.length)]!;
}

function resolveCommander(key: string, powerLevel: PowerLevel): string {
  const pool = COMMANDER_POOLS[key];
  if (pool) return pickFromPool(pool, powerLevel);
  // Unknown color combination — fall back to closest available or Kenrith
  return "Kenrith, the Returned King";
}

function deckArchetype(powerLevel: PowerLevel): DeckArchetype {
  switch (powerLevel) {
    case "cedh":
    case "optimized":
      return "combo";
    case "focused":
      return "midrange";
    case "casual":
    default:
      return "midrange";
  }
}

// Filter EDHREC cards to those affordable under the budget tier's per-card cap.
// Cards with null EDHREC price are included — EDHREC often lacks price data for
// affordable commons/uncommons. Their real prices are verified via Scryfall after
// import. Only cards EDHREC explicitly knows are over the cap are excluded.
function applyBudgetFilter(cards: EdhrecCard[], tier: BudgetTier): EdhrecCard[] {
  const cap = BUDGET_PRICE_CAPS[tier];
  if (cap === null) return cards; // cEDH: no limit
  return cards.filter((c) => c.price === null || c.price <= cap);
}

// Sort by: synergy score descending, then inclusion rate descending
function rankCards(cards: EdhrecCard[]): EdhrecCard[] {
  return [...cards].sort((a, b) => {
    const synergyDiff = b.synergy - a.synergy;
    if (Math.abs(synergyDiff) > 0.01) return synergyDiff;
    return b.inclusion - a.inclusion;
  });
}

function buildLandLines(colors: ManaColor[], landTarget: number): string[] {
  const basics = colors.map((c) => BASICS[c]);
  const perColor = Math.floor(landTarget / colors.length);
  const remainder = landTarget % colors.length;
  return basics.map((basic, i) => `${perColor + (i < remainder ? 1 : 0)} ${basic}`);
}

// Rough land targets per power tier — cEDH runs leaner, casual runs more basics
function landTarget(powerLevel: PowerLevel): number {
  switch (powerLevel) {
    case "cedh":      return 31;
    case "optimized": return 34;
    case "focused":   return 36;
    case "casual":
    default:          return 38;
  }
}

export type GeneratedSample = {
  name: string;
  commanderName: string;
  archetype: DeckArchetype;
  powerLevel: PowerLevel;
  budget: BudgetTier;
  colors: ManaColor[];
  decklist: string;
  source: "edhrec" | "fallback";
  totalEdhrecCards: number;
};

export async function generateCommanderSample({
  colors,
  commanderName,
  budget,
  powerLevel,
}: {
  colors: ManaColor[];
  commanderName?: string;
  budget: BudgetTier;
  powerLevel: PowerLevel;
}): Promise<GeneratedSample> {
  const pickedColors = colors.length ? colors : (["U", "B", "G"] as ManaColor[]);
  const key = colorKey(pickedColors);

  // If the user typed a specific commander, use it; otherwise pick randomly from
  // the power-level-appropriate pool for the chosen colors.
  const commander = commanderName?.trim() || resolveCommander(key, powerLevel);

  const targetLands = landTarget(powerLevel);   // e.g. 36 for focused
  const targetNonLandSpells = 99 - targetLands; // e.g. 63 for focused
  // We reserve ~10 slots for utility lands (non-basics from EDHREC) and fill the
  // rest with basics. This matches the structure of real Commander decklists.
  const targetUtilityLands = Math.min(10, Math.floor(targetLands * 0.28));

  // Fetch EDHREC recommendations
  let edhrecCards: EdhrecCard[] = [];
  let source: "edhrec" | "fallback" = "fallback";

  try {
    const res = await fetch(
      `/api/edhrec?commander=${encodeURIComponent(commander)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json() as { cards?: EdhrecCard[]; error?: string };
      if (Array.isArray(data.cards) && data.cards.length > 0) {
        edhrecCards = data.cards;
        source = "edhrec";
      }
    }
  } catch {
    // network error — fall through to fallback
  }

  const commanderLower = commander.toLowerCase();
  const BASIC_NAMES = new Set(["plains", "island", "swamp", "mountain", "forest"]);

  // ── Separate EDHREC recommendations into land cards and non-land spells ──
  const budgetFiltered = applyBudgetFilter(edhrecCards, budget);
  const ranked = rankCards(budgetFiltered);

  const edhrecLands = ranked.filter(
    (c) => c.is_land && !BASIC_NAMES.has(c.name.toLowerCase())
  );
  const edhrecSpells = ranked.filter(
    (c) =>
      !c.is_land &&
      !BASIC_NAMES.has(c.name.toLowerCase()) &&
      c.name.toLowerCase() !== commanderLower
  );

  // ── Build the non-land spell list ────────────────────────────────────────
  const cap = BUDGET_PRICE_CAPS[budget];
  const universalAllowed = UNIVERSAL_STAPLES.filter(
    (s) => s.toLowerCase() !== commanderLower
  ).filter((s) => {
    if (cap === null) return true;
    const match = edhrecCards.find((c) => c.name.toLowerCase() === s.toLowerCase());
    if (!match) return true; // no EDHREC price data → include anyway
    return match.price === null || match.price <= cap;
  });

  const picked = new Set(universalAllowed.map((s) => s.toLowerCase()));
  const spellNames: string[] = [...universalAllowed];

  for (const card of edhrecSpells) {
    if (spellNames.length >= targetNonLandSpells) break;
    if (picked.has(card.name.toLowerCase())) continue;
    picked.add(card.name.toLowerCase());
    spellNames.push(card.name);
  }

  // If EDHREC didn't provide enough non-land spells, pad with curated fallback
  // staples so the deck is playable — not flooded with basics.
  if (spellNames.length < targetNonLandSpells) {
    const fallbackPool = [
      ...UNIVERSAL_FALLBACK_SPELLS,
      ...pickedColors.flatMap((c) => COLOR_FALLBACK_SPELLS[c] ?? []),
    ];
    for (const card of fallbackPool) {
      if (spellNames.length >= targetNonLandSpells) break;
      const lower = card.toLowerCase();
      if (lower === commanderLower || picked.has(lower)) continue;
      picked.add(lower);
      spellNames.push(card);
    }
  }

  const spellLines = spellNames.map((n) => `1 ${n}`);

  // ── Build the land list (utility + basics) ───────────────────────────────
  const utilityLandNames: string[] = [];
  const pickedLands = new Set<string>();
  for (const card of edhrecLands) {
    if (utilityLandNames.length >= targetUtilityLands) break;
    if (pickedLands.has(card.name.toLowerCase())) continue;
    pickedLands.add(card.name.toLowerCase());
    utilityLandNames.push(card.name);
  }

  // Compute how many basics are needed so total equals exactly 100
  const basicCount = 99 - spellLines.length - utilityLandNames.length;
  const basicLandLines = buildLandLines(pickedColors, Math.max(0, basicCount));
  const utilityLandLines = utilityLandNames.map((n) => `1 ${n}`);

  const decklist = [
    `1 ${commander}`,
    ...spellLines,
    ...utilityLandLines,
    ...basicLandLines,
  ].join("\n");

  return {
    name: `${commander} – ${budget} / ${powerLevel}`,
    commanderName: commander,
    archetype: deckArchetype(powerLevel),
    powerLevel,
    budget,
    colors: pickedColors,
    decklist,
    source,
    totalEdhrecCards: edhrecCards.length,
  };
}

/**
 * Picks a random popular commander from the built-in pools and builds a full
 * 100-card deck using live EDHREC recommendations. Call this for the "explore
 * a random deck" button so users always get fresh variety without hardcoded lists.
 */
export async function generateRandomSampleDeck(): Promise<GeneratedSample> {
  const allKeys = Object.keys(COMMANDER_POOLS);
  const key = allKeys[Math.floor(Math.random() * allKeys.length)]!;
  const pool = COMMANDER_POOLS[key]!;

  // Weight toward focused/optimized — more interesting card selections
  const powerLevelOptions: PowerLevel[] = ["casual", "focused", "focused", "optimized"];
  const powerLevel = powerLevelOptions[Math.floor(Math.random() * powerLevelOptions.length)]!;
  const commander = pickFromPool(pool, powerLevel);

  // Derive color array from the pool key (e.g. "UBG" → ["U","B","G"])
  const ALL_COLORS = new Set<string>(["W", "U", "B", "R", "G"]);
  const colors = key.split("").filter((c) => ALL_COLORS.has(c)) as ManaColor[];

  // Use "upgraded" as a sensible default budget — covers most popular staples
  const budget: BudgetTier = "upgraded";

  return generateCommanderSample({ colors, commanderName: commander, budget, powerLevel });
}
