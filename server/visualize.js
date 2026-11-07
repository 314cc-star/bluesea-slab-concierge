// "See it in your room": Gemini image editing places the chosen slab, as a
// finished table, into the customer's own room photo.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate } from './concierge.js';

const PHOTOS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'photos');

const IMAGE_MODELS = [
  ...new Set([
    process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-lite-image',
  ]),
];

// Image generation costs money, so cap it: per visitor per hour, and per day overall.
const DAILY_LIMIT = Number(process.env.VISUALIZE_DAILY_LIMIT || 60);
const PER_VISITOR_HOURLY = 6;
let day = { date: '', count: 0 };
const visitors = new Map();

export function checkLimit(visitorId) {
  const today = new Date().toISOString().slice(0, 10);
  if (day.date !== today) day = { date: today, count: 0 };
  if (day.count >= DAILY_LIMIT) return 'Room previews are used up for today. Please try again tomorrow.';
  const hourAgo = Date.now() - 3_600_000;
  const recent = (visitors.get(visitorId) || []).filter((t) => t > hourAgo);
  if (recent.length >= PER_VISITOR_HOURLY) return 'You have made several previews already. Please try again in an hour.';
  recent.push(Date.now());
  visitors.set(visitorId, recent);
  day.count += 1;
  return null;
}

const useFor = (slab) =>
  slab.edge === 'round' || slab.length_cm < 140 ? 'a low coffee table' : slab.width_cm <= 70 ? 'a desk or console table' : 'a dining table';

const LEG_TEXT = {
  steel: 'simple matte black steel legs',
  wood: 'solid wood legs made from the same wood',
  none: 'simple matte black steel legs',
};
const FINISH_TEXT = {
  lacquer: 'smooth matte lacquer that deepens the colour and shows the grain',
  polyurethane: 'durable satin polyurethane that deepens the colour slightly',
  teak_oil: 'natural matte oiled finish',
  natural_oil: 'natural matte oiled finish',
  ultra_matte: 'ultra-matte raw natural finish that keeps the wood light and unshiny',
};

function prompt(slab, hasSlabPhoto, choice = {}) {
  const look = hasSlabPhoto
    ? 'Use the exact wood from the second image: same colour, grain pattern, knots and edge shape.'
    : `The wood is solid Suar (Monkey Pod): ${slab.tone}; ${slab.figure}.`;
  return `The first image is a photo of a customer's room. Edit it to show one new piece of furniture: ${useFor(slab)} made from a single solid wood slab, placed where such a table naturally belongs in this room.
Tabletop: ${slab.width_cm} cm wide, ${slab.length_cm} cm long, ${slab.thickness_cm} cm thick, ${slab.edge}. Keep its size realistic relative to the room and any people or furniture in it.
${look}
The photo of the slab shows raw sawn wood; show it finished: sanded smooth with a ${FINISH_TEXT[choice.finish] || FINISH_TEXT.lacquer}. Legs: ${LEG_TEXT[choice.legs] || LEG_TEXT.none}.
Keep everything else in the room exactly as it is: walls, floor, light, camera angle and other furniture. Photorealistic, natural shadows. No text or logos.`;
}

export async function visualize({ roomBase64, roomMime, slab, choice }) {
  const parts = [{ inlineData: { mimeType: roomMime, data: roomBase64 } }];
  let hasSlabPhoto = false;
  if (slab.photo?.startsWith('/photos/')) {
    try {
      const file = await readFile(path.join(PHOTOS, path.basename(slab.photo)));
      parts.push({ inlineData: { mimeType: slab.photo.endsWith('.png') ? 'image/png' : 'image/jpeg', data: file.toString('base64') } });
      hasSlabPhoto = true;
    } catch {
      /* photo missing on disk: fall back to the written description */
    }
  }
  parts.push({ text: prompt(slab, hasSlabPhoto, choice) });

  const content = await generate(
    { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } },
    { models: IMAGE_MODELS, timeoutMs: 90_000 },
  );
  const image = content.parts.find((p) => p.inlineData?.data);
  if (!image) throw new Error('The image model returned no picture');
  return `data:${image.inlineData.mimeType || 'image/png'};base64,${image.inlineData.data}`;
}
