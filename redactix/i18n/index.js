/**
 * Internationalization (i18n) system for Redactix Editor
 */
import en from './en.js';
import ru from './ru.js';
import fr from './fr.js';
import es from './es.js';
import pt from './pt.js';
import uk from './uk.js';
import pl from './pl.js';
import de from './de.js';
import sr from './sr.js';
import ka from './ka.js';
import sw from './sw.js';
import vi from './vi.js';
import th from './th.js';
import tr from './tr.js';
import ar from './ar.js';
import he from './he.js';
import ja from './ja.js';
import ko from './ko.js';
import zh from './zh.js';
import kk from './kk.js';
import uz from './uz.js';

// Available locales
const locales = {
    en,
    ru,
    fr,
    es,
    pt,
    uk,
    pl,
    de,
    sr,
    ka,
    sw,
    vi,
    th,
    tr,
    ar,
    he,
    ja,
    ko,
    zh,
    kk,
    uz
};

// RTL (Right-to-Left) locales
const rtlLocales = ['ar', 'he', 'fa', 'ur'];

// Default locale
const DEFAULT_LOCALE = 'en';

/**
 * I18n class for managing translations
 */
class I18n {
    constructor(locale = DEFAULT_LOCALE) {
        this.locale = locale;
        this.translations = locales[locale] || locales[DEFAULT_LOCALE];
    }
    
    /**
     * Set the current locale
     * @param {string} locale - Locale code (e.g., 'en', 'ru')
     */
    setLocale(locale) {
        if (locales[locale]) {
            this.locale = locale;
            this.translations = locales[locale];
        } else {
            console.warn(`Redactix: Locale "${locale}" not found, using default "${DEFAULT_LOCALE}"`);
            this.locale = DEFAULT_LOCALE;
            this.translations = locales[DEFAULT_LOCALE];
        }
    }
    
    /**
     * Check if current locale is RTL (Right-to-Left)
     * @returns {boolean}
     */
    isRTL() {
        return rtlLocales.includes(this.locale);
    }
    
    /**
     * Get translation by key path (dot notation)
     * @param {string} key - Translation key (e.g., 'toolbar.bold', 'image.title')
     * @param {object} params - Optional parameters for interpolation
     * @returns {string} - Translated string or key if not found
     */
    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // Key not found, return the key itself
                console.warn(`Redactix i18n: Translation key "${key}" not found for locale "${this.locale}"`);
                return key;
            }
        }
        
        if (typeof value !== 'string') {
            return key;
        }
        
        // Simple interpolation: replace {paramName} with params.paramName
        if (Object.keys(params).length > 0) {
            return value.replace(/\{(\w+)\}/g, (match, paramName) => {
                return params[paramName] !== undefined ? params[paramName] : match;
            });
        }
        
        return value;
    }
    
    /**
     * Get current locale code
     * @returns {string}
     */
    getLocale() {
        return this.locale;
    }
    
    /**
     * Get list of available locales
     * @returns {string[]}
     */
    getAvailableLocales() {
        return Object.keys(locales);
    }
}

export default I18n;
export { locales, DEFAULT_LOCALE };
