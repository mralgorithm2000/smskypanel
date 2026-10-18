import type { Router } from 'vue-router'
import { canNavigate } from '@layouts/plugins/casl'

export const setupGuards = (router: Router) => {
  router.beforeEach(to => {
    if (to.meta.public)
      return

    const isLoggedIn = Boolean(useCookie('userData').value && useCookie('accessToken').value)

    if (to.meta.unauthenticatedOnly)
      return isLoggedIn ? '/dashboard' : undefined

    if (!isLoggedIn) {
      return {
        name: 'login',
        query: {
          ...to.query,
          to: to.fullPath !== '/' ? to.fullPath : undefined,
        },
      }
    }

    if (!canNavigate(to))
      return { name: 'not-authorized' }
  })
}
