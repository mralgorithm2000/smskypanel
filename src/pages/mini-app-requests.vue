<script setup lang="ts">
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import MiniAppRequestStatusDialog from '@/views/mini-app-requests/MiniAppRequestStatusDialog.vue'
import type { MiniAppRequest } from '@/views/mini-app-requests/MiniAppRequestStatusDialog.vue'

definePage({
  meta: {
    action: 'mini_app_requests.view',
    subject: 'all',
  },
})

const ability = useAbility()
const { t } = useI18n()
const selectedStatus = ref<'pending' | 'approved' | 'rejected' | null>(null)
const itemsPerPage = ref(15)
const page = ref(1)
const requests = ref<MiniAppRequest[]>([])
const total = ref(0)
const lastPage = ref(1)
const paginationFrom = ref(0)
const paginationTo = ref(0)
const isLoading = ref(false)
const listError = ref('')
const isStatusDialogVisible = ref(false)
const selectedRequest = ref<MiniAppRequest | null>(null)
const isSnackbarVisible = ref(false)
const snackbarMessage = ref('')

const canUpdate = computed(() => ability.can('mini_app_requests.update', 'all'))

const headers = computed(() => [
  { title: t('miniAppRequests.id'), key: 'id', sortable: false },
  { title: t('miniAppRequests.type'), key: 'type', sortable: false },
  { title: t('miniAppRequests.request'), key: 'request', sortable: false },
  { title: t('miniAppRequests.country'), key: 'country', sortable: false },
  { title: t('miniAppRequests.status'), key: 'status', sortable: false },
  { title: t('miniAppRequests.customer'), key: 'customer', sortable: false },
  { title: t('miniAppRequests.telegramIdentity'), key: 'telegram_identity', sortable: false },
  { title: t('miniAppRequests.language'), key: 'language', sortable: false },
  { title: t('miniAppRequests.createdAt'), key: 'created_at', sortable: false },
  ...(canUpdate.value ? [{ title: t('miniAppRequests.actions'), key: 'actions', sortable: false }] : []),
])

const statusOptions = computed(() => [
  { title: t('miniAppRequests.all'), value: null },
  { title: t('miniAppRequests.pending'), value: 'pending' },
  { title: t('miniAppRequests.approved'), value: 'approved' },
  { title: t('miniAppRequests.rejected'), value: 'rejected' },
])

const statusLabel = (status: string) => {
  const supportedStatuses = ['pending', 'approved', 'rejected']

  return supportedStatuses.includes(status) ? t(`miniAppRequests.${status}`) : t('miniAppRequests.unknown')
}

const statusColor = (status: string) => ({
  approved: 'success',
  pending: 'warning',
  rejected: 'error',
}[status] ?? 'secondary')

const typeLabel = (type: string) => {
  if (type === 'service' || type === 'country')
    return t(`miniAppRequests.${type}`)

  return t('miniAppRequests.unknown')
}

const requestLabel = (request: MiniAppRequest) => request.type === 'country'
  ? request.country?.name || request.value || '—'
  : request.value || request.country?.name || '—'

const fetchRequests = async () => {
  isLoading.value = true
  listError.value = ''

  try {
    const response: any = await $api('v1/admin/mini-app-requests', {
      query: {
        status: selectedStatus.value ?? undefined,
        page: page.value,
        per_page: itemsPerPage.value,
      },
    })

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []
    const metadata = Array.isArray(payload) ? response.meta ?? response : payload.meta ?? payload

    requests.value = records
    total.value = Number(metadata.total ?? records.length)
    lastPage.value = Number(metadata.last_page ?? Math.max(1, Math.ceil(total.value / itemsPerPage.value)))
    paginationFrom.value = Number(metadata.from ?? (total.value ? ((page.value - 1) * itemsPerPage.value) + 1 : 0))
    paginationTo.value = Number(metadata.to ?? Math.min(page.value * itemsPerPage.value, total.value))
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    requests.value = []
    total.value = 0
    lastPage.value = 1
    paginationFrom.value = 0
    paginationTo.value = 0
    listError.value = responseData?.message ?? t('miniAppRequests.loadError')
  }
  finally {
    isLoading.value = false
  }
}

const resetAndFetch = () => {
  if (page.value !== 1)
    page.value = 1
  else
    fetchRequests()
}

watch(selectedStatus, resetAndFetch)
watch(itemsPerPage, resetAndFetch)
watch(page, fetchRequests)
onMounted(fetchRequests)

const openStatusDialog = (request: MiniAppRequest) => {
  if (!canUpdate.value)
    return

  selectedRequest.value = request
  isStatusDialogVisible.value = true
}

const handleSaved = (message: string) => {
  snackbarMessage.value = message
  isSnackbarVisible.value = true
  fetchRequests()
}
</script>

<template>
  <section>
    <VCard
      :title="t('miniAppRequests.filters')"
      class="mb-6"
    >
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            sm="8"
          >
            <AppAutocomplete
              v-model="selectedStatus"
              :label="t('miniAppRequests.status')"
              :placeholder="t('miniAppRequests.allStatuses')"
              :items="statusOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
          <VCol
            cols="12"
            sm="4"
            class="d-flex align-end"
          >
            <VBtn
              block
              color="secondary"
              variant="tonal"
              prepend-icon="tabler-refresh"
              :loading="isLoading"
              @click="fetchRequests"
            >
              {{ t('miniAppRequests.refresh') }}
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <VCard :title="t('miniAppRequests.title')">
      <VCardText class="d-flex flex-wrap align-center py-4 gap-4">
        <AppAutocomplete
          v-model="itemsPerPage"
          :items="[15, 25, 50, 100]"
          style="inline-size: 6.25rem;"
        />
        <VSpacer />
      </VCardText>

      <VAlert
        v-if="listError"
        color="error"
        variant="tonal"
        class="mx-5 mb-5"
      >
        {{ listError }}
      </VAlert>

      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :headers="headers"
        :items="requests"
        :items-length="total"
        :loading="isLoading"
        :loading-text="t('miniAppRequests.loading')"
        :no-data-text="t('miniAppRequests.empty')"
        class="text-no-wrap"
      >
        <template #item.type="{ item }">
          {{ typeLabel(item.type) }}
        </template>

        <template #item.request="{ item }">
          {{ requestLabel(item) }}
        </template>

        <template #item.country="{ item }">
          {{ item.country?.name || '—' }}
        </template>

        <template #item.status="{ item }">
          <VChip
            :color="statusColor(item.status)"
            size="small"
            label
          >
            {{ statusLabel(item.status) }}
          </VChip>
        </template>

        <template #item.customer="{ item }">
          {{ item.customer?.id ? `#${item.customer.id}` : '—' }}
        </template>

        <template #item.telegram_identity="{ item }">
          <div>{{ item.customer_identity?.external_id || '—' }}</div>
          <div
            v-if="item.customer_identity?.external_id"
            class="text-caption text-disabled"
          >
            {{ t('miniAppRequests.telegram') }}
          </div>
        </template>

        <template #item.language="{ item }">
          {{ item.customer_identity?.language || '—' }}
        </template>

        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at, { dateStyle: 'medium', timeStyle: 'short' }) }}
        </template>

        <template #item.actions="{ item }">
          <IconBtn
            v-if="canUpdate"
            :title="t('miniAppRequests.updateStatus')"
            @click="openStatusDialog(item)"
          >
            <VIcon icon="tabler-edit" />
          </IconBtn>
        </template>

        <template #bottom>
          <VDivider />
          <div class="d-flex align-center justify-sm-space-between justify-center flex-wrap gap-3 pa-5 pt-3">
            <p class="text-sm text-disabled mb-0">
              {{ t('miniAppRequests.showing', { from: paginationFrom, to: paginationTo, total }) }}
            </p>
            <VPagination
              v-model="page"
              :length="lastPage"
              :total-visible="$vuetify.display.xs ? 1 : 5"
            >
              <template #prev="slotProps">
                <VBtn
                  variant="tonal"
                  color="default"
                  v-bind="slotProps"
                  :icon="false"
                >
                  {{ t('miniAppRequests.previous') }}
                </VBtn>
              </template>
              <template #next="slotProps">
                <VBtn
                  variant="tonal"
                  color="default"
                  v-bind="slotProps"
                  :icon="false"
                >
                  {{ t('miniAppRequests.next') }}
                </VBtn>
              </template>
            </VPagination>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <MiniAppRequestStatusDialog
      v-if="canUpdate"
      v-model:is-dialog-visible="isStatusDialogVisible"
      :request="selectedRequest"
      @saved="handleSaved"
    />

    <VSnackbar
      v-model="isSnackbarVisible"
      color="success"
      location="top end"
    >
      {{ snackbarMessage }}
    </VSnackbar>
  </section>
</template>
