<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { VForm } from 'vuetify/components/VForm'

export interface RoleOption {
  title: string
  value: number | string
}

export interface AdminUser {
  id: number | string
  name: string
  email: string
  status: string
  roles: Array<string | { name?: string }>
  created_at: string
}

interface Props {
  admin?: AdminUser | null
  isDialogVisible: boolean
  roles: RoleOption[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'saved', message: string): void
  (e: 'update:isDialogVisible', value: boolean): void
}>()

const refForm = ref<VForm>()
const isLoading = ref(false)
const generalError = ref('')
const errors = ref<Record<string, string | string[] | undefined>>({})

const form = ref({
  name: '',
  email: '',
  password: '',
  status: 'active',
  role: null as number | string | null,
})

const roleValue = (role: AdminUser['roles'][number] | undefined) => typeof role === 'string'
  ? role
  : role?.name ?? null

const resetForm = () => {
  form.value = {
    name: props.admin?.name ?? '',
    email: props.admin?.email ?? '',
    password: '',
    status: props.admin?.status ?? 'active',
    role: roleValue(props.admin?.roles?.[0]),
  }
  generalError.value = ''
  errors.value = {}
  nextTick(() => refForm.value?.resetValidation())
}

watch(() => props.isDialogVisible, isVisible => {
  if (isVisible)
    resetForm()
})

const closeDialog = () => {
  if (!isLoading.value)
    emit('update:isDialogVisible', false)
}

const submit = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: false }

  if (!valid)
    return

  isLoading.value = true
  generalError.value = ''
  errors.value = {}

  try {
    const isEditing = Boolean(props.admin)

    await $api(isEditing ? `admin/users/${props.admin?.id}` : 'admin/users', {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(form.value),
    })

    emit('update:isDialogVisible', false)
    emit('saved', isEditing ? 'Admin updated successfully.' : 'Admin created successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    errors.value = responseData?.errors ?? {}
    generalError.value = responseData?.message ?? 'Unable to save the admin.'
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="600"
    persistent
    @update:model-value="emit('update:isDialogVisible', $event)"
  >
    <VCard>
      <DialogCloseBtn
        :disabled="isLoading"
        @click="closeDialog"
      />

      <VCardItem class="text-center">
        <VCardTitle class="text-h4">
          {{ admin ? 'Edit Admin' : 'Add Admin' }}
        </VCardTitle>
      </VCardItem>

      <VCardText>
        <VAlert
          v-if="generalError"
          color="error"
          variant="tonal"
          class="mb-5"
        >
          {{ generalError }}
        </VAlert>

        <VForm
          ref="refForm"
          @submit.prevent="submit"
        >
          <VRow>
            <VCol cols="12">
              <AppTextField
                v-model="form.name"
                label="Name"
                placeholder="New Admin"
                :rules="[requiredValidator]"
                :error-messages="errors.name"
              />
            </VCol>

            <VCol cols="12">
              <AppTextField
                v-model="form.email"
                label="Email"
                type="email"
                placeholder="new-admin@example.com"
                :rules="[requiredValidator, emailValidator]"
                :error-messages="errors.email"
              />
            </VCol>

            <VCol cols="12">
              <AppTextField
                v-model="form.password"
                label="Password"
                type="password"
                placeholder="············"
                :error-messages="errors.password"
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
            >
              <AppAutocomplete
                v-model="form.status"
                label="Status"
                :items="[
                  { title: 'Active', value: 'active' },
                  { title: 'Disabled', value: 'disabled' },
                ]"
                :rules="[requiredValidator]"
                :error-messages="errors.status"
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
            >
              <AppAutocomplete
                v-model="form.role"
                label="Role"
                placeholder="Select role"
                :items="roles"
                :rules="[requiredValidator]"
                :error-messages="errors.role"
              />
            </VCol>

            <VCol
              cols="12"
              class="d-flex justify-end gap-3"
            >
              <VBtn
                color="secondary"
                variant="tonal"
                :disabled="isLoading"
                @click="closeDialog"
              >
                Cancel
              </VBtn>
              <VBtn
                type="submit"
                :loading="isLoading"
                :disabled="isLoading"
              >
                Save
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
