<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { VForm } from 'vuetify/components/VForm'

export interface SelectOption {
  title: string
  value: number | string
}

export interface Offer {
  id: number | string
  name?: string | null
  sort_order?: number | null
  number_service_id?: number | string
  service_id?: number | string
  country_id?: number | string
  is_active: boolean
  metadata?: Record<string, unknown>
  created_at: string
  service?: { id?: number | string; name?: string; title?: string }
  country?: { id?: number | string; name?: string; title?: string }
  service_name?: string
  country_name?: string
}

interface Props {
  countries: SelectOption[]
  isDialogVisible: boolean
  offer?: Offer | null
  services: SelectOption[]
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
  number_service_id: null as number | string | null,
  country_id: null as number | string | null,
  sort_order: 0,
  is_active: true,
  metadata: {} as Record<string, unknown>,
})

const isActive = (value: unknown) => value === true || value === 1 || value === '1'

const resetForm = () => {
  form.value = {
    number_service_id: props.offer?.number_service_id
      ?? props.offer?.service_id
      ?? props.offer?.service?.id
      ?? null,
    country_id: props.offer?.country_id ?? props.offer?.country?.id ?? null,
    sort_order: props.offer?.sort_order ?? 0,
    is_active: props.offer ? isActive(props.offer.is_active) : true,
    metadata: props.offer?.metadata ?? {},
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
    const isEditing = Boolean(props.offer)

    const payload = {
      number_service_id: form.value.number_service_id,
      country_id: form.value.country_id,
      sort_order: Number(form.value.sort_order),
      is_active: Boolean(form.value.is_active),
      metadata: form.value.metadata,
    }

    await $api(isEditing ? `admin/offers/${props.offer?.id}` : 'admin/offers', {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    })

    if (isEditing) {
      emit('update:isDialogVisible', false)
    }
    else {
      form.value.country_id = null
      errors.value = {}
      generalError.value = ''
      nextTick(() => refForm.value?.resetValidation())
    }

    emit('saved', isEditing ? 'Offer updated successfully.' : 'Offer created successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    errors.value = responseData?.errors ?? {}
    generalError.value = responseData?.message ?? 'Unable to save the offer.'
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
          {{ offer ? 'Edit Offer' : 'Add Offer' }}
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
            <VCol
              cols="12"
              sm="6"
            >
              <AppAutocomplete
                v-model="form.number_service_id"
                label="Service"
                placeholder="Select service"
                :items="services"
                :rules="[requiredValidator]"
                :error-messages="errors.number_service_id"
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
            >
              <AppAutocomplete
                v-model="form.country_id"
                label="Country"
                placeholder="Select country"
                :items="countries"
                :rules="[requiredValidator]"
                :error-messages="errors.country_id"
              />
            </VCol>

            <VCol
              cols="12"
              sm="6"
            >
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
