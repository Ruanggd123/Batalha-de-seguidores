import { MIN_PLAYERS_FOR_MAX_SIZE, MAX_PLAYERS_FOR_MIN_SIZE, MIN_PLAYER_SIZE, MAX_PLAYER_SIZE } from '../constants/gameConfig';

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
    
    // Use an ease-in-quad curve for smoother growth (stays small longer)
    const curveProgress = progress * progress; 
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

// Helper function to safely load external images (bypasses CORS and CORP issues from Instagram)
export const getSafeImageUrl = (url: string): string => {
    if (!url || !url.startsWith('http')) return url;
    
    // Check if it's already proxied
    if (url.includes('wsrv.nl') || url.includes('weserv.nl')) return url;

    // Use wsrv.nl to proxy, resize, and add proper CORS headers to the images
    // Note: Use &n=-1 to disable some processing, &w and &h for performance
    // Some Instagram URLs are very long and might fail in some proxies; encode properly.
    // Instagram/Facebook URLs often work much better through weserv than direct or other proxies
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=128&h=128&fit=cover&output=webp&n=-1`;
};
