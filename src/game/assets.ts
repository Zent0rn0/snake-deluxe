const cache = new Map<string, HTMLImageElement | HTMLCanvasElement>();
const loading = new Map<string, Promise<void>>();

export const emojiUrl = (name: string) => `${import.meta.env.BASE_URL}emoji/${name}.png`;

function load(name: string): Promise<void> {
  if (loading.has(name)) return loading.get(name)!;
  const p = new Promise<void>((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      cache.set(name, img);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = emojiUrl(name);
  });
  loading.set(name, p);
  return p;
}

/** Returns the image if it is ready, otherwise starts loading it and returns null. */
export function sprite(name: string): HTMLImageElement | HTMLCanvasElement | null {
  const hit = cache.get(name);
  if (hit) return hit;
  if (name === 'golden') {
    const base = cache.get('apple');
    if (base) {
      const c = document.createElement('canvas');
      c.width = base.width;
      c.height = base.height;
      const g = c.getContext('2d')!;
      g.drawImage(base, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(255, 196, 0, 0.62)';
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.18;
      g.drawImage(base, 0, 0);
      cache.set('golden', c);
      return c;
    }
    void load('apple');
    return null;
  }
  void load(name);
  return null;
}

export function preload(names: string[]): Promise<void> {
  return Promise.all(names.map(load)).then(() => undefined);
}
