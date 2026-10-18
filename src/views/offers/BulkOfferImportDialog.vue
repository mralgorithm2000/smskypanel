<script setup lang="ts">
import type { SelectOption } from '@/views/offers/OfferFormDialog.vue'

interface ServiceOption extends SelectOption {
  id?: number | string
}

const props = defineProps<{
  isDialogVisible: boolean
}>()

const emit = defineEmits<{
  (e: 'imported', message: string): void
  (e: 'update:isDialogVisible', value: boolean): void
}>()

const services = ref<ServiceOption[]>([])
const selectedServiceId = ref<number | null>(null)
const selectedFile = ref<File | null>(null)
const isLoadingServices = ref(false)
const isUploading = ref(false)
const serviceLoadError = ref('')
const generalError = ref('')
const fieldErrors = ref<Record<string, string | string[] | undefined>>({})
const fileInput = ref<HTMLInputElement>()

const fileError = computed(() => {
  if (!selectedFile.value)
    return ''

  return /\.xlsx?$/i.test(selectedFile.value.name)
    ? ''
    : 'Choose an Excel file with an .xlsx or .xls extension.'
})

const canSubmit = computed(() => selectedServiceId.value !== null
  && selectedServiceId.value !== ''
  && Boolean(selectedFile.value)
  && !fileError.value
  && !isUploading.value
  && !isLoadingServices.value)

const serviceOptions = computed(() => services.value.map(service => ({
  title: service.title ?? (service as any).name ?? String(service.value),
  value: service.value,
})))

const loadServices = async () => {
  isLoadingServices.value = true
  serviceLoadError.value = ''

  try {
    const response: any = await $api('admin/services/all')
    const payload = response.data ?? response
    const records = payload.services ?? payload.data?.services ?? []

    services.value = records
      .filter((service: any) => Number.isInteger(Number(service.id)))
      .map((service: any) => ({
        title: service.name ?? service.title ?? String(service.id),
        value: Number(service.id),
        id: Number(service.id),
      }))
  }
  catch (error: any) {
    const data = error?.data ?? error?.response?._data

    serviceLoadError.value = data?.message ?? 'Unable to load services. Please try again.'
  }
  finally {
    isLoadingServices.value = false
  }
}

const resetForm = () => {
  selectedServiceId.value = null
  selectedFile.value = null
  generalError.value = ''
  fieldErrors.value = {}
  serviceLoadError.value = ''
  if (fileInput.value)
    fileInput.value.value = ''
  loadServices()
}

watch(() => props.isDialogVisible, visible => {
  if (visible)
    resetForm()
})

const closeDialog = () => {
  if (!isUploading.value)
    emit('update:isDialogVisible', false)
}

const normalizeErrors = (errors: any) => {
  if (!errors || typeof errors !== 'object')
    return {}

  return Object.fromEntries(Object.entries(errors).map(([key, value]) => [
    key,
    Array.isArray(value) ? value.map(String) : String(value),
  ])) as Record<string, string | string[]>
}

const errorDetails = (data: any) => {
  const details: string[] = []
  const candidates = [data?.row_errors, data?.errors, data?.unknown_countries, data?.data?.row_errors, data?.data?.unknown_countries]

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const message = typeof item === 'string' ? item : item?.message ?? item?.error
        const row = item?.row ?? item?.row_number
        const text = message ? (row ? `Row ${row}: ${message}` : message) : JSON.stringify(item)

        if (text && !details.includes(text))
          details.push(text)
      }
    }
    else if (candidate && typeof candidate === 'object') {
      for (const [key, value] of Object.entries(candidate)) {
        const messages = Array.isArray(value) ? value : [value]

        messages.forEach(message => details.push(`${key}: ${String(message)}`))
      }
    }
  }

  const unknownCountries = data?.unknown_countries ?? data?.data?.unknown_countries

  if (Array.isArray(unknownCountries) && unknownCountries.length)
    details.push(`Unknown countries: ${unknownCountries.join(', ')}`)

  return [...new Set(details)]
}

const submit = async () => {
  if (!canSubmit.value || !selectedFile.value)
    return

  isUploading.value = true
  generalError.value = ''
  fieldErrors.value = {}

  const formData = new FormData()

  formData.append('service_id', String(Number(selectedServiceId.value)))
  formData.append('file', selectedFile.value)

  try {
    const response: any = await $api('admin/offers/bulk-import', {
      method: 'POST',
      body: formData,
    })

    emit('update:isDialogVisible', false)
    emit('imported', response?.message ?? response?.data?.message ?? 'Offers imported successfully.')
  }
  catch (error: any) {
    const data = error?.data ?? error?.response?._data

    fieldErrors.value = normalizeErrors(data?.errors)

    const details = errorDetails(data)

    generalError.value = data?.message ?? 'Unable to import offers. Check the file and try again.'

    if (details.length)
      generalError.value = `${generalError.value}\n${details.join('\n')}`
  }
  finally {
    isUploading.value = false
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
        :disabled="isUploading"
        @click="closeDialog"
      />

      <VCardItem class="text-center">
        <VCardTitle class="text-h4">
          Import Bulk Offers
        </VCardTitle>
      </VCardItem>

      <VCardText>
        <VAlert
          v-if="generalError"
          color="error"
          variant="tonal"
          class="mb-5"
          style="white-space: pre-line;"
        >
          {{ generalError }}
        </VAlert>

        <VForm @submit.prevent="submit">
          <VRow>
            <VCol cols="12">
              <AppAutocomplete
                v-model="selectedServiceId"
                label="Service"
                placeholder="Search and select a service"
                :items="serviceOptions"
                :loading="isLoadingServices"
                :disabled="isUploading || isLoadingServices || Boolean(serviceLoadError)"
                :error-messages="fieldErrors.service_id"
                clearable
              />
              <VAlert
                v-if="serviceLoadError"
                color="error"
                variant="tonal"
                class="mt-3"
              >
                <div class="d-flex align-center justify-space-between gap-3">
                  <span>{{ serviceLoadError }}</span>
                  <VBtn
                    size="small"
                    variant="tonal"
                    :disabled="isUploading || isLoadingServices"
                    @click="loadServices"
                  >
                    Retry
                  </VBtn>
                </div>
              </VAlert>
            </VCol>

            <VCol cols="12">
              <VFileInput
                ref="fileInput"
                :model-value="selectedFile"
                label="Excel file"
                placeholder="Select an .xlsx or .xls file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                prepend-icon="tabler-file-spreadsheet"
                show-size
                clearable
                :disabled="isUploading"
                :error-messages="[fileError, ...(fieldErrors.file ? (Array.isArray(fieldErrors.file) ? fieldErrors.file : [fieldErrors.file]) : [])].filter(Boolean)"
                @update:model-value="selectedFile = Array.isArray($event) ? ($event[0] ?? null) : $event"
              />
              <div
                v-if="selectedFile"
                class="text-caption text-medium-emphasis mt-1"
              >
                Selected: {{ selectedFile.name }}
              </div>
            </VCol>

            <VCol
              cols="12"
              class="d-flex justify-end gap-3"
            >
              <VBtn
                color="secondary"
                variant="tonal"
                :disabled="isUploading"
                @click="closeDialog"
              >
                Cancel
              </VBtn>
              <VBtn
                type="submit"
                :loading="isUploading"
                :disabled="!canSubmit"
              >
                Add
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
