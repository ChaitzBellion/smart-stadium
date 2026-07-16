/**
 * @fileoverview Fan Experience Module — Fan-Facing Services
 *
 * Features that enhance the spectator experience at FIFA World Cup 2026
 * stadiums, including wayfinding, food & beverage ordering, accessibility
 * services, and transport information. Supports EN / ES / FR localisation.
 *
 * @module modules/fan-experience
 */

import {
  createElement,
  $,
  $$,
  clearElement,
  appendChildren,
  debounce,
  announceToScreenReader,
} from '../utils/dom.js';
import {
  formatNumber,
  formatCompactNumber,
  formatPercentage,
  formatTime,
  formatDateTime,
} from '../utils/formatters.js';
import { EventBus } from '../services/event-bus.js';
import { StateManager } from '../services/state-manager.js';
import { Security } from '../services/security.js';

/* ================================================================== */
/*  Module State                                                      */
/* ================================================================== */

/** @type {HTMLElement|null} */
let _container = null;

/** @type {string} Active tab key */
let _activeTab = 'wayfinding';

/** @type {string} Active language: 'en'|'es'|'fr' */
let _activeLang = 'en';

/** @type {HTMLElement|null} Tab content area */
let _tabContent = null;

/** @type {HTMLElement|null} Tab bar element */
let _tabBar = null;

/** @type {Function[]} EventBus unsubscribe handles */
let _unsubscribers = [];

/** @type {number[]} Intervals / timeouts to clean up */
let _timers = [];

/* ================================================================== */
/*  Translations                                                      */
/* ================================================================== */

/**
 * @typedef {Object<string, Object<string, string>>} TranslationMap
 * Keyed by language code, then by translation key.
 */

/** @type {TranslationMap} */
const T = {
  en: {
    pageTitle: 'Fan Experience',
    wayfinding: 'Wayfinding',
    food: 'Food & Beverage',
    accessibility: 'Accessibility',
    transport: 'Transport',
    searchPlaceholder: 'Search for a location...',
    minWalk: 'min walk',
    orderBtn: 'Order',
    orderPlaced: '✅ Order placed!',
    findNearest: 'Find Nearest',
    popular: 'Popular',
    available: 'Available',
    unavailable: 'Unavailable',
    waitTime: 'wait',
    allCategories: 'All',
    fastFood: 'Fast Food',
    beverages: 'Beverages',
    snacks: 'Snacks',
    premium: 'Premium',
    healthy: 'Healthy',
    accessIntro: "We're committed to making the FIFA World Cup 2026 accessible to everyone.",
    nextDeparture: 'Next departure',
    frequency: 'Frequency',
    walkTime: 'Walk time',
    spotsAvail: 'spots available',
    exitStrategy: 'Post-Match Exit Strategy',
    exitDesc: 'To avoid congestion, we recommend staggered departures. Upper deck fans should depart first, followed by lower sections.',
    recommended: 'Recommended departure',
    surge: 'Estimated surge',
    parking: 'Parking',
    lines: 'Lines',
    station: 'Nearest station',
    routes: 'Routes',
    pickupZone: 'Pickup/Dropoff zone',
    lotStatus: 'Lot status',
    pricing: 'Pricing',
    distance: 'Distance',
  },
  es: {
    pageTitle: 'Experiencia del Fan',
    wayfinding: 'Orientación',
    food: 'Comida y Bebida',
    accessibility: 'Accesibilidad',
    transport: 'Transporte',
    searchPlaceholder: 'Buscar una ubicación...',
    minWalk: 'min caminando',
    orderBtn: 'Pedir',
    orderPlaced: '✅ ¡Pedido realizado!',
    findNearest: 'Encontrar Más Cercano',
    popular: 'Popular',
    available: 'Disponible',
    unavailable: 'No Disponible',
    waitTime: 'espera',
    allCategories: 'Todos',
    fastFood: 'Comida Rápida',
    beverages: 'Bebidas',
    snacks: 'Snacks',
    premium: 'Premium',
    healthy: 'Saludable',
    accessIntro: 'Estamos comprometidos a hacer la Copa del Mundo FIFA 2026 accesible para todos.',
    nextDeparture: 'Próxima salida',
    frequency: 'Frecuencia',
    walkTime: 'Tiempo caminando',
    spotsAvail: 'espacios disponibles',
    exitStrategy: 'Estrategia de Salida Post-Partido',
    exitDesc: 'Para evitar congestión, recomendamos salidas escalonadas. Los fans de la parte superior deben salir primero.',
    recommended: 'Salida recomendada',
    surge: 'Sobreprecio estimado',
    parking: 'Estacionamiento',
    lines: 'Líneas',
    station: 'Estación más cercana',
    routes: 'Rutas',
    pickupZone: 'Zona de recogida',
    lotStatus: 'Estado del estacionamiento',
    pricing: 'Precio',
    distance: 'Distancia',
  },
  fr: {
    pageTitle: 'Expérience Fan',
    wayfinding: 'Orientation',
    food: 'Restauration',
    accessibility: 'Accessibilité',
    transport: 'Transport',
    searchPlaceholder: 'Rechercher un lieu...',
    minWalk: 'min à pied',
    orderBtn: 'Commander',
    orderPlaced: '✅ Commande passée !',
    findNearest: 'Trouver le Plus Proche',
    popular: 'Populaire',
    available: 'Disponible',
    unavailable: 'Indisponible',
    waitTime: 'attente',
    allCategories: 'Tous',
    fastFood: 'Fast Food',
    beverages: 'Boissons',
    snacks: 'Snacks',
    premium: 'Premium',
    healthy: 'Sain',
    accessIntro: 'Nous nous engageons à rendre la Coupe du Monde FIFA 2026 accessible à tous.',
    nextDeparture: 'Prochain départ',
    frequency: 'Fréquence',
    walkTime: 'Temps de marche',
    spotsAvail: 'places disponibles',
    exitStrategy: 'Stratégie de Sortie Post-Match',
    exitDesc: 'Pour éviter la congestion, nous recommandons des départs échelonnés. Les fans des niveaux supérieurs doivent partir en premier.',
    recommended: 'Départ recommandé',
    surge: 'Surcoût estimé',
    parking: 'Parking',
    lines: 'Lignes',
    station: 'Station la plus proche',
    routes: 'Itinéraires',
    pickupZone: 'Zone de prise en charge',
    lotStatus: 'État du parking',
    pricing: 'Tarifs',
    distance: 'Distance',
  },
};

/**
 * Returns a translated string for the current language.
 *
 * @param {string} key Translation key.
 * @returns {string}
 */
function t(key) {
  return (T[_activeLang] && T[_activeLang][key]) || T.en[key] || key;
}

/* ================================================================== */
/*  Data Sources                                                      */
/* ================================================================== */

/**
 * Returns wayfinding destination data.
 *
 * @returns {Array<{icon:string, name:string, walkMin:number, location:string, keywords:string[]}>}
 */
function _getWayfindingData() {
  return [
    { icon: '🚻', name: 'Restrooms', walkMin: 2, location: 'North Concourse, Level 1', keywords: ['toilet', 'bathroom', 'wc', 'restroom'] },
    { icon: '🍔', name: 'Food Court', walkMin: 3, location: 'North Concourse, Level 2', keywords: ['food', 'eat', 'restaurant', 'dining'] },
    { icon: '🏥', name: 'First Aid', walkMin: 4, location: 'South Gate, Level 1', keywords: ['medical', 'doctor', 'nurse', 'health', 'aid'] },
    { icon: '🚪', name: 'Exit Gates', walkMin: 5, location: 'All Concourses, Level 1', keywords: ['exit', 'leave', 'gate', 'out'] },
    { icon: '🎫', name: 'Ticket Office', walkMin: 6, location: 'Main Entrance, Level 1', keywords: ['ticket', 'office', 'purchase', 'buy'] },
    { icon: '📱', name: 'Charging Stations', walkMin: 3, location: 'East Concourse, Level 2', keywords: ['charge', 'phone', 'battery', 'power', 'usb'] },
    { icon: '🛍️', name: 'Fan Shop', walkMin: 4, location: 'West Concourse, Level 1', keywords: ['shop', 'merchandise', 'store', 'buy', 'souvenir'] },
    { icon: '👶', name: 'Family Zone', walkMin: 5, location: 'West Concourse, Level 2', keywords: ['family', 'kids', 'children', 'baby', 'play'] },
    { icon: '♿', name: 'Accessible Entry', walkMin: 2, location: 'Gate A & Gate D, Level 1', keywords: ['accessible', 'wheelchair', 'disability', 'ramp'] },
  ];
}

/**
 * Returns food and beverage item data.
 *
 * @returns {Array<{name:string, category:string, price:number, waitMin:number, popular:boolean, available:boolean}>}
 */
function _getFoodData() {
  return [
    { name: 'Classic Burger', category: 'fast-food', price: 12.99, waitMin: 4, popular: true, available: true },
    { name: 'Loaded Nachos', category: 'snacks', price: 9.99, waitMin: 3, popular: true, available: true },
    { name: 'Draft Beer', category: 'beverages', price: 11.50, waitMin: 2, popular: true, available: true },
    { name: 'Premium Hot Dog', category: 'fast-food', price: 8.99, waitMin: 2, popular: false, available: true },
    { name: 'Caesar Salad', category: 'healthy', price: 14.99, waitMin: 5, popular: false, available: true },
    { name: 'Artisan Pizza Slice', category: 'premium', price: 16.99, waitMin: 8, popular: true, available: true },
    { name: 'Soft Pretzel', category: 'snacks', price: 6.99, waitMin: 1, popular: false, available: true },
    { name: 'Fresh Lemonade', category: 'beverages', price: 7.50, waitMin: 1, popular: false, available: true },
    { name: 'Wagyu Burger', category: 'premium', price: 24.99, waitMin: 12, popular: false, available: true },
    { name: 'Açaí Bowl', category: 'healthy', price: 13.99, waitMin: 6, popular: false, available: true },
    { name: 'Chicken Tenders', category: 'fast-food', price: 10.99, waitMin: 5, popular: true, available: true },
    { name: 'Frozen Margarita', category: 'beverages', price: 14.00, waitMin: 3, popular: true, available: true },
    { name: 'Popcorn (Large)', category: 'snacks', price: 8.50, waitMin: 1, popular: false, available: true },
    { name: 'Sushi Platter', category: 'premium', price: 28.00, waitMin: 10, popular: false, available: false },
    { name: 'Fruit Smoothie', category: 'healthy', price: 9.99, waitMin: 4, popular: false, available: true },
    { name: 'Espresso', category: 'beverages', price: 5.50, waitMin: 2, popular: false, available: true },
  ];
}

/**
 * Returns accessibility service data.
 *
 * @returns {Array<{icon:string, titleKey:string, title:string, description:string}>}
 */
function _getAccessibilityData() {
  return [
    { icon: '♿', title: 'Wheelchair Access', description: 'Accessible entrances at Gates A and D. Elevators at East and West wings. Reserved seating in Sections 101, 215, and 310 with companion seats available.' },
    { icon: '👂', title: 'Hearing Assistance', description: 'Hearing loops installed in Sections 100-120 and all premium suites. Sign language interpreters available at Information Desks (schedule posted at gates).' },
    { icon: '👁️', title: 'Visual Assistance', description: 'Audio descriptions available via stadium app channel 2. Braille signage at all major concourses and facilities. Guide dog relief areas at Gate B and Gate E.' },
    { icon: '🧘', title: 'Quiet Zones', description: 'Sensory rooms located at Level 2 East (Room 204) and Level 3 West (Room 312). Quiet seating areas in Section 250 with reduced noise levels for neurodivergent fans.' },
    { icon: '👶', title: 'Family Services', description: 'Baby changing stations in all restrooms. Dedicated family restrooms on every level. Stroller parking available inside Gates A, C, and D. Kids play zone at West Concourse Level 2.' },
    { icon: '🌐', title: 'Language Support', description: 'Multilingual staff at all Information Desks (EN, ES, FR, AR, ZH, PT). Real-time translation available via stadium app. Multilingual signage throughout all concourses.' },
  ];
}

/**
 * Returns transport option data.
 *
 * @returns {Array<{icon:string, title:string, type:string, details:Object}>}
 */
function _getTransportData() {
  return [
    {
      icon: '🚇', title: 'Metro / Subway', type: 'metro',
      details: {
        station: 'Meadowlands Station',
        lines: 'NJ Transit Line 4, Express Line 7',
        walkMin: 8,
        schedule: 'Every 6 min (match day)',
        status: 'on-time',
      },
    },
    {
      icon: '🚌', title: 'Shuttle Bus', type: 'shuttle',
      details: {
        routes: 'Route A (Downtown), Route B (Airport), Route C (Hotels)',
        frequency: 'Every 10 min',
        nextDeparture: '3 min',
        status: 'running',
      },
    },
    {
      icon: '🚗', title: 'Ride Share', type: 'rideshare',
      details: {
        pickupZone: 'Lot G — East Entrance',
        surge: '1.4x',
        estimatedWait: '6 min',
        status: 'high-demand',
      },
    },
    {
      icon: '🅿️', title: 'Parking', type: 'parking',
      details: {
        spotsAvailable: 1240,
        spotsTotal: 8500,
        pricing: '$45 standard / $75 premium',
        distance: '5 min walk to Gate A',
        status: 'available',
      },
    },
  ];
}

/* ================================================================== */
/*  Helper: Toast Notification                                        */
/* ================================================================== */

/**
 * Shows a temporary toast notification.
 *
 * @param {string} message The toast message.
 */
function _showToast(message) {
  const toast = createElement('div');
  toast.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);' +
    'background:var(--color-surface, #1e293b);color:var(--color-text, #f1f5f9);' +
    'padding:10px 20px;border-radius:8px;font-size:0.9rem;z-index:9999;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.3);animation:fadeIn 0.3s ease;';
  toast.textContent = message;
  document.body.appendChild(toast);

  const timer = setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 2500);
  _timers.push(timer);
}

/* ================================================================== */
/*  Tab: Wayfinding                                                   */
/* ================================================================== */

/**
 * Builds the Wayfinding tab panel.
 *
 * @returns {HTMLElement}
 */
function _buildWayfindingTab() {
  const panel = createElement('div', {
    role: 'tabpanel',
    id: 'panel-wayfinding',
    'aria-labelledby': 'tab-wayfinding',
  });

  const destinations = _getWayfindingData();

  // Search input
  const searchInput = createElement('input', {
    type: 'search',
    className: 'search-input',
    placeholder: t('searchPlaceholder'),
    'aria-label': t('searchPlaceholder'),
  });
  searchInput.style.cssText = 'width:100%;margin-bottom:16px;';

  // Grid for destination cards
  const grid = createElement('div', { className: 'grid-3' });

  /**
   * Renders destination cards, optionally filtered.
   *
   * @param {string} [filterText=''] Search filter text.
   */
  function renderCards(filterText = '') {
    clearElement(grid);
    const query = filterText.toLowerCase().trim();

    const filtered = destinations.filter((dest) => {
      if (!query) return true;
      return (
        dest.name.toLowerCase().includes(query) ||
        dest.location.toLowerCase().includes(query) ||
        dest.keywords.some((kw) => kw.includes(query))
      );
    });

    if (filtered.length === 0) {
      const empty = createElement('p', { className: 'text-muted' });
      empty.textContent = 'No locations found matching your search.';
      empty.style.gridColumn = '1 / -1';
      grid.appendChild(empty);
      return;
    }

    filtered.forEach((dest, idx) => {
      const card = createElement('div', { className: 'venue-card card animate-in' });
      card.style.setProperty('--delay', `${idx * 50}ms`);
      card.setAttribute('tabindex', '0');
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${dest.name} — ~${dest.walkMin} ${t('minWalk')}, ${dest.location}`);

      const iconEl = createElement('div');
      iconEl.style.cssText = 'font-size:2rem;margin-bottom:8px;';
      iconEl.textContent = dest.icon;

      const nameEl = createElement('h4');
      nameEl.textContent = dest.name;
      nameEl.style.cssText = 'margin:0 0 4px;';

      const walkEl = createElement('span', { className: 'badge badge--info' });
      walkEl.textContent = `~${dest.walkMin} ${t('minWalk')}`;

      const locEl = createElement('p', { className: 'text-muted' });
      locEl.textContent = dest.location;
      locEl.style.cssText = 'font-size:0.8rem;margin-top:6px;';

      appendChildren(card, [iconEl, nameEl, walkEl, locEl]);
      grid.appendChild(card);
    });
  }

  // Debounced search handler
  const debouncedSearch = debounce((/** @type {string} */ val) => renderCards(val), 250);

  searchInput.addEventListener('input', () => {
    debouncedSearch(searchInput.value);
  });

  renderCards();
  appendChildren(panel, [searchInput, grid]);
  return panel;
}

/* ================================================================== */
/*  Tab: Food & Beverage                                              */
/* ================================================================== */

/**
 * Builds the Food & Beverage tab panel.
 *
 * @returns {HTMLElement}
 */
function _buildFoodTab() {
  const panel = createElement('div', {
    role: 'tabpanel',
    id: 'panel-food',
    'aria-labelledby': 'tab-food',
  });

  const allItems = _getFoodData();

  // Category filter chips
  const categories = [
    { key: 'all', label: t('allCategories') },
    { key: 'fast-food', label: t('fastFood') },
    { key: 'beverages', label: t('beverages') },
    { key: 'snacks', label: t('snacks') },
    { key: 'premium', label: t('premium') },
    { key: 'healthy', label: t('healthy') },
  ];

  let activeCategory = 'all';

  const chipsWrapper = createElement('div');
  chipsWrapper.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;';

  const grid = createElement('div', { className: 'grid-auto' });

  /**
   * Renders food cards filtered by category.
   *
   * @param {string} category Category key to filter by.
   */
  function renderFoodCards(category) {
    clearElement(grid);
    activeCategory = category;

    // Update chip active states
    const chips = chipsWrapper.querySelectorAll('.chip');
    chips.forEach((chip) => {
      if (chip.dataset.category === category) {
        chip.classList.add('chip--active');
      } else {
        chip.classList.remove('chip--active');
      }
    });

    let items = category === 'all' ? [...allItems] : allItems.filter((i) => i.category === category);

    // Sort: popular first, then by shortest wait time
    items.sort((a, b) => {
      if (a.popular !== b.popular) return a.popular ? -1 : 1;
      return a.waitMin - b.waitMin;
    });

    items.forEach((item, idx) => {
      const card = createElement('div', { className: 'card animate-in' });
      card.style.setProperty('--delay', `${idx * 40}ms`);

      const body = createElement('div', { className: 'card-body' });

      // Header row: name + popular badge
      const headerRow = createElement('div');
      headerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';

      const nameEl = createElement('h4');
      nameEl.textContent = Security.escapeHTML(item.name);
      nameEl.style.margin = '0';
      headerRow.appendChild(nameEl);

      if (item.popular) {
        const popBadge = createElement('span', { className: 'badge text-gold' });
        popBadge.textContent = `⭐ ${t('popular')}`;
        headerRow.appendChild(popBadge);
      }

      // Category badge
      const catBadge = createElement('span', { className: 'badge badge--info' });
      catBadge.textContent = item.category.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      catBadge.style.cssText = 'display:inline-block;margin-bottom:8px;font-size:0.7rem;';

      // Price & wait time
      const metaRow = createElement('div');
      metaRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;';

      const priceEl = createElement('span', { className: 'text-accent' });
      priceEl.style.cssText = 'font-weight:700;font-size:1.05rem;';
      priceEl.textContent = `$${item.price.toFixed(2)}`;

      const waitEl = createElement('span', { className: 'text-muted' });
      waitEl.style.fontSize = '0.8rem';
      waitEl.textContent = `⏱ ~${item.waitMin} min ${t('waitTime')}`;

      appendChildren(metaRow, [priceEl, waitEl]);

      // Availability + Order button
      const footerRow = createElement('div');
      footerRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';

      const statusEl = createElement('span');
      if (item.available) {
        statusEl.className = 'text-success';
        statusEl.textContent = `✓ ${t('available')}`;
      } else {
        statusEl.className = 'text-error';
        statusEl.textContent = `✗ ${t('unavailable')}`;
      }
      statusEl.style.fontSize = '0.8rem';

      const orderBtn = createElement('button', {
        className: 'btn btn--primary btn--sm',
        type: 'button',
        disabled: !item.available,
        'aria-label': `${t('orderBtn')} ${item.name}`,
      });
      orderBtn.textContent = t('orderBtn');
      if (item.available) {
        orderBtn.addEventListener('click', () => {
          _showToast(t('orderPlaced'));
          announceToScreenReader(t('orderPlaced'));
        });
      }

      appendChildren(footerRow, [statusEl, orderBtn]);
      appendChildren(body, [headerRow, catBadge, metaRow, footerRow]);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  // Build category chips
  categories.forEach((cat) => {
    const chip = createElement('button', {
      className: `chip ${cat.key === activeCategory ? 'chip--active' : ''}`,
      type: 'button',
    });
    chip.dataset.category = cat.key;
    chip.textContent = cat.label;
    chip.addEventListener('click', () => renderFoodCards(cat.key));
    chipsWrapper.appendChild(chip);
  });

  renderFoodCards('all');
  appendChildren(panel, [chipsWrapper, grid]);
  return panel;
}

/* ================================================================== */
/*  Tab: Accessibility                                                */
/* ================================================================== */

/**
 * Builds the Accessibility tab panel.
 *
 * @returns {HTMLElement}
 */
function _buildAccessibilityTab() {
  const panel = createElement('div', {
    role: 'tabpanel',
    id: 'panel-accessibility',
    'aria-labelledby': 'tab-accessibility',
  });

  // Intro card
  const introCard = createElement('div', { className: 'card animate-in' });
  const introBody = createElement('div', { className: 'card-body' });
  introBody.style.textAlign = 'center';
  const introIcon = createElement('div');
  introIcon.style.cssText = 'font-size:2.5rem;margin-bottom:8px;';
  introIcon.textContent = '🌍';
  const introText = createElement('p');
  introText.textContent = t('accessIntro');
  introText.style.cssText = 'font-size:1rem;line-height:1.6;max-width:600px;margin:0 auto;';
  appendChildren(introBody, [introIcon, introText]);
  introCard.appendChild(introBody);

  // Service cards grid
  const grid = createElement('div', { className: 'grid-2' });
  grid.style.marginTop = '16px';

  const services = _getAccessibilityData();

  services.forEach((svc, idx) => {
    const card = createElement('div', { className: 'card animate-in' });
    card.style.setProperty('--delay', `${(idx + 1) * 80}ms`);
    card.setAttribute('tabindex', '0');

    const body = createElement('div', { className: 'card-body' });

    const iconEl = createElement('div');
    iconEl.style.cssText = 'font-size:2rem;margin-bottom:8px;';
    iconEl.textContent = svc.icon;

    const titleEl = createElement('h4');
    titleEl.textContent = svc.title;
    titleEl.style.margin = '0 0 8px';

    const descEl = createElement('p', { className: 'text-secondary' });
    descEl.textContent = svc.description;
    descEl.style.cssText = 'font-size:0.85rem;line-height:1.5;margin:0 0 12px;';

    const findBtn = createElement('button', {
      className: 'btn btn--secondary btn--sm',
      type: 'button',
      'aria-label': `${t('findNearest')} ${svc.title}`,
    });
    findBtn.textContent = `📍 ${t('findNearest')}`;
    findBtn.addEventListener('click', () => {
      _showToast(`Finding nearest ${svc.title}...`);
    });

    appendChildren(body, [iconEl, titleEl, descEl, findBtn]);
    card.appendChild(body);
    grid.appendChild(card);
  });

  appendChildren(panel, [introCard, grid]);
  return panel;
}

/* ================================================================== */
/*  Tab: Transport                                                    */
/* ================================================================== */

/**
 * Builds the Transport tab panel.
 *
 * @returns {HTMLElement}
 */
function _buildTransportTab() {
  const panel = createElement('div', {
    role: 'tabpanel',
    id: 'panel-transport',
    'aria-labelledby': 'tab-transport',
  });

  const transportOptions = _getTransportData();

  const grid = createElement('div', { className: 'grid-2' });

  transportOptions.forEach((opt, idx) => {
    const card = createElement('div', { className: 'card animate-in' });
    card.style.setProperty('--delay', `${idx * 80}ms`);

    const header = createElement('div', { className: 'card-header' });
    const titleEl = createElement('h4', { className: 'card-title' });
    titleEl.textContent = `${opt.icon} ${opt.title}`;

    // Status badge
    const statusMap = {
      'on-time': { label: 'On Time', cls: 'badge--success' },
      'running': { label: 'Running', cls: 'badge--success' },
      'available': { label: 'Available', cls: 'badge--success' },
      'high-demand': { label: 'High Demand', cls: 'badge--warning' },
      'delayed': { label: 'Delayed', cls: 'badge--error' },
    };
    const si = statusMap[opt.details.status] || { label: opt.details.status, cls: 'badge--info' };
    const statusBadge = createElement('span', { className: `badge ${si.cls}` });
    const statusDot = createElement('span', { className: `status-dot ${si.cls === 'badge--success' ? 'status-dot--online' : si.cls === 'badge--warning' ? 'status-dot--warning' : 'status-dot--offline'}` });
    statusDot.style.marginRight = '4px';
    statusBadge.appendChild(statusDot);
    const statusText = createElement('span');
    statusText.textContent = si.label;
    statusBadge.appendChild(statusText);

    appendChildren(header, [titleEl, statusBadge]);

    const body = createElement('div', { className: 'card-body' });

    // Render details based on type
    const details = opt.details;
    /** @type {Array<{label:string, value:string}>} */
    let rows = [];

    switch (opt.type) {
      case 'metro':
        rows = [
          { label: t('station'), value: details.station },
          { label: t('lines'), value: details.lines },
          { label: t('walkTime'), value: `${details.walkMin} min` },
          { label: t('frequency'), value: details.schedule },
        ];
        break;
      case 'shuttle':
        rows = [
          { label: t('routes'), value: details.routes },
          { label: t('frequency'), value: details.frequency },
          { label: t('nextDeparture'), value: details.nextDeparture },
        ];
        break;
      case 'rideshare':
        rows = [
          { label: t('pickupZone'), value: details.pickupZone },
          { label: t('surge'), value: details.surge },
          { label: t('waitTime'), value: details.estimatedWait },
        ];
        break;
      case 'parking':
        rows = [
          { label: t('lotStatus'), value: `${formatNumber(details.spotsAvailable)} / ${formatNumber(details.spotsTotal)} ${t('spotsAvail')}` },
          { label: t('pricing'), value: details.pricing },
          { label: t('distance'), value: details.distance },
        ];
        break;
    }

    rows.forEach((row) => {
      const rowEl = createElement('div');
      rowEl.style.cssText = 'display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border-color, #333);';
      const lbl = createElement('span', { className: 'text-secondary' });
      lbl.style.fontSize = '0.85rem';
      lbl.textContent = row.label;
      const val = createElement('span');
      val.style.cssText = 'font-size:0.85rem;font-weight:600;text-align:right;max-width:60%;';
      val.textContent = row.value;
      appendChildren(rowEl, [lbl, val]);
      body.appendChild(rowEl);
    });

    // Parking: progress bar for spot availability
    if (opt.type === 'parking') {
      const pct = details.spotsAvailable / details.spotsTotal;
      const progressWrap = createElement('div', { className: 'progress-bar' });
      progressWrap.style.marginTop = '10px';
      const progressFill = createElement('div', { className: 'progress-fill' });
      progressFill.style.width = formatPercentage(pct);
      if (pct < 0.2) progressFill.style.background = 'var(--color-error, #ef4444)';
      else if (pct < 0.5) progressFill.style.background = 'var(--color-warning, #f59e0b)';
      progressWrap.appendChild(progressFill);
      body.appendChild(progressWrap);
    }

    appendChildren(card, [header, body]);
    grid.appendChild(card);
  });

  // Post-match exit strategy card
  const exitCard = createElement('div', { className: 'card animate-in' });
  exitCard.style.cssText = 'grid-column: 1 / -1;';
  exitCard.style.setProperty('--delay', '350ms');

  const exitHeader = createElement('div', { className: 'card-header' });
  const exitTitle = createElement('h4', { className: 'card-title' });
  exitTitle.textContent = `🚶 ${t('exitStrategy')}`;
  exitHeader.appendChild(exitTitle);

  const exitBody = createElement('div', { className: 'card-body' });

  const exitDesc = createElement('p', { className: 'text-secondary' });
  exitDesc.textContent = t('exitDesc');
  exitDesc.style.cssText = 'margin-bottom:12px;line-height:1.5;';

  const exitTimeline = createElement('div');
  const departureTimes = [
    { time: 'FT + 5 min', group: 'Upper Deck (300-level)', recommendation: 'Depart now — shuttle buses available' },
    { time: 'FT + 15 min', group: 'Mid Deck (200-level)', recommendation: 'Optimal departure — metro wait ~4 min' },
    { time: 'FT + 25 min', group: 'Lower Bowl (100-level)', recommendation: 'All transport at normal capacity' },
    { time: 'FT + 40 min', group: 'VIP & Suites', recommendation: 'Least congestion — ride share surge ends' },
  ];

  departureTimes.forEach((dt, idx) => {
    const row = createElement('div', { className: 'alert-item alert--info animate-in' });
    row.style.setProperty('--delay', `${(idx + 5) * 80}ms`);
    row.style.cssText += 'display:flex;gap:12px;align-items:flex-start;margin-bottom:8px;padding:10px;';

    const timeEl = createElement('span', { className: 'badge badge--info' });
    timeEl.textContent = dt.time;
    timeEl.style.flexShrink = '0';

    const content = createElement('div');
    const groupEl = createElement('strong');
    groupEl.textContent = dt.group;
    const recEl = createElement('p', { className: 'text-muted' });
    recEl.textContent = dt.recommendation;
    recEl.style.cssText = 'margin:2px 0 0;font-size:0.8rem;';
    appendChildren(content, [groupEl, recEl]);

    appendChildren(row, [timeEl, content]);
    exitTimeline.appendChild(row);
  });

  appendChildren(exitBody, [exitDesc, exitTimeline]);
  appendChildren(exitCard, [exitHeader, exitBody]);

  appendChildren(panel, [grid, exitCard]);
  return panel;
}

/* ================================================================== */
/*  Tab Rendering Controller                                          */
/* ================================================================== */

/** @type {Object<string, Function>} Map of tab key → builder function */
const TAB_BUILDERS = {
  wayfinding: _buildWayfindingTab,
  food: _buildFoodTab,
  accessibility: _buildAccessibilityTab,
  transport: _buildTransportTab,
};

/**
 * Switches to and renders the given tab.
 *
 * @param {string} tabKey The key of the tab to activate.
 */
function _switchTab(tabKey) {
  _activeTab = tabKey;

  // Update tab bar active states
  if (_tabBar) {
    const tabs = _tabBar.querySelectorAll('[role="tab"]');
    tabs.forEach((tab) => {
      const isActive = tab.dataset.tab === tabKey;
      if (isActive) {
        tab.classList.add('tab--active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('tab--active');
        tab.setAttribute('aria-selected', 'false');
      }
    });
  }

  // Render the tab content
  if (_tabContent) {
    clearElement(_tabContent);
    const builder = TAB_BUILDERS[tabKey];
    if (builder) {
      _tabContent.appendChild(builder());
    }
  }

  announceToScreenReader(`${tabKey} tab selected`);
}

/* ================================================================== */
/*  Build Full UI                                                     */
/* ================================================================== */

/**
 * Constructs the complete Fan Experience DOM tree.
 *
 * @returns {HTMLElement}
 */
function _buildUI() {
  const root = createElement('div', { className: 'content-section' });

  /* ---- Page Header ---- */
  const header = createElement('div', { className: 'page-header' });
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;';

  const title = createElement('h1', { className: 'page-title' });
  title.textContent = `⚽ ${t('pageTitle')}`;

  // Language toggle chips
  const langToggle = createElement('div');
  langToggle.style.cssText = 'display:flex;gap:6px;';
  langToggle.setAttribute('role', 'group');
  langToggle.setAttribute('aria-label', 'Language selector');

  const languages = [
    { code: 'en', label: 'EN' },
    { code: 'es', label: 'ES' },
    { code: 'fr', label: 'FR' },
  ];

  languages.forEach((lang) => {
    const chip = createElement('button', {
      className: `chip ${lang.code === _activeLang ? 'chip--active' : ''}`,
      type: 'button',
      'aria-label': `Switch language to ${lang.label}`,
      'aria-pressed': String(lang.code === _activeLang),
    });
    chip.dataset.lang = lang.code;
    chip.textContent = lang.label;
    chip.addEventListener('click', () => {
      _activeLang = lang.code;
      // Persist preference
      if (StateManager && typeof StateManager.set === 'function') {
        StateManager.set('fan-experience:lang', lang.code);
      }
      // Full re-render to update translations
      _render();
    });
    langToggle.appendChild(chip);
  });

  appendChildren(header, [title, langToggle]);

  /* ---- Tab Bar ---- */
  _tabBar = createElement('div', {
    className: 'tab-bar',
    role: 'tablist',
    'aria-label': 'Fan experience sections',
  });

  const tabDefs = [
    { key: 'wayfinding', label: t('wayfinding'), icon: '🗺️' },
    { key: 'food', label: t('food'), icon: '🍽️' },
    { key: 'accessibility', label: t('accessibility'), icon: '♿' },
    { key: 'transport', label: t('transport'), icon: '🚌' },
  ];

  tabDefs.forEach((td) => {
    const btn = createElement('button', {
      className: `tab ${td.key === _activeTab ? 'tab--active' : ''}`,
      type: 'button',
      role: 'tab',
      id: `tab-${td.key}`,
      'aria-selected': String(td.key === _activeTab),
      'aria-controls': `panel-${td.key}`,
    });
    btn.dataset.tab = td.key;
    btn.textContent = `${td.icon} ${td.label}`;
    btn.addEventListener('click', () => _switchTab(td.key));
    _tabBar.appendChild(btn);
  });

  /* ---- Tab Content Area ---- */
  _tabContent = createElement('div');
  _tabContent.style.cssText = 'margin-top:16px;';

  appendChildren(root, [header, _tabBar, _tabContent]);

  return root;
}

/**
 * Full render / re-render of the module (used when language changes).
 */
function _render() {
  if (!_container) return;
  clearElement(_container);
  const ui = _buildUI();
  _container.appendChild(ui);

  // Render the active tab
  _switchTab(_activeTab);
}

/* ================================================================== */
/*  Public API                                                        */
/* ================================================================== */

/**
 * Initialises the Fan Experience module and renders it into the given container.
 *
 * @param {HTMLElement} container The DOM element to render into.
 */
export function init(container) {
  _container = container;

  // Restore language preference
  if (StateManager && typeof StateManager.get === 'function') {
    const saved = StateManager.get('fan-experience:lang');
    if (saved && T[saved]) {
      _activeLang = saved;
    }
  }

  _render();
}

/**
 * Destroys the Fan Experience module, cleaning up all resources.
 */
export function destroy() {
  _unsubscribers.forEach((unsub) => {
    if (typeof unsub === 'function') unsub();
  });
  _unsubscribers = [];

  _timers.forEach((id) => clearTimeout(id));
  _timers = [];

  if (_container) {
    clearElement(_container);
  }

  _container = null;
  _tabContent = null;
  _tabBar = null;
  _activeTab = 'wayfinding';
  _activeLang = 'en';
}
