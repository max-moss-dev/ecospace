import './style.css';
import { chapters } from './site.js';

const worldElement = document.querySelector('#world');
const markers = [...document.querySelectorAll('[data-marker]')];
const sectionElements = chapters.map(({ id }) => document.getElementById(id));
const navLinks = [...document.querySelectorAll('.rail a, .top-nav a')];
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const lightButton = document.querySelector('#lighting');
const notice = document.querySelector('#render-notice');
let engine;
let selected = '';
let queued = false;
let isDusk = false;

function progress() {
  const scroll = Math.max(0, window.scrollY);
  const bottom = sectionElements.findIndex((section, index) => index > 0 && section.offsetTop > scroll);
  if (bottom < 0) return sectionElements.length - 1;
  const top = sectionElements[bottom - 1].offsetTop;
  return bottom - 1 + (scroll - top) / (sectionElements[bottom].offsetTop - top);
}

function update() {
  queued = false;
  const value = progress();
  engine?.progress(value);
  const id = chapters[Math.round(value)].id;
  if (id === selected) return;
  selected = id;
  for (const link of navLinks) {
    if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }
}

function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(update);
}

for (const link of [...navLinks, ...markers, document.querySelector('.brand'), document.querySelector('.intro .button')]) {
  link.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = document.querySelector(link.hash);
    if (!destination) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(null, '', link.hash);
    destination.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth' });
    const heading = destination.querySelector('h1, h2');
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  });
}

lightButton.setAttribute('aria-label', 'Увімкнути сутінки');
lightButton.addEventListener('click', () => {
  isDusk = !isDusk;
  lightButton.setAttribute('aria-pressed', String(isDusk));
  lightButton.setAttribute('aria-label', isDusk ? 'Повернути денне світло' : 'Увімкнути сутінки');
  lightButton.firstElementChild.textContent = isDusk ? '☀' : '☾';
  lightButton.lastElementChild.textContent = isDusk ? 'День' : 'Сутінки';
  engine?.dusk(isDusk);
});

function setAvailability(available) {
  lightButton.hidden = !available;
  notice.hidden = available;
}

worldElement.addEventListener('scene-unavailable', () => setAvailability(false));
worldElement.addEventListener('scene-available', () => setAvailability(true));
window.addEventListener('scroll', schedule, { passive: true });
window.addEventListener('resize', schedule, { passive: true });
window.addEventListener('pageshow', schedule);
update();

try {
  const { createWorld } = await import('./world.js');
  engine = createWorld(worldElement, markers, motion);
  engine.start(progress());
  engine.dusk(isDusk);
} catch (error) {
  setAvailability(false);
  console.warn('EcoSpace Sea: WebGL scene unavailable.', error);
}
