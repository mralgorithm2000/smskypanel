<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { VForm } from 'vuetify/components/VForm'

export interface Provider {
  id: number | string
  name: string
  code: string
  is_active: boolean
  configuration?: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface Props {
  provider?: Provider | null
  isDialogVisible: boolean
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
  is_active: true,
  configuration: {} as Record<string, unknown>,
})

const isActive = (value: unknown) => value === true || value === 1 || value === '1'

const resetForm = () => {
  form.value = {
    name: props.provider?.name ?? '',
    code: props.provider?.code ?? '',
    is_active: props.provider ? isActive(props.provider.is_active) : true,
    configuration: props.provider?.configuration ?? {},
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
    const isEditing = Boolean(props.provider)

    const payload = {
      name: form.value.name,
      code: form.value.code,
      is_active: Boolean(form.value.is_active),
      configuration: form.value.configuration,
    }

    await $api(isEditing ? `admin/providers/${props.provider?.id}` : 'admin/providers', {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    })

    emit('update:isDialogVisible', false)
    emit('saved', isEditing ? 'Provider updated successfully.' : 'Provider created successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    errors.value = responseData?.errors ?? {}
    generalError.value = responseData?.message ?? 'Unable to save the provider.'
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
          {{ provider ? 'Edit Provider' : 'Add Provider' }}
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
                placeholder="Example Provider"
                :rules="[requiredValidator]"
                :error-messages="errors.name"
              />
            </VCol>

            <VCol cols="12">
              <AppTextField
                v-model="form.code"
                label="Code"
                placeholder="example"
                :rules="[requiredValidator]"
                :error-messages="errors.code"
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
