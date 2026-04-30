import {
  buildEntries,
  parseDecklist,
  type Deck,
  type DeckArchetype,
} from "@/lib/deck";
import { resolveNamesForDeckImport, type ImportProgress, type ScryfallCard } from "@/lib/scryfall";

export type DeckImportResult = {
  deck: Deck | null;
  errors: string[];
};

export async function importDecklist({
  text,
  commanderName,
  archetype,
  onProgress,
}: {
  text: string;
  commanderName: string;
  archetype: DeckArchetype;
  onProgress?: (progress: ImportProgress) => void;
}): Promise<DeckImportResult> {
  const parsed = parseDecklist(text);
  if (parsed.errors.length) return { deck: null, errors: parsed.errors };

  const commanderInput = commanderName.trim();
  const namesToResolve = parsed.lines.map((l) => l.name);
  if (commanderInput) namesToResolve.push(commanderInput);

  const uniqueNames = Array.from(new Set(namesToResolve));
  onProgress?.({ done: 0, total: uniqueNames.length, detail: "Starting..." });

  const cardsByRequestedName = new Map<string, ScryfallCard>();
  const resolved = await resolveNamesForDeckImport(uniqueNames, onProgress);
  for (const name of uniqueNames) {
    const card = resolved.get(name);
    if (card) cardsByRequestedName.set(name, card);
  }

  const { entries, missingNames } = buildEntries(cardsByRequestedName, parsed.lines);
  if (missingNames.length) {
    return {
      deck: null,
      errors: [
        `Could not match ${missingNames.length} card name(s) after fetch: ${missingNames.slice(0, 8).join(", ")}${missingNames.length > 8 ? "..." : ""}`,
      ],
    };
  }
  if (entries.length === 0 && parsed.lines.length > 0) {
    return {
      deck: null,
      errors: ["Deck resolved to zero cards. Check the decklist format and try again."],
    };
  }

  if (commanderInput) {
    const commanderCard = cardsByRequestedName.get(commanderInput);
    if (!commanderCard) {
      return {
        deck: null,
        errors: [`Could not resolve commander: ${commanderInput}`],
      };
    }

    const alreadyInDeck = entries.some((e) => e.card.id === commanderCard.id);
    if (!alreadyInDeck) {
      entries.push({ card: commanderCard, count: 1 });
      entries.sort((a, b) => a.card.name.localeCompare(b.card.name));
    }
  }

  return {
    deck: {
      entries,
      commanderName: commanderInput || undefined,
      archetype,
    },
    errors: [],
  };
}
