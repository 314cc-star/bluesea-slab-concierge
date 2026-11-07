// Tiny JSON-file store: good enough for a hackathon demo, swap for a DB later.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const SLABS = path.join(DATA_DIR, 'slabs.json');
const ORDERS = path.join(DATA_DIR, 'orders.json');

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(file, value) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

// Serialise writes so two captures can't interleave.
let queue = Promise.resolve();
const locked = (fn) => (queue = queue.then(fn, fn));

export const listSlabs = () => readJson(SLABS, []);

export async function getSlab(id) {
  return (await listSlabs()).find((s) => s.id === id) ?? null;
}

export const setSlabStatus = (id, status) =>
  locked(async () => {
    const slabs = await listSlabs();
    const slab = slabs.find((s) => s.id === id);
    if (!slab) throw new Error(`Unknown slab ${id}`);
    slab.status = status;
    if (status === 'reserved') slab.reservedAt = new Date().toISOString();
    else delete slab.reservedAt;
    await writeJson(SLABS, slabs);
    return slab;
  });

// Demo mode: put slabs back on sale some time after a test reservation, so
// every visitor (and every judge) finds a full shop. Returns released IDs.
export const releaseReservationsOlderThan = (ms) =>
  locked(async () => {
    const slabs = await listSlabs();
    const cutoff = Date.now() - ms;
    const released = slabs.filter((s) => s.status === 'reserved' && s.reservedAt && Date.parse(s.reservedAt) < cutoff);
    if (!released.length) return [];
    for (const s of released) {
      s.status = 'available';
      delete s.reservedAt;
    }
    await writeJson(SLABS, slabs);
    return released.map((s) => s.id);
  });

// Owner edits from the dashboard: only these fields may change.
const EDITABLE = { price_thb: 'number', status: ['available', 'reserved', 'sold'], tone: 'string', figure: 'string' };

export const updateSlab = (id, patch) =>
  locked(async () => {
    const slabs = await listSlabs();
    const slab = slabs.find((s) => s.id === id);
    if (!slab) throw Object.assign(new Error(`Unknown slab ${id}`), { status: 404 });
    for (const [key, value] of Object.entries(patch)) {
      const rule = EDITABLE[key];
      const ok =
        (rule === 'number' && Number.isFinite(value) && value > 0) ||
        (rule === 'string' && typeof value === 'string' && value.length <= 300) ||
        (Array.isArray(rule) && rule.includes(value));
      if (!ok) throw Object.assign(new Error(`Invalid value for ${key}`), { status: 400 });
      slab[key] = value;
    }
    await writeJson(SLABS, slabs);
    return slab;
  });

// New slab from the owner desk; the photo is saved next to the data.
export const addSlab = (fields, photo) =>
  locked(async () => {
    const slabs = await listSlabs();
    const nums = slabs.map((s) => Number(s.id.replace(/\D/g, ''))).filter(Number.isFinite);
    const id = `BSW-${Math.max(2400, ...nums) + 1}`;
    let photoUrl = null;
    if (photo) {
      const dir = path.join(DATA_DIR, 'photos');
      await mkdir(dir, { recursive: true });
      const file = `${id}.${photo.ext}`;
      await writeFile(path.join(dir, file), photo.buffer);
      photoUrl = `/photos/${file}`;
    }
    const slab = { id, species: 'Suar (Monkey Pod)', ...fields, status: 'available', photo: photoUrl };
    slabs.push(slab);
    await writeJson(SLABS, slabs);
    return slab;
  });

export const listOrders = () => readJson(ORDERS, []);

export const updateOrder = (id, patch) =>
  locked(async () => {
    const orders = await listOrders();
    const order = orders.find((o) => o.id === id);
    if (!order) throw Object.assign(new Error(`Unknown order ${id}`), { status: 404 });
    Object.assign(order, patch);
    await writeJson(ORDERS, orders);
    return order;
  });

export const addOrder = (order) =>
  locked(async () => {
    const orders = await listOrders();
    orders.push(order);
    await writeJson(ORDERS, orders);
    return order;
  });
