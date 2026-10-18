import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import ar from './locales/ar.json'
import en from './locales/en.json'
import fr from './locales/fr.json'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { ar, en, fr },
})

export default function (app: App) {
  app.use(i18n)
}
