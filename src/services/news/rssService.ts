// Minimal RSS 2.0 / Atom parser — avoids pulling in a full XML parser
// dependency for what is otherwise a small, well-known document shape.

export interface FeedItem {
  title: string;
  link: string;
  pubDate: string | null;
  description: string | null;
  imageUrl: string | null;
}

function decodeEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&(?:#39|apos);/g, "'")
    .trim();
}

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, '').trim();
}

function extractTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i').exec(block);
  return match ? decodeEntities(match[1]) : null;
}

function extractLink(block: string): string {
  const rssLink = extractTag(block, 'link');
  if (rssLink) return rssLink;
  const atomHref = /<link\b[^>]*href="([^"]+)"/i.exec(block);
  return atomHref ? atomHref[1] : '';
}

/** Best-effort cover image: enclosure/media tags first, then the first `<img>` inside the description/content HTML. */
function extractImage(block: string, rawDescription: string | null): string | null {
  const enclosure = /<enclosure\b[^>]*url="([^"]+)"[^>]*type="image\/[^"]*"/i.exec(block)
    ?? /<enclosure\b[^>]*type="image\/[^"]*"[^>]*url="([^"]+)"/i.exec(block);
  if (enclosure) return enclosure[1];

  const media = /<media:(?:content|thumbnail)\b[^>]*url="([^"]+)"/i.exec(block);
  if (media) return media[1];

  if (rawDescription) {
    const img = /<img\b[^>]*src="([^"]+)"/i.exec(rawDescription);
    if (img) return img[1];
  }

  return null;
}

/** Parses raw RSS/Atom XML text into a flat list of feed items. */
export function parseFeed(xml: string): FeedItem[] {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi) ?? [];

  return blocks
    .map((block): FeedItem => {
      const rawDescription = extractTag(block, 'description') ?? extractTag(block, 'summary') ?? extractTag(block, 'content');
      return {
        title: extractTag(block, 'title') ?? 'Sem título',
        link: extractLink(block),
        pubDate: extractTag(block, 'pubDate') ?? extractTag(block, 'published') ?? extractTag(block, 'updated'),
        description: rawDescription ? stripHtml(rawDescription) : null,
        imageUrl: extractImage(block, rawDescription),
      };
    })
    .filter((item) => item.link);
}

export async function fetchFeedItems(feedUrl: string): Promise<FeedItem[]> {
  const response = await fetch(feedUrl);
  if (!response.ok) throw new Error(`Falha ao buscar feed (${response.status})`);
  const xml = await response.text();
  return parseFeed(xml);
}
