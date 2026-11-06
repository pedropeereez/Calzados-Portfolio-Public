// Optional integration example. The public demo never imports this module.
// Accept only a public Storefront token. Admin/private tokens belong on a server.
const API_VERSION = '2026-04';
export const PRODUCT_QUERY = `query Products($first: Int!) {
  products(first: $first) { edges { node {
    id title description
    images(first: 8) { edges { node { url altText } } }
    collections(first: 1) { edges { node { title } } }
    variants(first: 100) { edges { node {
      id availableForSale price { amount currencyCode }
      selectedOptions { name value }
    } } }
  } } }
}`;
const CART_MUTATION = `mutation Cart($lines: [CartLineInput!]!) {
  cartCreate(input: {lines: $lines}) {
    cart { checkoutUrl }
    userErrors { message }
  }
}`;

export function mapProduct(node) {
    const variants = (node.variants?.edges || []).map(e => e.node);
    const sizes = new Set(), colors = new Set(), availableSizes = new Set(), availableColors = new Set();
    const variantIds = {};
    for (const variant of variants) {
        let size = '', color = '';
        for (const option of variant.selectedOptions || []) {
            const name = String(option.name).toLowerCase();
            if (['size', 'talla', 'taille'].some(key => name.includes(key))) size = String(option.value);
            if (['color', 'colour'].some(key => name.includes(key))) color = String(option.value);
        }
        if (size) sizes.add(size);
        if (color) colors.add(color);
        if (variant.availableForSale) {
            if (size) availableSizes.add(size);
            if (color) availableColors.add(color);
            variantIds[JSON.stringify([size, color])] = variant.id;
        }
    }
    const gallery = (node.images?.edges || []).map(e => e.node.url);
    const price = Number(variants[0]?.price?.amount || 0);
    return {
        id: node.id, name: String(node.title || ''), description: String(node.description || ''),
        brand: String(node.collections?.edges?.[0]?.node?.title || 'Catálogo'),
        price: Number.isFinite(price) && price >= 0 ? price : 0,
        currency: variants[0]?.price?.currencyCode || 'EUR',
        image: gallery[0] || 'assets/urbana.svg', gallery,
        sizes: [...sizes], colors: [...colors], availableSizes: [...availableSizes], availableColors: [...availableColors],
        shopifyVariantIds: variantIds
    };
}

export function createShopifyClient({ domain, publicStorefrontToken, checkoutHosts = [] }, transport = globalThis.fetch) {
    if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(domain || '')) throw new Error('Dominio Storefront inválido.');
    if (typeof publicStorefrontToken !== 'string' || !publicStorefrontToken.trim()) throw new Error('Falta un token público Storefront.');
    const allowedHosts = new Set([domain.toLowerCase(), ...checkoutHosts.map(h => String(h).toLowerCase())]);
    async function request(query, variables) {
        const response = await transport(`https://${domain}/api/${API_VERSION}/graphql.json`, {
            method: 'POST', redirect: 'error', credentials: 'omit',
            headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': publicStorefrontToken },
            body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(10000)
        });
        if (!response.ok) throw new Error('No se pudo completar la solicitud Storefront.');
        const json = await response.json();
        if (json.errors?.length || !json.data) throw new Error('Storefront devolvió una respuesta no válida.');
        return json.data;
    }
    return {
        async catalogue(first = 50) {
            if (!Number.isInteger(first) || first < 1 || first > 100) throw new Error('Límite de catálogo inválido.');
            const data = await request(PRODUCT_QUERY, { first });
            return (data.products?.edges || []).map(e => mapProduct(e.node));
        },
        async checkout(cart, products) {
            if (!Array.isArray(cart) || !cart.length || cart.length > 100) throw new Error('Carrito inválido.');
            const lines = cart.map(item => {
                const product = products.find(p => p.id === item.id);
                const key = JSON.stringify([String(item.talla || ''), String(item.color || '')]);
                const variant = product?.shopifyVariantIds?.[key];
                if (!variant || !Number.isInteger(item.cantidad) || item.cantidad < 1 || item.cantidad > 20) throw new Error('Variante o cantidad inválida.');
                return { merchandiseId: variant, quantity: item.cantidad };
            });
            const data = await request(CART_MUTATION, { lines });
            if (data.cartCreate?.userErrors?.length) throw new Error('No se pudo crear el carrito. Revisa sus variantes.');
            const url = new URL(data.cartCreate?.cart?.checkoutUrl || 'invalid');
            if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowedHosts.has(url.hostname)) throw new Error('Destino de checkout no autorizado.');
            return url.href; // Caller decides whether to navigate; no side effects here.
        }
    };
}
