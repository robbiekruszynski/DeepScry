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
    optimized: ["Urza, Lord High Artificer", "Malcolm, Keen-Eyed Navigator", "Sai, Master Thopterist"],
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
    optimized: ["Daretti, Scrap Savant", "Valduk, Keeper of the Flame", "Laelia, the Blade Reforged"],
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
    casual:    ["Brago, King Eternal", "Raff Capashen, Ship's Mage", "Soulherder"],
    focused:   ["Ephara, God of the Polis", "Isperia, Supreme Judge", "Lavinia, Azorius Renegade"],
    optimized: ["Yorion, Sky Nomad", "Hanna, Ship's Navigator"],
    cedh:      ["Brago, King Eternal", "Raff Capashen, Ship's Mage"],
  },
  WB: {
    casual:    ["Teysa, Orzhov Scion", "Kambal, Consul of Allocation", "Athreos, God of Passage"],
    focused:   ["Liesa, Shroud of Dusk", "Vito, Thorn of the Dusk Rose", "Karlov of the Ghost Council"],
    optimized: ["Edgar Markov", "Ayli, Eternal Pilgrim"],
    cedh:      ["Zur the Enchanter", "Daxos the Returned"],
  },
  WR: {
    casual:    ["Tajic, Legion's Edge", "Aurelia, the Warleader", "Iroas, God of Victory"],
    focused:   ["Winota, Joiner of Forces", "Razia, Boros Archangel", "Firesong and Sunspeaker"],
    optimized: ["Feather, the Redeemed", "Zirda, the Dawnwaker"],
    cedh:      ["Winota, Joiner of Forces"],
  },
  WG: {
    casual:    ["Sythis, Harvest's Hand", "Karametra, God of Harvests", "Sigarda, Host of Herons"],
    focused:   ["Rhys the Redeemed", "Hamza, Guardian of Arashin", "Emmara, Soul of the Accord"],
    optimized: ["Selvala, Explorer Returned", "Aura Shards"],
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
    optimized: ["Izzet Guildmage", "Elsha of the Infinite"],
    cedh:      ["Niv-Mizzet, Parun", "Thrasios, Triton Hero"],
  },
  UG: {
    casual:    ["Aesi, Tyrant of Gyre Strait", "Tatyova, Benthic Druid", "Edric, Spymaster of Trest"],
    focused:   ["Kruphix, God of Horizons", "Rashmi, Eternities Crafter", "Momir Vig, Simic Visionary"],
    optimized: ["Kinnan, Bonder Prodigy", "Vorel of the Hull Clade"],
    cedh:      ["Kinnan, Bonder Prodigy", "Thrasios, Triton Hero"],
  },
  BR: {
    casual:    ["Prosper, Tome-Bound", "Grenzo, Dungeon Warden", "Olivia Voldaren"],
    focused:   ["Daretti, Scrap Savant", "Mogis, God of Slaughter", "Judith, the Scourge Diva"],
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
    focused:   ["Abzan Falconer", "Doran, the Siege Tower"],
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
    focused:   ["Grixis Grimblade", "Yidris, Maelstrom Wielder"],
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
    focused:   ["Jund Charm", "Xira Arien"],
    optimized: ["Korvold, Fae-Cursed King", "Prossh, Skyraider of Kher"],
    cedh:      ["Korvold, Fae-Cursed King"],
  },
  // ─ Four-color ─────────────────────────────────────────────────────────────
  WUBR: {
    casual:    ["Atraxa, Praetors' Voice", "Yidris, Maelstrom Wielder"],
    focused:   ["Breya, Etherium Shaper", "Yidris, Maelstrom Wielder"],
    optimized: ["Breya, Etherium Shaper"],
    cedh:      ["Breya, Etherium Shaper"],
  },
  WUBG: {
    casual:    ["Atraxa, Praetors' Voice", "Thrasios, Triton Hero"],
    focused:   ["Atraxa, Praetors' Voice"],
    optimized: ["Atraxa, Praetors' Voice"],
    cedh:      ["Thrasios, Triton Hero"],
  },
  WURG: {
    casual:    ["Atraxa, Praetors' Voice", "Yidris, Maelstrom Wielder"],
    focused:   ["Atraxa, Praetors' Voice"],
    optimized: ["Atraxa, Praetors' Voice"],
    cedh:      ["Yidris, Maelstrom Wielder"],
  },
  WBRG: {
    casual:    ["Saskia the Unyielding", "Yidris, Maelstrom Wielder"],
    focused:   ["Saskia the Unyielding"],
    optimized: ["Saskia the Unyielding"],
    cedh:      ["Saskia the Unyielding"],
  },
  UBRG: {
    casual:    ["Yidris, Maelstrom Wielder", "The Ur-Dragon"],
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

  const lands = landTarget(powerLevel);
  const spellTarget = 99 - lands; // non-commander, non-land spell slots

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

  let spellLines: string[];

  if (source === "edhrec" && edhrecCards.length > 0) {
    const budgetFiltered = applyBudgetFilter(edhrecCards, budget);
    const ranked = rankCards(budgetFiltered);

    // Exclude basic lands and the commander itself from the spell pool
    const commanderLower = commander.toLowerCase();
    const BASIC_NAMES = new Set(["plains", "island", "swamp", "mountain", "forest"]);
    const nonLandSpells = ranked.filter(
      (c) =>
        !BASIC_NAMES.has(c.name.toLowerCase()) &&
        c.name.toLowerCase() !== commanderLower
    );

    // Always include universal staples that fit the budget, then fill with EDHREC picks
    const cap = BUDGET_PRICE_CAPS[budget];
    const universalAllowed = UNIVERSAL_STAPLES.filter(
      (s) => s.toLowerCase() !== commanderLower
    ).filter((s) => {
      if (cap === null) return true;
      const match = edhrecCards.find((c) => c.name.toLowerCase() === s.toLowerCase());
      if (!match) return true; // no EDHREC price data → include staples anyway
      return match.price === null || match.price <= cap;
    });

    const picked = new Set(universalAllowed.map((s) => s.toLowerCase()));
    const spellNames: string[] = [...universalAllowed];

    for (const card of nonLandSpells) {
      if (spellNames.length >= spellTarget) break;
      if (picked.has(card.name.toLowerCase())) continue;
      picked.add(card.name.toLowerCase());
      spellNames.push(card.name);
    }

    spellLines = spellNames.map((n) => `1 ${n}`);
  } else {
    // Fallback: at least include universal staples so something loads
    spellLines = UNIVERSAL_STAPLES
      .filter((s) => s.toLowerCase() !== commander.toLowerCase())
      .map((n) => `1 ${n}`);
  }

  const landLines = buildLandLines(pickedColors, lands);

  const decklist = [
    `1 ${commander}`,
    ...spellLines,
    ...landLines,
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
