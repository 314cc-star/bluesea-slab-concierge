// Photo-to-listing: Gemini looks at a slab photo and writes the shop copy
// in English, ready for the website, marketplaces and Instagram.
import { generate } from './concierge.js';

const schema = {
  type: 'object',
  properties: {
    tone: { type: 'string', description: 'Colour of the wood in a few words, e.g. "golden heartwood with dark streaks"' },
    figure: { type: 'string', description: 'Grain and edge character in one short phrase' },
    best_for: { type: 'array', items: { type: 'string' }, description: '2-3 uses that suit this size, e.g. "dining table 6 seats"' },
    title_en: { type: 'string' },
    description_en: { type: 'string' },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
  required: ['tone', 'figure', 'best_for', 'title_en', 'description_en', 'hashtags'],
};

const prompt = ({ width_cm, length_cm, thickness_cm, edge, price_thb }) => `You write product listings for Blue Sea Wood, a wood-slab maker in Phrae, Thailand.
This photo shows one real solid Suar (Monkey Pod / Rain Tree) slab.
Owner's measurements: ${width_cm} x ${length_cm} x ${thickness_cm} cm (W x L x T), ${edge}${price_thb ? `, price ${price_thb} THB` : ''}.

Describe only what you can see in the photo (colour, grain, edge, knots, cracks) plus the facts above. Do not invent defects or features you cannot see.
Every Blue Sea Wood slab is one solid piece (no joins), kiln-dried, sanded and finished; legs are sold separately. If you see a natural crack, mention that it will be stabilised with hand-fitted wooden bow ties. Every table has free delivery in Thailand and a lifetime free repair warranty.
Write everything in English.
- title_en: a short marketplace title (under 90 characters) with size in cm.
- description_en: 3-5 short lines, warm and honest, including size, what it suits, and "one solid piece, kiln-dried".
- hashtags: 6-8 English hashtags for Instagram, each starting with #.`;

export async function writeListing({ imageBase64, mimeType, details }) {
  const content = await generate({
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType, data: imageBase64 } }, { text: prompt(details) }],
      },
    ],
    generationConfig: {
      temperature: 0.5,
      responseMimeType: 'application/json',
      responseSchema: schema,
      thinkingConfig: { thinkingLevel: 'low' },
    },
  });
  const text = content.parts.map((p) => p.text || '').join('');
  return JSON.parse(text);
}
