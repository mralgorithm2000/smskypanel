<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { VForm } from 'vuetify/components/VForm'

export interface Service {
  id: number | string
  name: string
  code: string
  sort_order?: number | null
  icon?: string | null
  is_active: boolean
  metadata?: Record<string, unknown>
  created_at: string
}

interface Props {
  isDialogVisible: boolean
  service?: Service | null
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
  code: '',
  sort_order: 0,
  icon: null as File | File[] | null,
  is_active: true,
  metadata: {} as Record<string, unknown>,
})

const isActive = (value: unknown) => value === true || value === 1 || value === '1'

const selectedIcon = computed(() => {
  if (Array.isArray(form.value.icon))
    return form.value.icon[0] ?? null

  return form.value.icon
})

const iconPreview = ref('')

watch(selectedIcon, file => {
  if (iconPreview.value)
    URL.revokeObjectURL(iconPreview.value)

  iconPreview.value = file ? URL.createObjectURL(file) : ''
})

onBeforeUnmount(() => {
  if (iconPreview.value)
    URL.revokeObjectURL(iconPreview.value)
})

const resetForm = () => {
  form.value = {
    name: props.service?.name ?? '',
    code: props.service?.code ?? '',
    sort_order: props.service?.sort_order ?? 0,
    icon: null,
    is_active: props.service ? isActive(props.service.is_active) : true,
    metadata: props.service?.metadata ?? {},
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
    const isEditing = Boolean(props.service)

    const payload = new FormData()

    payload.append('name', form.value.name)
    payload.append('code', form.value.code)
    payload.append('sort_order', String(form.value.sort_order))
    payload.append('is_active', form.value.is_active ? '1' : '0')
    payload.append('metadata', JSON.stringify(form.value.metadata))

    if (selectedIcon.value)
      payload.append('icon', selectedIcon.value)

    if (isEditing)
      payload.append('_method', 'PUT')

    await $api(isEditing ? `admin/services/${props.service?.id}` : 'admin/services', {
      method: 'POST',
      body: payload,
    })

    emit('update:isDialogVisible', false)
    emit('saved', isEditing ? 'Service updated successfully.' : 'Service created successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    errors.value = responseData?.errors ?? {}
    generalError.value = responseData?.message ?? 'Unable to save the service.'
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
          {{ service ? 'Edit Service' : 'Add Service' }}
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
                placeholder="Google"
                :rules="[requiredValidator]"
                :error-messages="errors.name"
              />
            </VCol>

            <VCol cols="12">
              <VFileInput
                v-model="form.icon"
                label="Icon"
                accept="image/*"
                prepend-icon="tabler-photo"
                clearable
                show-size
                :error-messages="errors.icon"
              />

              <div
                v-if="iconPreview || service?.icon"
                class="d-flex align-center gap-3 mt-3"
              >
                <VAvatar
                  rounded
                  size="56"
                  color="secondary"
                  variant="tonal"
                >
                  <VImg
                    :src="iconPreview || service?.icon || ''"
                    :alt="`${form.name || 'Service'} icon`"
                    cover
                  />
                </VAvatar>
                <span class="text-sm text-medium-emphasis">
                  {{ iconPreview ? 'New icon preview' : 'Current icon' }}
                </span>
              </div>
            </VCol>

            <VCol cols="12">
              <AppTextField
                v-model="form.code"
                label="Code"
                placeholder="google"
                :rules="[requiredValidator]"
                :error-messages="errors.code"
              />
            </VCol>

            <VCol cols="12">
              <AppTextField
                v-model.number="form.sort_order"
                label="Sort Order"
                type="number"
                step="1"
                :rules="[requiredValidator, integerValidator]"
                :error-messages="errors.sort_order"
              />
            </VCol>

            <VCol cols="12">
              <VSwitch
                v-model="form.is_active"
                label="Active"
                color="primary"
                :error-messages="errors.is_active"
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
