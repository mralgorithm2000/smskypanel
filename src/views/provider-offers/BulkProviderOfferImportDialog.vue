<script setup lang="ts">
import type { SelectOption } from '@/views/provider-offers/ProviderOfferFormDialog.vue'

const props = defineProps<{
  isDialogVisible: boolean
  providers: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'imported', message: string): void
  (e: 'update:isDialogVisible', value: boolean): void
}>()

const providerId = ref<number | string | null>(null)
const externalServiceId = ref('')
const selectedFile = ref<File | null>(null)
const isImporting = ref(false)
const errorMessage = ref('')
const importResults = ref<string[]>([])
const fieldErrors = ref<Record<string, string | string[] | undefined>>({})
const fileInput = ref<HTMLInputElement>()

const fileError = computed(() => selectedFile.value && !/\.xlsx?$/i.test(selectedFile.value.name)
  ? 'Choose an Excel file with an .xlsx or .xls extension.'
  : '')

const trimmedServiceId = computed(() => externalServiceId.value.trim())

const canSubmit = computed(() => providerId.value !== null
  && providerId.value !== ''
  && Boolean(trimmedServiceId.value)
  && Boolean(selectedFile.value)
  && !fileError.value
  && !isImporting.value)

const resetForm = () => {
  providerId.value = null
  externalServiceId.value = ''
  selectedFile.value = null
  errorMessage.value = ''
  importResults.value = []
  fieldErrors.value = {}
  if (fileInput.value)
    fileInput.value.value = ''
}

watch(() => props.isDialogVisible, visible => {
  if (visible)
    resetForm()
})

const closeDialog = () => {
  if (!isImporting.value)
    emit('update:isDialogVisible', false)
}

const valuesFor = (value: any): string[] => {
  if (Array.isArray(value))
    return value.flatMap(valuesFor)
  if (value && typeof value === 'object') {
    const row = value.row ?? value.row_number
    const message = value.message ?? value.error ?? value.errors
    if (message)
      return valuesFor(message).map(item => row ? `Row ${row}: ${item}` : item)

    return Object.entries(value).flatMap(([key, nested]) => valuesFor(nested).map(item => `${key}: ${item}`))
  }

  return value == null || value === '' ? [] : [String(value)]
}

const parseImportDetails = (data: any) => {
  const result = data?.result ?? data?.data?.result ?? data?.data ?? data
  const summary: string[] = []

  for (const [key, label] of [['imported', 'Imported'], ['success_count', 'Imported'], ['failed', 'Failed'], ['failed_count', 'Failed'], ['total', 'Total']] as const) {
    if (result?.[key] !== undefined && !summary.some(item => item.startsWith(`${label}:`)))
      summary.push(`${label}: ${result[key]}`)
  }

  const failures = [result?.row_errors, result?.errors, result?.failures, result?.failed_rows]
    .filter(Boolean)
    .flatMap(valuesFor)

  const countries = result?.unknown_countries

  if (Array.isArray(countries) && countries.length)
    failures.push(`Unknown countries: ${countries.join(', ')}`)

  return { summary, failures: [...new Set(failures)] }
}

const normalizeFieldErrors = (errors: any) => {
  if (!errors || typeof errors !== 'object')
    return {}

  return Object.fromEntries(Object.entries(errors).map(([key, value]) => [key, valuesFor(value)])) as Record<string, string[]>
}

const submit = async () => {
  if (!canSubmit.value || !selectedFile.value)
    return

  isImporting.value = true
  errorMessage.value = ''
  importResults.value = []
  fieldErrors.value = {}

  const formData = new FormData()

  formData.append('provider_id', String(providerId.value))
  formData.append('external_service_id', trimmedServiceId.value)
  formData.append('file', selectedFile.value)

  try {
    const response: any = await $api('v1/admin/provider-offers/bulk-import', {
      method: 'POST',
      body: formData,
    })

    const { summary, failures } = parseImportDetails(response)
    const failedCount = Number(response?.failed_count ?? response?.failed ?? response?.data?.failed_count ?? 0)

    if (failures.length || failedCount > 0 || response?.success === false || response?.status === 'partial') {
      errorMessage.value = 'The import completed with row errors. Review the results below.'
      importResults.value = [...summary, ...failures]

      return
    }

    emit('update:isDialogVisible', false)
    emit('imported', response?.message ?? response?.data?.message ?? 'Provider offers imported successfully.')
  }
  catch (error: any) {
    const data = error?.data ?? error?.response?._data

    fieldErrors.value = normalizeFieldErrors(data?.errors)
    errorMessage.value = data?.message
      ?? (error?.response ? 'The server could not process the import. Please review the form and try again.' : 'Unable to reach the server. Check your connection and try again.')
    importResults.value = parseImportDetails(data).failures
  }
  finally {
    isImporting.value = false
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
        :disabled="isImporting"
        @click="closeDialog"
      />
      <VCardItem class="text-center">
        <VCardTitle class="text-h4">
          Bulk Import Provider Offers
        </VCardTitle>
      </VCardItem>
      <VCardText>
        <VAlert
          v-if="errorMessage"
          color="error"
          variant="tonal"
          class="mb-5"
        >
          {{ errorMessage }}
        </VAlert>
        <VAlert
          v-if="importResults.length"
          color="warning"
          variant="tonal"
          class="mb-5"
        >
          <ul>
            <li
              v-for="(item, index) in importResults"
              :key="`${index}-${item}`"
            >
              {{ item }}
            </li>
          </ul>
        </VAlert>

        <VForm @submit.prevent="submit">
          <VRow>
            <VCol cols="12">
              <AppAutocomplete
                v-model="providerId"
                label="Provider"
                placeholder="Select a provider"
                :items="providers"
                :disabled="isImporting"
                :error-messages="fieldErrors.provider_id"
                clearable
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="externalServiceId"
                label="External Service ID"
                placeholder="Enter external service ID"
                :disabled="isImporting"
                :error-messages="fieldErrors.external_service_id"
              />
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
                :disabled="isImporting"
                :error-messages="[fileError, ...(fieldErrors.file ?? [])].filter(Boolean)"
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
              v-if="isImporting"
              cols="12"
              class="d-flex align-center gap-3"
            >
              <VProgressCircular
                indeterminate
                size="20"
              />
              <span>Importing provider offers…</span>
            </VCol>
            <VCol
              cols="12"
              class="d-flex justify-end gap-3"
            >
              <VBtn
                color="secondary"
                variant="tonal"
                :disabled="isImporting"
                @click="closeDialog"
              >
                Cancel
              </VBtn>
              <VBtn
                type="submit"
                :loading="isImporting"
                :disabled="!canSubmit"
              >
                Import
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
