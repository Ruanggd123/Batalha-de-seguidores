import { MIN_PLAYERS_FOR_MAX_SIZE, MAX_PLAYERS_FOR_MIN_SIZE, MIN_PLAYER_SIZE, MAX_PLAYER_SIZE } from '../constants/gameConfig';
import { DEFAULT_AVATAR } from '../constants/assets';

// Helper to convert HSL to RGB for optimized rendering
// h in [0, 360], s in [0, 1], l in [0, 1] -> {r, g, b} in [0, 255]
export const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;
    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h / 360 + 1 / 3);
        g = hue2rgb(p, q, h / 360);
        b = hue2rgb(p, q, h / 360 - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const colorCache = new Map<number, {r: number, g: number, b: number}>();

export const getRgbColorFromId = (id: number) => {
    if (colorCache.has(id)) {
        return colorCache.get(id)!;
    }
    const hue = (id * 137.508) % 360; // Use golden angle approximation
    const color = hslToRgb(hue, 0.8, 0.6);
    colorCache.set(id, color);
    return color;
};

// Helper function to determine player size with dynamic scaling
export const getPlayerSize = (count: number, arenaWidth: number = 1920): number => {
    // Dynamic Max Size based on screen width
    // For mobile (e.g. 360px), max size should be around 50px-60px
    const responsiveMaxSize = Math.min(MAX_PLAYER_SIZE, Math.max(40, arenaWidth / 8));
    
    if (count <= MIN_PLAYERS_FOR_MAX_SIZE) {
        return responsiveMaxSize;
    }
    if (count >= MAX_PLAYERS_FOR_MIN_SIZE) {
        return MIN_PLAYER_SIZE;
    }

    const playerCountRange = MAX_PLAYERS_FOR_MIN_SIZE - MIN_PLAYERS_FOR_MAX_SIZE;
    const sizeRange = responsiveMaxSize - MIN_PLAYER_SIZE; 
    
    // Growth only starts when count drops below 2500
    if (count > MAX_PLAYERS_FOR_MIN_SIZE) {
        return MIN_PLAYER_SIZE; // Constant tiny dots for 50,000 down to 2,500
    }

    const progress = Math.min(1, Math.max(0, (MAX_PLAYERS_FOR_MIN_SIZE - count) / playerCountRange));
    
    // Use an aggressive power curve to keep players small for a long time
    const curveProgress = progress ** 8; 
    return Math.round(MIN_PLAYER_SIZE + curveProgress * sizeRange);
};

const hslCache = new Map<number, string>();

// Helper function to generate a color from an ID - CACHED for performance
export const getColorFromId = (id: number): string => {
    if (hslCache.has(id)) return hslCache.get(id)!;
    const hue = (id * 137.508) % 360; // Use golden angle approximation
    const color = `hsl(${hue}, 80%, 60%)`;
    hslCache.set(id, color);
    return color;
};

/**
 * Converts any image URL into a reliable, CORS-safe URL and manages avatar priority.
 * 
 * TIERED PROXYING:
 * 1. Priority (Winner, Followed) -> unavatar.io (high quality, reliable username lookup)
 * 2. Mass Followers -> weserv.nl (high speed, no 429 limits for direct CDN URLs)
 * 3. Fallback -> DiceBear (Pixel Art)
 */
export const getSafeImageUrl = (url: string, username?: string, isPriority: boolean = false): string => {
    if (!url) {
        return username ? getDiceBearUrl(username.replace(/^@/, '').trim()) : DEFAULT_AVATAR;
    }

    // Fast path: known safe URLs (DiceBear, UI-Avatars, wsrv)
    if (!url.startsWith('http')) return url;
    if (url.includes('dicebear.com')) return url;
    if (url.includes('ui-avatars.com')) return url;
    if (url.includes('wsrv.nl')) return url;

    const cleanName = username?.replace(/^@/, '').trim() || 'default';

    // Instagram/Facebook CDN URLs: use wsrv.nl for mass loading, unavatar for priority
    if (url.includes('instagram.') || url.includes('fbcdn.net') || url.includes('cdninstagram.com')) {
        if (isPriority) return getUnavatarUrl(cleanName);
        
        // Use wsrv.nl for direct CDN URLs to bypass 429/CORS on high volume
        // We use &errorredirect to handle expired URLs gracefully
        const fallback = encodeURIComponent(getDiceBearUrl(cleanName));
        return `https://wsrv.nl/?url=${encodeURIComponent(url)}&default=${fallback}&errorredirect=${fallback}`;
    }

    // Username-only case (no URL): use tiered unavatar/dicebear logic
    if (username && !url.startsWith('http')) {
        return isPriority ? getUnavatarUrl(cleanName) : getDiceBearUrl(cleanName);
    }

    // Non-Instagram URLs: proxy them anyway to avoid CORS issues
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&default=${encodeURIComponent(getDiceBearUrl(cleanName))}`;
};


/**
 * Specifically for the "Followed Player" or Winner, where we REALLY want 
 * to try and get their real photo.
 */
export const getUnavatarUrl = (username: string): string => {
    if (!username) return '';
    const cleanName = username.replace(/^@/, '').trim();
    const dbFallback = encodeURIComponent(getDiceBearUrl(cleanName));
    return `https://unavatar.io/instagram/${cleanName}?fallback=${dbFallback}`;
};

// Fallback using server-side Pixel Art fallback
export const getFallbackImageUrl = (username: string): string => {
    if (!username) return '';
    return getDiceBearUrl(username.replace(/^@/, '').trim());
};

/**
 * Generates a reliable, unique pixel-art avatar based on a seed.
 * DiceBear is very robust and handles CORS properly.
 */
export const getDiceBearUrl = (seed: string): string => {
    return `https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed)}`;
};

/**
 * Returns true only if the image is fully decoded AND not in the "broken" state.
 * A broken image has complete=true but naturalWidth=0.
 */
export const isImageUsable = (img: HTMLImageElement): boolean => {
    return img.complete && img.naturalWidth > 0;
};
