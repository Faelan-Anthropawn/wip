import { addons } from './addons-data.js';

let currentAddon = null;

function renderAddons() {
  const container = document.getElementById('addons-container');
  if (!container) return;

  container.innerHTML = addons.map(addon => `
    <button 
      class="addon-card flex flex-col items-start justify-start gap-3 rounded-xl card p-6 min-h-28 text-left cursor-pointer"
      data-addon-id="${addon.id}"
      aria-label="View ${addon.title}"
    >
      <span class="text-base font-bold text-pale leading-tight font-display">${addon.title}</span>
      <span class="text-sm text-mist leading-snug flex-grow">${addon.shortDescription}</span>
    </button>
  `).join('');

  container.querySelectorAll('.addon-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const addonId = e.currentTarget.getAttribute('data-addon-id');
      const addon = addons.find(a => a.id === addonId);
      if (addon) {
        openAddonModal(addon);
      }
    });
  });
}

function openAddonModal(addon) {
  currentAddon = addon;
  const modal = document.getElementById('addon-modal');
  const title = document.getElementById('modal-title');
  const description = document.getElementById('modal-description');
  const downloadBtn = document.getElementById('modal-download-btn');

  title.textContent = addon.title;
  description.innerHTML = addon.fullDescription;
  
  description.querySelectorAll('h3').forEach(h3 => {
    h3.className = 'text-xl font-bold text-pale mb-2 font-display';
  });
  description.querySelectorAll('p').forEach(p => {
    p.className = 'mb-4 leading-snug text-mist';
  });
  description.querySelectorAll('ul').forEach(ul => {
    ul.className = 'list-disc list-inside mb-4 leading-tight text-mist';
  });
  description.querySelectorAll('strong').forEach(s => {
    s.className = 'text-pale';
  });
  
  downloadBtn.onclick = () => {
    if (addon.downloadUrl && addon.downloadUrl !== '#') {
      window.open(addon.downloadUrl, '_blank');
    } else {
      alert('Download link coming soon!');
    }
  };

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeAddonModal() {
  const modal = document.getElementById('addon-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.body.style.overflow = '';
  currentAddon = null;
}

function initAddons() {
  renderAddons();

  const closeBtn = document.getElementById('modal-close-btn');
  const modal = document.getElementById('addon-modal');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeAddonModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeAddonModal();
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentAddon) {
      closeAddonModal();
    }
  });
}

window.addonsTabCleanup = function() {
  currentAddon = null;
  const modal = document.getElementById('addon-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  document.body.style.overflow = '';
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAddons);
} else {
  initAddons();
}
