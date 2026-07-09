export interface ChunkOptions {
  size?: number;
  overlap?: number;
}

export const DEFAULT_CHUNK_SIZE = 1200;
export const DEFAULT_CHUNK_OVERLAP = 150;

function splitIntoSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Splits text into chunks for embedding, preferring paragraph and sentence
 * boundaries over hard cuts, and carrying a trailing overlap into the next
 * chunk so context isn't lost right at a boundary.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const size = options.size ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(
    options.overlap ?? DEFAULT_CHUNK_OVERLAP,
    Math.floor(size / 2),
  );
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= size) return [trimmed];

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const units = (paragraphs.length > 0 ? paragraphs : [trimmed]).flatMap(
    splitIntoSentences,
  );

  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
  };

  for (const unit of units) {
    if (unit.length > size) {
      // A single sentence/paragraph longer than the chunk size — hard-split it.
      flush();
      current = '';
      for (let i = 0; i < unit.length; i += size - overlap) {
        chunks.push(unit.slice(i, i + size).trim());
      }
      continue;
    }

    const candidate = current ? `${current} ${unit}` : unit;
    if (candidate.length > size) {
      flush();
      const tail = current.slice(-overlap).trim();
      current = tail ? `${tail} ${unit}` : unit;
    } else {
      current = candidate;
    }
  }
  flush();

  return chunks.filter((c) => c.length > 10);
}
