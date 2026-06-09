/**
 * Internationalization (i18n) system for Redactix Editor
 */
import en from './en.js';
import ru from './ru.js';

// Available locales (kept minimal — add more as needed)
const locales = {
    en,
    ru
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
        // Normalize locale: if the requested one is unavailable, both locale
        // and translations roll back to the default consistently. Otherwise, isRTL()
        // could return true for an unknown code while translations
        // are shown in English.
        if (locales[locale]) {
            this.locale = locale;
            this.translations = locales[locale];
        } else {
            this.locale = DEFAULT_LOCALE;
            this.translations = locales[DEFAULT_LOCALE];
        }
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
