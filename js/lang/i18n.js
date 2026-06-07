import { en } from './en.js';
import { hi } from './hi.js';
import { mr } from './mr.js';

const dictionaries = { en, hi, mr };
const STORAGE_KEY = 'selected_language';
const DEFAULT_LANG = 'en';

// Expose dictionaries for external lookup if needed
export { dictionaries };

/**
 * Retrieves the currently active language from localStorage, defaulting to English.
 */
export function getLanguage() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && dictionaries[saved] ? saved : DEFAULT_LANG;
}

/**
 * Translates a given key into the current language, falling back to English.
 */
export function translateText(key, lang) {
  const activeLang = lang || getLanguage();
  
  // Try active language
  if (dictionaries[activeLang] && dictionaries[activeLang][key]) {
    return dictionaries[activeLang][key];
  }
  
  // Fall back to English
  if (activeLang !== DEFAULT_LANG && dictionaries[DEFAULT_LANG] && dictionaries[DEFAULT_LANG][key]) {
    console.warn(`Translation key "${key}" missing in "${activeLang}". Falling back to English.`);
    return dictionaries[DEFAULT_LANG][key];
  }
  
  return key;
}

/**
 * Translates a single element's text nodes and key attributes.
 */
export function translateElement(element, lang) {
  const activeLang = lang || getLanguage();
  
  // Translate main text content
  const key = element.getAttribute('data-i18n');
  if (key) {
    const translation = translateText(key, activeLang);
    
    // Hybrid HTML support: if the translation contains HTML tags, replace innerHTML
    if (translation.includes('<') && translation.includes('>')) {
      element.innerHTML = translation;
    } else {
      // Find text nodes to translate without destroying children like icons
      const textNode = Array.from(element.childNodes).find(
        node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== ""
      );
      
      if (textNode) {
        const leadingSpace = nodeValueLeadingSpaces(textNode.nodeValue);
        const trailingSpace = nodeValueTrailingSpaces(textNode.nodeValue);
        textNode.nodeValue = leadingSpace + translation + trailingSpace;
      } else {
        // If no non-empty text node exists, set content directly.
        if (element.children.length === 0) {
          element.textContent = translation;
        } else {
          // Fallback for elements with children: append translation as a text node
          const newTextNode = document.createTextNode(translation);
          Array.from(element.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              element.removeChild(node);
            }
          });
          element.appendChild(newTextNode);
        }
      }
    }
  }

  // Translate input/textarea placeholders
  const placeholderKey = element.getAttribute('data-i18n-placeholder');
  if (placeholderKey) {
    element.placeholder = translateText(placeholderKey, activeLang);
  }

  // Translate titles/tooltips
  const titleKey = element.getAttribute('data-i18n-title');
  if (titleKey) {
    element.title = translateText(titleKey, activeLang);
  }
}

// Utility helpers to match spacing
function nodeValueLeadingSpaces(str) {
  const match = str.match(/^\s*/);
  return match ? match[0] : '';
}

function nodeValueTrailingSpaces(str) {
  const match = str.match(/\s*$/);
  return match ? match[0] : '';
}

/**
 * Sweeps the DOM and translates all elements marked with localization attributes.
 */
export function translatePage(lang) {
  const activeLang = lang || getLanguage();
  
  // Set html document lang attribute
  document.documentElement.setAttribute('lang', activeLang);

  // Translate all marked elements
  document.querySelectorAll('[data-i18n], [data-i18n-placeholder], [data-i18n-title]').forEach(element => {
    translateElement(element, activeLang);
  });
}

/**
 * Sets the active language and triggers page-wide instant translations.
 */
export function setLanguage(lang) {
  if (!dictionaries[lang]) {
    console.error(`Language "${lang}" is not supported.`);
    return;
  }
  
  localStorage.setItem(STORAGE_KEY, lang);
  translatePage(lang);
  
  // Sync all dropdown selections on the page
  document.querySelectorAll('.lang-select').forEach(select => {
    select.value = lang;
  });

  // Emit global custom event for dynamic application modules (e.g. charts, Firebase greeting builders)
  const event = new CustomEvent('languagechanged', { detail: { language: lang } });
  window.dispatchEvent(event);
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  const activeLang = getLanguage();
  
  // Initial page translation sweep
  translatePage(activeLang);
  
  // Bind language switcher dropdown selections
  document.querySelectorAll('.lang-select').forEach(select => {
    select.value = activeLang;
    select.addEventListener('change', (e) => {
      setLanguage(e.target.value);
    });
  });
});

// Expose translation interface globally for inline scripts
window.i18n = {
  getLanguage,
  setLanguage,
  translateText,
  translatePage,
  translateElement
};
