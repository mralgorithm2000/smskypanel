<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { VForm } from 'vuetify/components/VForm'

export interface PermissionOption {
  title: string
  value: string
}

export interface Role {
  id: number | string
  name: string
  permissions: Array<string | { name?: string; value?: string }>
  created_at: string
  updated_at: string
}

interface Props {
  isDialogVisible: boolean
  permissionOptions: PermissionOption[]
  role?: Role | null
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
  permissions: [] as string[],
})

const permissionValue = (permission: Role['permissions'][number]) => typeof permission === 'string'
  ? permission
  : permission.value ?? permission.name ?? ''

const groupedPermissions = computed(() => props.permissionOptions.reduce<Record<string, PermissionOption[]>>((groups, permission) => {
  const separatorIndex = permission.value.lastIndexOf('.')
  const subject = separatorIndex === -1 ? 'other' : permission.value.slice(0, separatorIndex)

  if (!groups[subject])
    groups[subject] = []

  groups[subject].push(permission)

  return groups
}, {}))

const permissionAction = (permission: PermissionOption) => {
  const separatorIndex = permission.value.lastIndexOf('.')

  return separatorIndex === -1 ? permission.title : permission.value.slice(separatorIndex + 1)
}

const togglePermission = (permission: string, enabled: boolean | null) => {
  if (enabled && !form.value.permissions.includes(permission))
    form.value.permissions.push(permission)
  else if (!enabled)
    form.value.permissions = form.value.permissions.filter(value => value !== permission)

  errors.value.permissions = undefined
}

const resetForm = () => {
  form.value = {
    name: props.role?.name ?? '',
    permissions: props.role?.permissions?.map(permissionValue).filter(Boolean) ?? [],
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

  if (!form.value.permissions.length) {
    errors.value.permissions = ['Select at least one permission.']

    return
  }

  isLoading.value = true
  generalError.value = ''
  errors.value = {}

  try {
    const isEditing = Boolean(props.role)

    await $api(isEditing ? `admin/roles/${props.role?.id}` : 'admin/roles', {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(form.value),
    })

    emit('update:isDialogVisible', false)
    emit('saved', isEditing ? 'Role updated successfully.' : 'Role created successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    errors.value = responseData?.errors ?? {}
    generalError.value = responseData?.message ?? 'Unable to save the role.'
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="700"
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
          {{ role ? 'Edit Role' : 'Add Role' }}
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
                placeholder="content_manager"
                :rules="[requiredValidator]"
                :error-messages="errors.name"
              />
            </VCol>

            <VCol cols="12">
              <VLabel class="mb-3 text-body-2 text-high-emphasis">
                Permissions
              </VLabel>

              <div class="d-flex flex-column gap-4">
                <VCard
                  v-for="(permissions, subject) in groupedPermissions"
                  :key="subject"
                  variant="outlined"
                >
                  <VCardText class="py-2 px-3">
                    <VRow
                      align="center"
                      no-gutters
                    >
                      <VCol
                        cols="12"
                        sm="3"
                        class="text-capitalize font-weight-medium py-1"
                      >
                        {{ subject }}
                      </VCol>

                      <VCol
                        cols="12"
                        sm="9"
                        class="d-flex flex-wrap gap-x-4"
                      >
                        <VSwitch
                          v-for="permission in permissions"
                          :key="permission.value"
                          :model-value="form.permissions.includes(permission.value)"
                          :label="permissionAction(permission)"
                          color="primary"
                          density="compact"
                          hide-details
                          class="text-capitalize"
                          style="min-inline-size: 7rem;"
                          @update:model-value="togglePermission(permission.value, $event)"
                        />
                      </VCol>
                    </VRow>
                  </VCardText>
                </VCard>
              </div>

              <div
                v-if="errors.permissions"
                class="text-error text-caption mt-2"
              >
                {{ Array.isArray(errors.permissions) ? errors.permissions[0] : errors.permissions }}
              </div>
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
