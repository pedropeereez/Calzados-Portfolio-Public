// Pure data operations shared by the browser and regression tests.
export const CART_KEY = 'calzados_demo_cart_v1';
export const MAX_QUANTITY = 20;

export function normaliseCart(value, products) {
    if (!Array.isArray(value)) return [];
    const result = [];
    for (const entry of value.slice(0, 100)) {
        if (!entry || typeof entry !== 'object') continue;
        const product = products.find(p => p.id === entry.id);
        if (!product) continue;
        const size = product.sizes.find(s => String(s) === String(entry.talla));
        const color = product.colors.find(c => c === entry.color);
        if (size === undefined || (product.availableSizes && !product.availableSizes.includes(size))) continue;
        if (product.colors.length && (!color || (product.availableColors && !product.availableColors.includes(color)))) continue;
        if (!Number.isInteger(entry.cantidad) || entry.cantidad < 1 || entry.cantidad > MAX_QUANTITY) continue;
        const existing = result.find(i => i.id === product.id && i.talla === size && i.color === (color || null));
        if (existing) existing.cantidad = Math.min(MAX_QUANTITY, existing.cantidad + entry.cantidad);
        else result.push({ id: product.id, talla: size, color: color || null, cantidad: entry.cantidad });
    }
    return result;
}

export function readCart(storage, products) {
    try {
        return normaliseCart(JSON.parse(storage.getItem(CART_KEY) || '[]'), products);
    } catch {
        return [];
    }
}

export function writeCart(storage, cart) {
    try { storage.setItem(CART_KEY, JSON.stringify(cart)); return true; }
    catch { return false; } // Browsers can reject storage without breaking the demo.
}

export function cartTotal(cart, products) {
    return normaliseCart(cart, products).reduce((sum, item) => {
        const product = products.find(p => p.id === item.id);
        return sum + Math.round(product.price * 100) * item.cantidad;
    }, 0) / 100;
}

export function safeImage(value, base = 'https://demo.invalid/') {
    try {
        const url = new URL(String(value), base);
        const origin = new URL(base).origin;
        const local = url.origin === origin && url.pathname.includes('/assets/');
        const shopify = url.protocol === 'https:' && url.hostname === 'cdn.shopify.com';
        if (url.username || url.password || (!local && !shopify)) return 'assets/urbana.svg';
        return url.href;
    } catch { return 'assets/urbana.svg'; }
}

export function filterProducts(products, query, brand) {
    const text = String(query).trim().toLocaleLowerCase('es');
    return products.filter(p => (brand === 'all' || p.brand === brand)
        && `${p.name} ${p.brand}`.toLocaleLowerCase('es').includes(text));
}
