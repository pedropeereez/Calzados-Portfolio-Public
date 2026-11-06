import { DEMO_PRODUCTS } from './demo-data.js';
import { CART_KEY, MAX_QUANTITY, readCart, writeCart, normaliseCart, cartTotal, safeImage, filterProducts } from './core.js';

const $ = id => document.getElementById(id);
const products = structuredClone(DEMO_PRODUCTS);
let storage;
try { storage = window.localStorage; } catch { storage = null; }
let cart = readCart(storage, products);
let selectedProduct = null;
let selectedSize = null;
let selectedColor = null;
let brand = 'all';
let previousFocus = null;
let activeDialog = null;
const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);

function el(tag, classes = '', text) {
    const node = document.createElement(tag);
    node.className = classes;
    if (text !== undefined) node.textContent = String(text);
    return node;
}
function button(text, classes, action) {
    const node = el('button', classes, text);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
}
function image(src, alt, classes) {
    const node = el('img', classes);
    node.src = safeImage(src, document.baseURI);
    node.alt = alt;
    node.loading = 'lazy';
    return node;
}
function icons() { window.lucide?.createIcons(); }
function announce(message) {
    const toast = el('div', 'rounded-xl bg-slate-900 text-white px-5 py-4 shadow-lg max-w-sm text-sm', message);
    $('toast-container').append(toast);
    setTimeout(() => toast.remove(), 4500);
}
function showDialog(node) {
    if (activeDialog) hideDialogs(false);
    previousFocus = document.activeElement;
    activeDialog = node;
    node.classList.remove('hidden', 'translate-x-full', '-translate-x-full');
    node.setAttribute('aria-hidden', 'false');
    if (node.id === 'cart-drawer') $('cart-overlay').classList.remove('hidden');
    if (node.id === 'mobile-menu-drawer') $('mobile-menu-overlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    node.querySelector('button:not(:disabled), a[href], input')?.focus();
}
function hideDialogs(restoreFocus = true) {
    $('product-modal').classList.add('hidden');
    $('info-modal').classList.add('hidden');
    $('cart-drawer').classList.add('translate-x-full');
    $('mobile-menu-drawer').classList.add('-translate-x-full');
    for (const id of ['cart-drawer', 'mobile-menu-drawer']) $(id).setAttribute('aria-hidden', 'true');
    $('cart-overlay').classList.add('hidden');
    $('mobile-menu-overlay').classList.add('hidden');
    document.body.style.overflow = '';
    activeDialog = null;
    if (restoreFocus) previousFocus?.focus();
}
function renderFilters() {
    const container = $('brand-filters');
    container.replaceChildren();
    for (const value of ['all', ...new Set(products.map(p => p.brand))]) {
        const selected = value === brand;
        const btn = button(value === 'all' ? 'Todos' : value,
            `filter-btn rounded-full px-5 py-2 text-xs font-semibold transition ${selected ? 'bg-slate-900 text-white' : 'bg-white border border-zinc-200 text-slate-600'}`,
            () => { brand = value; renderFilters(); renderProducts(); });
        btn.setAttribute('aria-pressed', String(selected));
        container.append(btn);
    }
}
function renderProducts() {
    const container = $('products-grid');
    container.replaceChildren();
    const visible = filterProducts(products, $('search-input').value, brand);
    $('empty-state').classList.toggle('hidden', visible.length > 0);
    $('empty-state').classList.toggle('flex', visible.length === 0);
    for (const product of visible) {
        const card = el('article', 'group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all hover:shadow-xl');
        card.append(image(product.image, product.name, 'aspect-square w-full object-cover'));
        const body = el('div', 'p-4 flex flex-col flex-grow gap-3');
        body.append(el('span', 'text-xs uppercase tracking-wider text-zinc-500', product.brand));
        body.append(el('h3', 'font-bold text-slate-900 text-base', product.name));
        body.append(el('p', 'text-xs text-zinc-500', product.description));
        const row = el('div', 'flex items-center justify-between gap-2 mt-auto');
        row.append(el('span', 'text-lg font-black text-slate-900', money(product.price)));
        const detail = button('Ver producto', 'rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-bold', () => openProduct(product));
        detail.setAttribute('aria-label', `Ver ${product.name}`);
        row.append(detail);
        body.append(row);
        card.append(body);
        container.append(card);
    }
}
function updateAddButton() {
    const ready = selectedSize !== null && (!selectedProduct.colors.length || selectedColor !== null);
    $('modal-add-to-cart-btn').disabled = !ready;
    $('modal-add-to-cart-btn').textContent = ready ? 'Añadir al carrito' : 'Selecciona talla y color';
    $('modal-add-to-cart-btn').className = `w-full rounded-full py-4 text-center text-sm font-semibold transition ${ready ? 'bg-slate-900 text-white' : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'}`;
}
function openProduct(product) {
    selectedProduct = product;
    selectedSize = null;
    selectedColor = null;
    $('modal-product-img').src = safeImage(product.image, document.baseURI);
    $('modal-product-img').alt = product.name;
    $('modal-product-brand').textContent = product.brand;
    $('modal-product-name').textContent = product.name;
    $('modal-product-price').textContent = money(product.price);
    $('modal-product-desc').textContent = product.description;
    const thumbs = $('modal-thumbnails');
    thumbs.replaceChildren();
    product.gallery.forEach((src, index) => {
        const thumb = button('', 'gallery-thumb h-16 w-16 flex-shrink-0 rounded-lg overflow-hidden border-2 border-zinc-200', () => {
            $('modal-product-img').src = safeImage(src, document.baseURI);
        });
        thumb.setAttribute('aria-label', `Ver imagen ${index + 1}`);
        thumb.append(image(src, '', 'w-full h-full object-cover'));
        thumbs.append(thumb);
    });
    const sizes = $('modal-sizes-container');
    sizes.replaceChildren();
    for (const size of product.sizes) {
        const choice = button(size, 'talla-btn h-10 px-3 rounded-lg border border-zinc-200 text-sm', () => {
            selectedSize = size;
            for (const b of sizes.children) { b.classList.remove('bg-slate-900', 'text-white'); b.setAttribute('aria-pressed', 'false'); }
            choice.classList.add('bg-slate-900', 'text-white');
            choice.setAttribute('aria-pressed', 'true');
            updateAddButton();
        });
        choice.setAttribute('aria-pressed', 'false');
        choice.disabled = product.availableSizes && !product.availableSizes.includes(size);
        if (choice.disabled) { choice.classList.add('text-zinc-400', 'line-through'); choice.title = 'Agotado'; }
        sizes.append(choice);
    }
    const colors = $('modal-colors-container');
    colors.replaceChildren();
    colors.parentElement.hidden = !product.colors.length;
    for (const color of product.colors) {
        const choice = button(color, 'color-btn px-4 py-2 rounded-lg border border-zinc-200 text-sm', () => {
            selectedColor = color;
            for (const b of colors.children) { b.classList.remove('bg-slate-900', 'text-white'); b.setAttribute('aria-pressed', 'false'); }
            choice.classList.add('bg-slate-900', 'text-white');
            choice.setAttribute('aria-pressed', 'true');
            updateAddButton();
        });
        choice.disabled = product.availableColors && !product.availableColors.includes(color);
        choice.setAttribute('aria-pressed', 'false');
        colors.append(choice);
    }
    updateAddButton();
    showDialog($('product-modal'));
}
function persistCart() {
    cart = normaliseCart(cart, products);
    writeCart(storage, cart);
    renderCart();
}
function renderCart() {
    const total = cart.reduce((sum, item) => sum + item.cantidad, 0);
    $('cart-badge').textContent = total;
    $('cart-badge').classList.toggle('hidden', !total);
    $('empty-cart-btn').classList.toggle('hidden', !total);
    $('cart-empty').classList.toggle('hidden', !!total);
    $('cart-footer').classList.toggle('hidden', !total);
    const container = $('cart-items');
    container.replaceChildren();
    cart.forEach((item, index) => {
        const product = products.find(p => p.id === item.id);
        const row = el('div', 'flex items-center gap-4 rounded-xl border border-zinc-100 bg-white p-3');
        row.append(image(product.image, product.name, 'h-16 w-16 object-cover rounded-lg'));
        const detail = el('div', 'flex-grow');
        detail.append(el('h4', 'text-sm font-bold', product.name));
        detail.append(el('p', 'text-xs text-zinc-500', `Talla: ${item.talla} · ${item.color || ''}`));
        const controls = el('div', 'flex items-center gap-3 mt-2');
        const minus = button('−', 'h-7 w-7 rounded bg-zinc-100', () => {
            if (item.cantidad === 1) cart.splice(index, 1); else item.cantidad--;
            persistCart();
        });
        minus.setAttribute('aria-label', `Reducir cantidad de ${product.name}`);
        const plus = button('+', 'h-7 w-7 rounded bg-zinc-100', () => { item.cantidad++; persistCart(); });
        plus.disabled = item.cantidad >= MAX_QUANTITY;
        plus.setAttribute('aria-label', `Aumentar cantidad de ${product.name}`);
        controls.append(minus, el('span', 'text-xs font-bold', item.cantidad), plus);
        detail.append(controls);
        row.append(detail);
        const aside = el('div', 'flex flex-col items-end gap-3');
        aside.append(button('Quitar', 'text-xs text-zinc-500 underline', () => { cart.splice(index, 1); persistCart(); }));
        aside.append(el('span', 'text-sm font-bold', money(product.price * item.cantidad)));
        row.append(aside);
        container.append(row);
    });
    $('cart-subtotal').textContent = money(cartTotal(cart, products));
}

const info = {
    nosotros: ['Sobre la demo', 'Proyecto de portfolio basado en una interfaz de tienda de calzado. Todos los productos, importes e imágenes de esta copia son de ejemplo.'],
    faqs: ['Preguntas frecuentes', 'Puedes buscar productos, probar variantes y guardar un carrito local. No se realizan compras ni se atienden solicitudes comerciales.'],
    tallas: ['Guía de tallas', 'Las tallas son datos ficticios de demostración. La talla 39 se muestra agotada para probar ese estado.'],
    terminos: ['Uso de la demostración', 'La simulación no crea un pedido, un contrato de compra ni un cobro.'],
    privacidad: ['Privacidad de la demo', 'El catálogo usa archivos locales. El formulario solo valida los campos y no envía ni almacena su contenido. El carrito guarda únicamente referencias de productos ficticios en el almacenamiento de tu navegador. Puedes borrarlo con «Vaciar». No se incluye analítica ni conexiones a tiendas o formularios externos.'],
    legal: ['Información del proyecto', 'Demostración educativa sin actividad comercial. Se han omitido identidades fiscales, direcciones y datos de contacto del negocio original.'],
    envios: ['Envíos de ejemplo', 'No hay envíos reales. Los importes del catálogo son ficticios.'],
    devoluciones: ['Cambios de ejemplo', 'No hay transacciones ni devoluciones reales en esta demostración.'],
    cancelacion: ['Cancelar la simulación', 'Puedes vaciar el carrito en cualquier momento. No se ha enviado ningún pedido.']
};
$('search-input').addEventListener('input', renderProducts);
$('open-cart-btn').addEventListener('click', () => showDialog($('cart-drawer')));
$('mobile-menu-btn').addEventListener('click', () => showDialog($('mobile-menu-drawer')));
for (const id of ['close-cart-btn', 'cart-overlay', 'close-modal-btn', 'close-info-btn', 'close-mobile-menu-btn', 'mobile-menu-overlay']) $(id).addEventListener('click', () => hideDialogs());
for (const id of ['product-modal', 'info-modal']) $(id).addEventListener('click', event => { if (event.target === $(id)) hideDialogs(); });
document.querySelectorAll('.mobile-nav-link').forEach(link => link.addEventListener('click', () => hideDialogs()));
$('modal-add-to-cart-btn').addEventListener('click', () => {
    if (selectedSize === null || (selectedProduct.colors.length && selectedColor === null)) return;
    const existing = cart.find(item => item.id === selectedProduct.id && item.talla === selectedSize && item.color === selectedColor);
    if (existing && existing.cantidad >= MAX_QUANTITY) { announce('Se ha alcanzado el límite de unidades de la demo.'); return; }
    if (existing) existing.cantidad++;
    else cart.push({ id: selectedProduct.id, talla: selectedSize, color: selectedColor, cantidad: 1 });
    persistCart();
    hideDialogs();
    announce('Producto añadido al carrito de demostración.');
});
$('empty-cart-btn').addEventListener('click', () => { cart = []; persistCart(); announce('Carrito vaciado.'); });
$('checkout-btn').addEventListener('click', () => { announce('Simulación completada. No se ha creado ningún pedido ni realizado ningún cobro.'); });
$('contact-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!$('contact-form').reportValidity()) return;
    $('contact-success-msg').classList.remove('hidden');
    $('contact-success-msg').textContent = 'Validación completada. No se ha enviado ni guardado ningún mensaje.';
    $('contact-form').reset();
});
document.querySelectorAll('[data-info]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    const entry = info[link.dataset.info];
    if (!entry) return;
    $('info-modal-title').textContent = entry[0];
    $('info-modal-body').textContent = entry[1];
    showDialog($('info-modal'));
}));
document.addEventListener('keydown', event => {
    if (!activeDialog) return;
    if (event.key === 'Escape') { event.preventDefault(); hideDialogs(); }
    if (event.key === 'Tab') {
        const focusable = [...activeDialog.querySelectorAll('button:not(:disabled), a[href], input, textarea')].filter(n => n.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
});
renderFilters();
renderProducts();
renderCart();
icons();
