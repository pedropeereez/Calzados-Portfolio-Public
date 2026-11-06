import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PRODUCTS } from '../demo-data.js';
import { normaliseCart, readCart, writeCart, cartTotal, safeImage, filterProducts } from '../core.js';
import { createShopifyClient, mapProduct } from '../shopify-api.js';

const valid = { id: 1, talla: 38, color: 'Arena', cantidad: 2 };
test('storage corruption or disabled storage does not break startup', () => {
    assert.deepEqual(readCart({ getItem: () => '{broken' }, DEMO_PRODUCTS), []);
    assert.deepEqual(readCart(null, DEMO_PRODUCTS), []);
    assert.equal(writeCart(null, []), false);
});
test('cart ignores injected display fields and rejects unknown or unsellable variants', () => {
    const injected = { ...valid, name: '<img onerror=evil()>', price: 0, image: 'https://attacker.invalid/pixel' };
    assert.deepEqual(normaliseCart([injected], DEMO_PRODUCTS), [valid]);
    assert.deepEqual(normaliseCart([{ ...valid, id: '1);evil()' }, { ...valid, talla: 39 }, { ...valid, color: '<svg>' }, { ...valid, cantidad: -5 }, { ...valid, cantidad: 1.5 }], DEMO_PRODUCTS), []);
    assert.equal(cartTotal([injected], DEMO_PRODUCTS), DEMO_PRODUCTS[0].price * 2);
});
test('duplicate cart lines are merged with a quantity limit', () => {
    assert.equal(normaliseCart([{ ...valid, cantidad: 15 }, { ...valid, cantidad: 15 }], DEMO_PRODUCTS)[0].cantidad, 20);
});
test('image sources reject tracking origins, scripts, data URLs and credentials', () => {
    for (const url of ['javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'https://attacker.invalid/pixel', 'https://user:pass@cdn.shopify.com/a']) assert.equal(safeImage(url), 'assets/urbana.svg');
    assert.equal(safeImage('assets/urbana.svg'), 'https://demo.invalid/assets/urbana.svg');
});
test('search and category filters compose', () => {
    assert.equal(filterProducts(DEMO_PRODUCTS, 'URBANA', 'all').length, 1);
    assert.equal(filterProducts(DEMO_PRODUCTS, 'urbana', 'Deportivo').length, 0);
});
test('Shopify adapter preserves option strings as data and maps available combinations', () => {
    const node = { id: 'gid://shopify/Product/1', title: '<script>literal</script>', variants: { edges: [{ node: { id: 'gid://shopify/ProductVariant/2', availableForSale: true, price: { amount: '45.50', currencyCode: 'EUR' }, selectedOptions: [{ name: 'Size', value: 'XL' }, { name: 'Color', value: "O'Brien" }] } }] } };
    const product = mapProduct(node);
    assert.deepEqual(product.sizes, ['XL']);
    assert.equal(product.shopifyVariantIds[JSON.stringify(['XL', "O'Brien"])], 'gid://shopify/ProductVariant/2');
});
test('Shopify rejects invalid destinations and quantities before contacting services', async () => {
    assert.throws(() => createShopifyClient({ domain: 'attacker.invalid', publicStorefrontToken: 'placeholder' }));
    let calls = 0;
    const client = createShopifyClient({ domain: 'demo.myshopify.com', publicStorefrontToken: 'placeholder' }, async () => { calls++; return { ok: true, json: async () => ({ data: { cartCreate: { userErrors: [], cart: { checkoutUrl: 'https://attacker.invalid/pay' } } } }) }; });
    const p = { id: 1, shopifyVariantIds: { '["38","Arena"]': 'gid://shopify/ProductVariant/2' } };
    await assert.rejects(client.checkout([{ ...valid, cantidad: 99 }], [p]));
    assert.equal(calls, 0);
    await assert.rejects(client.checkout([valid], [p]), /no autorizado/);
    assert.equal(calls, 1);
});
