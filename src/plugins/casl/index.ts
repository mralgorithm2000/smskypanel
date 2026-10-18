import type { App } from 'vue'

import { createMongoAbility } from '@casl/ability'
import { abilitiesPlugin } from '@casl/vue'
import type { Rule } from './ability'

export default function (app: App) {
  const userAbilityRules = useCookie<Rule[]>('userAbilityRules')
  let storedAbilityRules: Rule[] = []

  try {
    const storedValue = localStorage.getItem('userAbilityRules')

    if (storedValue) {
      const parsedValue = JSON.parse(storedValue)

      if (Array.isArray(parsedValue))
        storedAbilityRules = parsedValue
    }
  }
  catch {
    localStorage.removeItem('userAbilityRules')
  }

  const initialAbility = createMongoAbility(storedAbilityRules.length
    ? storedAbilityRules
    : userAbilityRules.value ?? [])

  app.use(abilitiesPlugin, initialAbility, {
    useGlobalProperties: true,
  })
}
