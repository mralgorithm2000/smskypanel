<script setup lang="ts">
import { VForm } from 'vuetify/components/VForm'
import { useGenerateImageVariant } from '@core/composable/useGenerateImageVariant'
import authV2LoginIllustrationBorderedDark from '@images/pages/auth-v2-login-illustration-bordered-dark.png'
import authV2LoginIllustrationBorderedLight from '@images/pages/auth-v2-login-illustration-bordered-light.png'
import authV2LoginIllustrationDark from '@images/pages/auth-v2-login-illustration-dark.png'
import authV2LoginIllustrationLight from '@images/pages/auth-v2-login-illustration-light.png'
import authV2MaskDark from '@images/pages/misc-mask-dark.png'
import authV2MaskLight from '@images/pages/misc-mask-light.png'
import { VNodeRenderer } from '@layouts/components/VNodeRenderer'
import { themeConfig } from '@themeConfig'

definePage({
  meta: {
    layout: 'blank',
    unauthenticatedOnly: true,
  },
})

interface Permission {
  name?: string
  action?: string
  subject?: string
}

interface LoginResponse {
  data: {
    token: string
    token_type: string
    user: Record<string, any> & {
      permissions?: Array<string | Permission>
    }
  }
}

const route = useRoute()
const router = useRouter()
const ability = useAbility()
const refVForm = ref<VForm>()

const form = ref({
  email: '',
  password: '',
})

const isPasswordVisible = ref(false)
const isLoading = ref(false)
const loginError = ref('')
const errors = ref<Record<string, string | undefined>>({})

const authCookieOptions = {
  maxAge: 60 * 60 * 24 * 30,
  sameSite: 'lax' as const,
}

const permissionRules = (permissions: Array<string | Permission> = []) => permissions
  .map(permission => {
    if (typeof permission === 'string')
      return { action: permission, subject: 'all' }

    if (permission.action && permission.subject)
      return { action: permission.action, subject: permission.subject }

    return permission.name ? { action: permission.name, subject: 'all' } : undefined
  })
  .filter((rule): rule is { action: string; subject: string } => Boolean(rule))

const login = async () => {
  isLoading.value = true
  loginError.value = ''
  errors.value = {}

  try {
    const response = await $api<LoginResponse>('admin/auth/login', {
      method: 'POST',
      body: form.value,
    })

    const { token, user } = response.data
    const userAbilityRules = permissionRules(user.permissions)

    useCookie('userAbilityRules', authCookieOptions).value = userAbilityRules
    localStorage.setItem('userAbilityRules', JSON.stringify(userAbilityRules))
    ability.update(userAbilityRules)
    useCookie('userData', authCookieOptions).value = user
    useCookie('accessToken', authCookieOptions).value = token

    await nextTick()
    await router.replace(route.query.to ? String(route.query.to) : '/dashboard')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    errors.value = responseData?.errors ?? {}
    loginError.value = responseData?.message ?? 'Unable to sign in. Please check your credentials.'
  }
  finally {
    isLoading.value = false
  }
}

const onSubmit = async () => {
  const { valid } = await refVForm.value?.validate() ?? { valid: false }

  if (valid)
    await login()
}

const authThemeImg = useGenerateImageVariant(
  authV2LoginIllustrationLight,
  authV2LoginIllustrationDark,
  authV2LoginIllustrationBorderedLight,
  authV2LoginIllustrationBorderedDark,
  true)

const authThemeMask = useGenerateImageVariant(authV2MaskLight, authV2MaskDark)
</script>

<template>
  <VRow
    no-gutters
    class="auth-wrapper bg-surface"
  >
    <VCol
      md="8"
      class="d-none d-md-flex"
    >
      <div class="position-relative bg-background rounded-lg w-100 ma-8 me-0">
        <div class="d-flex align-center justify-center w-100 h-100">
          <VImg
            max-width="505"
            :src="authThemeImg"
            class="auth-illustration mt-16 mb-2"
          />
        </div>

        <VImg
          class="auth-footer-mask"
          :src="authThemeMask"
        />
      </div>
    </VCol>

    <VCol
      cols="12"
      md="4"
      class="auth-card-v2 d-flex align-center justify-center"
    >
      <VCard
        flat
        :max-width="500"
        class="mt-12 mt-sm-0 pa-4"
      >
        <VCardText>
          <VNodeRenderer
            :nodes="themeConfig.app.logo"
            class="mb-6"
          />
          <h4 class="text-h4 mb-1">
            Welcome to <span class="text-capitalize">{{ themeConfig.app.title }}</span>! 👋🏻
          </h4>
          <p class="mb-0">
            Please sign-in to your account and start the adventure
          </p>
        </VCardText>
        <VCardText>
          <VForm
            ref="refVForm"
            @submit.prevent="onSubmit"
          >
            <VRow>
              <VCol
                v-if="loginError"
                cols="12"
              >
                <VAlert
                  color="error"
                  variant="tonal"
                >
                  {{ loginError }}
                </VAlert>
              </VCol>

              <!-- email -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.email"
                  autofocus
                  label="Email"
                  type="email"
                  placeholder="johndoe@email.com"
                  :rules="[requiredValidator, emailValidator]"
                  :error-messages="errors.email"
                />
              </VCol>

              <!-- password -->
              <VCol cols="12">
                <AppTextField
                  v-model="form.password"
                  label="Password"
                  placeholder="············"
                  :rules="[requiredValidator]"
                  :error-messages="errors.password"
                  :type="isPasswordVisible ? 'text' : 'password'"
                  :append-inner-icon="isPasswordVisible ? 'tabler-eye-off' : 'tabler-eye'"
                  @click:append-inner="isPasswordVisible = !isPasswordVisible"
                />

                <VBtn
                  block
                  type="submit"
                  class="mt-4"
                  :loading="isLoading"
                  :disabled="isLoading"
                >
                  Login
                </VBtn>
              </VCol>
            </VRow>
          </VForm>
        </VCardText>
      </VCard>
    </VCol>
  </VRow>
</template>

<style lang="scss">
@use "@core/scss/template/pages/page-auth.scss";
</style>
