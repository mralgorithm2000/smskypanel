<script setup lang="ts">
export interface MiniAppRequest {
  id: number | string
  type: 'service' | 'country' | string
  value?: string | null
  country?: { id?: number | string; name?: string | null } | null
  status: 'pending' | 'approved' | 'rejected' | string
  customer?: { id?: number | string } | null
  customer_identity?: {
    id?: number | string
    platform?: string | null
    external_id?: string | null
    language?: string | null
  } | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at?: string
}

interface Props {
  isDialogVisible: boolean
  request?: MiniAppRequest | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'saved', message: string): void
  (e: 'update:isDialogVisible', value: boolean): void
}>()

const ability = useAbility()
const { t } = useI18n()
const selectedStatus = ref<'approved' | 'rejected' | null>(null)
const isLoading = ref(false)
const generalError = ref('')
const statusError = ref<string | string[]>()

const statusOptions = computed(() => [
  { title: t('miniAppRequests.approved'), value: 'approved' },
  { title: t('miniAppRequests.rejected'), value: 'rejected' },
])

const requestLabel = computed(() => {
  if (props.request?.type === 'country')
    return props.request.country?.name || props.request.value || '—'

  return props.request?.value || props.request?.country?.name || '—'
})

watch(() => props.isDialogVisible, isVisible => {
  if (isVisible) {
    selectedStatus.value = null
    generalError.value = ''
    statusError.value = undefined
  }
})

const closeDialog = () => {
  if (!isLoading.value)
    emit('update:isDialogVisible', false)
}

const submit = async () => {
  if (!props.request || !selectedStatus.value || isLoading.value)
    return

  if (!ability.can('mini_app_requests.update', 'all')) {
    generalError.value = t('miniAppRequests.updateError')

    return
  }

  isLoading.value = true
  generalError.value = ''
  statusError.value = undefined

  try {
    await $api(`v1/admin/mini-app-requests/${props.request.id}`, {
      method: 'PATCH',
      body: { status: selectedStatus.value },
    })

    emit('update:isDialogVisible', false)
    emit('saved', t('miniAppRequests.updated'))
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    statusError.value = responseData?.errors?.status
    generalError.value = responseData?.message ?? t('miniAppRequests.updateError')
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="560"
    persistent
    @update:model-value="!isLoading && emit('update:isDialogVisible', $event)"
  >
    <VCard>
      <DialogCloseBtn
        :disabled="isLoading"
        @click="closeDialog"
      />

      <VCardItem class="text-center">
        <VCardTitle class="text-h4">
          {{ t('miniAppRequests.updateStatus') }}
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

        <VList
          v-if="request"
          density="compact"
          class="mb-4"
        >
          <VListItem
            :title="requestLabel"
            :subtitle="`${t('miniAppRequests.id')}: ${request.id}`"
          />
          <VListItem
            :title="request.country?.name || '—'"
            :subtitle="t('miniAppRequests.country')"
          />
          <VListItem
            :title="request.customer_identity?.external_id || '—'"
            :subtitle="t('miniAppRequests.telegramIdentity')"
          />
        </VList>

        <VForm @submit.prevent="submit">
          <AppSelect
            v-model="selectedStatus"
            :label="t('miniAppRequests.status')"
            :items="statusOptions"
            :disabled="isLoading"
            :error-messages="statusError"
          />

          <div class="d-flex justify-end gap-3 mt-6">
            <VBtn
              color="secondary"
              variant="tonal"
              :disabled="isLoading"
              @click="closeDialog"
            >
              {{ t('miniAppRequests.cancel') }}
            </VBtn>
            <VBtn
              type="submit"
              :loading="isLoading"
              :disabled="isLoading || !selectedStatus"
            >
              {{ t('miniAppRequests.update') }}
            </VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>
