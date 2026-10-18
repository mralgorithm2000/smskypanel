<script setup lang="ts">
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import OfferFormDialog from '@/views/offers/OfferFormDialog.vue'
import BulkOfferImportDialog from '@/views/offers/BulkOfferImportDialog.vue'
import type { Offer, SelectOption } from '@/views/offers/OfferFormDialog.vue'

definePage({
  meta: {
    action: 'offers.view',
    subject: 'all',
  },
})

const ability = useAbility()
const searchQuery = ref('')
const selectedStatus = ref<boolean | null>(null)
const selectedService = ref<number | string | null>(null)
const selectedCountry = ref<number | string | null>(null)
const itemsPerPage = ref(10)
const page = ref(1)
type SortField = 'sort_order' | 'id' | 'name'
const sort = ref<SortField>('sort_order')
const sortDirection = ref<'asc' | 'desc'>('asc')
let latestOffersRequest = 0
const offers = ref<Offer[]>([])
const countryOptions = ref<SelectOption[]>([])
const serviceOptions = ref<SelectOption[]>([])
const total = ref(0)
const lastPage = ref(1)
const paginationFrom = ref(0)
const paginationTo = ref(0)
const isLoading = ref(false)
const listError = ref('')
const isFormDialogVisible = ref(false)
const isBulkImportDialogVisible = ref(false)
const offerToEdit = ref<Offer | null>(null)
const isDeleteDialogVisible = ref(false)
const offerToDelete = ref<Offer | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const isSnackbarVisible = ref(false)
const snackbarMessage = ref('')
const isReorderMode = ref(false)
const isSavingOrder = ref(false)
const reorderError = ref('')
const draggedOfferIndex = ref<number | null>(null)
const originalOffersOrder = ref<Offer[]>([])

const canCreate = computed(() => ability.can('offers.create', 'all'))
const canUpdate = computed(() => ability.can('offers.update', 'all'))
const canDelete = computed(() => ability.can('offers.delete', 'all'))

const headers = [
  { title: 'ID', key: 'id', sortable: false },
  { title: 'Sort Order', key: 'sort_order', sortable: false },
  { title: 'Service', key: 'service', sortable: false },
  { title: 'Country', key: 'country' },
  { title: 'Active status', key: 'is_active' },
  { title: 'Created date', key: 'created_at' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const statusOptions = [
  { title: 'All', value: null },
  { title: 'Active', value: true },
  { title: 'Inactive', value: false },
]

const sortOptions = [
  { title: 'Sort Order', value: 'sort_order' },
  { title: 'ID', value: 'id' },
  { title: 'Name', value: 'name' },
]

const sortDirectionOptions = [
  { title: 'Ascending', value: 'asc' },
  { title: 'Descending', value: 'desc' },
]

const serviceName = (offer: Offer) => offer.service?.name
  ?? offer.service?.title
  ?? offer.service_name
  ?? serviceOptions.value.find(option => option.value === offer.number_service_id || option.value === offer.service_id)?.title
  ?? '—'

const countryName = (offer: Offer) => offer.country?.name
  ?? offer.country?.title
  ?? offer.country_name
  ?? countryOptions.value.find(option => option.value === offer.country_id)?.title
  ?? '—'

const optionsFrom = (response: any, key: 'countries' | 'services'): SelectOption[] => {
  const payload = response.data ?? response

  return payload[key] ?? payload.data?.[key] ?? []
}

const fetchOptions = async () => {
  try {
    const [countriesResponse, servicesResponse] = await Promise.all([
      $api('admin/countries/all'),
      $api('admin/services/all'),
    ])

    countryOptions.value = optionsFrom(countriesResponse, 'countries')
    serviceOptions.value = optionsFrom(servicesResponse, 'services')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    listError.value = responseData?.message ?? 'Unable to load country and service options.'
  }
}

const fetchOffers = async () => {
  const requestId = ++latestOffersRequest

  isLoading.value = true
  listError.value = ''

  try {
    const response: any = await $api('admin/offers', {
      query: {
        search: searchQuery.value || undefined,
        is_active: selectedStatus.value ?? undefined,
        service_id: selectedService.value ?? undefined,
        country_id: selectedCountry.value ?? undefined,
        per_page: itemsPerPage.value,
        page: page.value,
        sort: sort.value,
        sort_direction: sortDirection.value,
      },
    })

    if (requestId !== latestOffersRequest)
      return

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []

    const metadata = Array.isArray(payload)
      ? response.meta ?? response
      : payload.meta ?? payload

    offers.value = records
    total.value = Number(metadata.total ?? records.length)
    lastPage.value = Number(metadata.last_page ?? Math.max(1, Math.ceil(total.value / itemsPerPage.value)))
    paginationFrom.value = Number(metadata.from ?? (total.value ? ((page.value - 1) * itemsPerPage.value) + 1 : 0))
    paginationTo.value = Number(metadata.to ?? Math.min(page.value * itemsPerPage.value, total.value))
  }
  catch (error: any) {
    if (requestId !== latestOffersRequest)
      return

    const responseData = error?.data ?? error?.response?._data

    offers.value = []
    total.value = 0
    lastPage.value = 1
    paginationFrom.value = 0
    paginationTo.value = 0
    listError.value = responseData?.message ?? 'Unable to load offers.'
  }
  finally {
    if (requestId === latestOffersRequest)
      isLoading.value = false
  }
}

const resetAndFetch = () => {
  if (isReorderMode.value)
    return

  if (page.value !== 1)
    page.value = 1
  else
    fetchOffers()
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedStatus.value = null
  selectedService.value = null
  selectedCountry.value = null

  if (page.value !== 1)
    page.value = 1
}

const setSort = (field: SortField) => {
  if (sort.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sort.value = field
    sortDirection.value = 'asc'
  }
}

const canEnterReorderMode = computed(() => selectedService.value !== null
  && selectedService.value !== ''
  && !isLoading.value
  && !isSavingOrder.value)

const responseRecords = (response: any) => {
  const payload = response.data ?? response
  const records = Array.isArray(payload) ? payload : payload.data ?? []
  const metadata = Array.isArray(payload) ? response.meta ?? response : payload.meta ?? payload

  return { records: records as Offer[], metadata, isUnpaginatedArray: Array.isArray(payload) }
}

const loadAllOffersForService = async (serviceId: number | string) => {
  const perPage = 100

  const firstResponse: any = await $api('admin/offers', {
    query: {
      service_id: serviceId,
      per_page: perPage,
      page: 1,
      sort: 'sort_order',
      sort_direction: 'asc',
    },
  })

  const firstPage = responseRecords(firstResponse)

  const records = [...firstPage.records]

  const hasReliableTotal = firstPage.metadata.total !== undefined
    && firstPage.metadata.total !== null
    && Number.isFinite(Number(firstPage.metadata.total))

  if (hasReliableTotal) {
    const expectedTotal = Number(firstPage.metadata.total)

    let currentPage = 1

    while (records.length < expectedTotal) {
      currentPage += 1

      const response: any = await $api('admin/offers', {
        query: {
          service_id: serviceId,
          per_page: perPage,
          page: currentPage,
          sort: 'sort_order',
          sort_direction: 'asc',
        },
      })

      const nextPage = responseRecords(response)

      if (Number(nextPage.metadata.total) !== expectedTotal || !nextPage.records.length)
        throw new Error('The API did not return every offer for the selected service.')

      records.push(...nextPage.records)

      if (records.length > expectedTotal)
        throw new Error('The API returned more offers than its pagination total.')
    }

    if (records.length !== expectedTotal)
      throw new Error(`Loaded ${records.length} of ${expectedTotal} offers for the selected service.`)
  }
  else if (!firstPage.isUnpaginatedArray || records.length >= perPage) {
    throw new Error('The API did not return reliable pagination metadata, so the complete service offer list cannot be verified.')
  }

  const seenIds = new Set<string>()

  for (const offer of records) {
    const offerServiceId = offer.service?.id ?? offer.service_id ?? offer.number_service_id

    if (offerServiceId === undefined || String(offerServiceId) !== String(serviceId))
      throw new Error('The API returned an offer outside the selected service or without a verifiable service ID.')

    const id = String(offer.id)

    if (seenIds.has(id))
      throw new Error('The API returned duplicate offers while loading the selected service.')

    seenIds.add(id)
  }

  return records
}

const enterReorderMode = async () => {
  if (!canEnterReorderMode.value)
    return

  const serviceId = selectedService.value

  if (serviceId === null || serviceId === '')
    return

  reorderError.value = ''
  isLoading.value = true

  try {
    const records = await loadAllOffersForService(serviceId)

    originalOffersOrder.value = [...offers.value]
    offers.value = records
    isReorderMode.value = true
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    reorderError.value = responseData?.message ?? error?.message ?? 'Unable to load all offers for the selected service.'
  }
  finally {
    isLoading.value = false
  }
}

const moveOffer = (from: number, to: number) => {
  if (isSavingOrder.value || from === to || from < 0 || to < 0 || to >= offers.value.length)
    return

  const [offer] = offers.value.splice(from, 1)

  offers.value.splice(to, 0, offer)
}

const cancelReorder = () => {
  if (isSavingOrder.value)
    return

  isReorderMode.value = false
  offers.value = [...originalOffersOrder.value]
  originalOffersOrder.value = []
  draggedOfferIndex.value = null
  reorderError.value = ''
}

const saveOfferOrder = async () => {
  if (!isReorderMode.value || isSavingOrder.value)
    return

  const serviceId = selectedService.value

  if (serviceId === null || serviceId === '')
    return

  isSavingOrder.value = true
  reorderError.value = ''

  const orderedItems = offers.value.map((offer, index) => ({ id: offer.id, sort_order: index }))

  try {
    await $api('admin/offers/reorder', {
      method: 'PUT',
      body: { items: orderedItems },
    })
    isReorderMode.value = false
    originalOffersOrder.value = []
    isSnackbarVisible.value = true
    snackbarMessage.value = 'Offer order saved successfully.'
    await fetchOffers()
  }
  catch (error: any) {
    if (!error?.response && !error?.data) {
      try {
        const records = await loadAllOffersForService(serviceId)

        const orderWasSaved = records.length === orderedItems.length
          && records.every((offer: Offer, index: number) => String(offer.id) === String(orderedItems[index]?.id))

        if (orderWasSaved) {
          isReorderMode.value = false
          originalOffersOrder.value = []
          isSnackbarVisible.value = true
          snackbarMessage.value = 'Offer order saved successfully.'
          await fetchOffers()

          return
        }
      }
      catch {
        // Keep the proposed order available when the save outcome cannot be confirmed.
      }
    }

    const responseData = error?.data ?? error?.response?._data

    reorderError.value = responseData?.message ?? 'Unable to save the offer order. Your proposed order is still available to retry.'
  }
  finally {
    isSavingOrder.value = false
  }
}

watch(
  [searchQuery, selectedStatus, selectedService, selectedCountry],
  useDebounceFn(resetAndFetch, 300),
)
watch([sort, sortDirection], resetAndFetch)
watch(itemsPerPage, resetAndFetch)
watch(page, fetchOffers)
onMounted(() => {
  fetchOptions()
  fetchOffers()
})

const openCreateDialog = () => {
  offerToEdit.value = null
  isFormDialogVisible.value = true
}

const openEditDialog = (offer: Offer) => {
  offerToEdit.value = offer
  isFormDialogVisible.value = true
}

const openDeleteDialog = (offer: Offer) => {
  offerToDelete.value = offer
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

const showSuccess = (message: string) => {
  snackbarMessage.value = message
  isSnackbarVisible.value = true
  fetchOffers()
}

const deleteOffer = async () => {
  if (!offerToDelete.value)
    return

  isDeleting.value = true
  deleteError.value = ''

  try {
    await $api(`admin/offers/${offerToDelete.value.id}`, { method: 'DELETE' })
    isDeleteDialogVisible.value = false
    showSuccess('Offer deleted successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    deleteError.value = responseData?.message ?? 'Unable to delete the offer.'
  }
  finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <section>
    <VCard
      title="Filters"
      class="mb-6"
    >
      <VCardText>
        <VRow>
          <VCol
            cols="12"
            md="3"
          >
            <AppTextField
              v-model="searchQuery"
              label="Search"
              placeholder="Search offers"
              clearable
              :disabled="isReorderMode"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppAutocomplete
              v-model="selectedStatus"
              label="Active status"
              placeholder="All statuses"
              :items="statusOptions"
              clearable
              clear-icon="tabler-x"
              :disabled="isReorderMode"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppAutocomplete
              v-model="selectedService"
              label="Service"
              placeholder="All services"
              :items="serviceOptions"
              clearable
              clear-icon="tabler-x"
              :disabled="isReorderMode"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppAutocomplete
              v-model="selectedCountry"
              label="Country"
              placeholder="All countries"
              :items="countryOptions"
              clearable
              clear-icon="tabler-x"
              :disabled="isReorderMode"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppAutocomplete
              v-model="sort"
              label="Sort"
              :items="sortOptions"
              :disabled="isReorderMode"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppAutocomplete
              v-model="sortDirection"
              label="Sort Direction"
              :items="sortDirectionOptions"
              :disabled="isReorderMode"
            />
          </VCol>
          <VCol
            cols="12"
            class="d-flex justify-end"
          >
            <VBtn
              color="secondary"
              variant="tonal"
              prepend-icon="tabler-refresh"
              :disabled="isReorderMode"
              @click="resetFilters"
            >
              Reset
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <VCard>
      <VCardText class="d-flex flex-wrap align-center py-4 gap-4">
        <AppAutocomplete
          v-if="!isReorderMode"
          v-model="itemsPerPage"
          :items="[10, 25, 50, 100]"
          style="inline-size: 6.25rem;"
        />
        <VSpacer />
        <template v-if="isReorderMode">
          <VBtn
            color="secondary"
            variant="tonal"
            :disabled="isSavingOrder"
            @click="cancelReorder"
          >
            Cancel
          </VBtn>
          <VBtn
            color="success"
            prepend-icon="tabler-device-floppy"
            :loading="isSavingOrder"
            :disabled="isSavingOrder"
            @click="saveOfferOrder"
          >
            Save Order
          </VBtn>
        </template>
        <VBtn
          v-else
          color="secondary"
          variant="tonal"
          prepend-icon="tabler-arrows-move-vertical"
          :disabled="!canEnterReorderMode || !canUpdate"
          @click="enterReorderMode"
        >
          Reorder
        </VBtn>
        <VBtn
          v-if="canCreate && !isReorderMode"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Add Offer
        </VBtn>
        <VBtn
          v-if="canCreate && !isReorderMode"
          color="secondary"
          variant="tonal"
          prepend-icon="tabler-file-import"
          @click="isBulkImportDialogVisible = true"
        >
          Import Bulk Offers
        </VBtn>
      </VCardText>

      <VAlert
        v-if="reorderError"
        color="error"
        variant="tonal"
        class="mx-5 mb-5"
      >
        {{ reorderError }}
      </VAlert>

      <VAlert
        v-if="canUpdate && !isReorderMode && !canEnterReorderMode"
        color="info"
        variant="tonal"
        class="mx-5 mb-5"
      >
        Select a service to reorder all offers belonging to that service.
      </VAlert>

      <VAlert
        v-if="isReorderMode"
        color="info"
        variant="tonal"
        class="mx-5 mb-5"
      >
        Drag rows to reorder offers within the selected service. Other filters are paused until you save or cancel.
      </VAlert>

      <VAlert
        v-if="listError"
        color="error"
        variant="tonal"
        class="mx-5 mb-5"
      >
        {{ listError }}
      </VAlert>

      <VDivider />

      <VTable
        v-if="isReorderMode"
        class="text-no-wrap reorder-table"
      >
        <thead>
          <tr>
            <th aria-label="Drag handle" />
            <th>ID</th>
            <th>Sort Order</th>
            <th>Service</th>
            <th>Country</th>
            <th>Active status</th>
            <th>Created date</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(offer, index) in offers"
            :key="offer.id"
            :class="{ 'reorder-row': !isSavingOrder }"
            :draggable="!isSavingOrder"
            @dragstart="draggedOfferIndex = index"
            @dragover.prevent
            @drop.prevent="draggedOfferIndex !== null && moveOffer(draggedOfferIndex, index)"
            @dragend="draggedOfferIndex = null"
          >
            <td>
              <VIcon
                icon="tabler-grip-vertical"
                class="drag-handle"
                :class="{ 'text-disabled': isSavingOrder }"
              />
            </td>
            <td>{{ offer.id }}</td>
            <td>{{ index }}</td>
            <td>{{ serviceName(offer) }}</td>
            <td>{{ countryName(offer) }}</td>
            <td>{{ offer.is_active ? 'Active' : 'Inactive' }}</td>
            <td>{{ formatDate(offer.created_at) }}</td>
          </tr>
          <tr v-if="!offers.length">
            <td
              colspan="7"
              class="text-center text-medium-emphasis"
            >
              No offers found
            </td>
          </tr>
        </tbody>
      </VTable>

      <VDataTableServer
        v-else
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :headers="headers"
        :items="offers"
        :items-length="total"
        :loading="isLoading"
        class="text-no-wrap"
      >
        <template #column.id>
          <button
            type="button"
            class="sortable-header"
            @click="setSort('id')"
          >
            ID <VIcon
              v-if="sort === 'id'"
              :icon="sortDirection === 'asc' ? 'tabler-arrow-up' : 'tabler-arrow-down'"
              size="16"
            />
          </button>
        </template>
        <template #column.sort_order>
          <button
            type="button"
            class="sortable-header"
            @click="setSort('sort_order')"
          >
            Sort Order <VIcon
              v-if="sort === 'sort_order'"
              :icon="sortDirection === 'asc' ? 'tabler-arrow-up' : 'tabler-arrow-down'"
              size="16"
            />
          </button>
        </template>
        <template #column.service>
          <button
            type="button"
            class="sortable-header"
            @click="setSort('name')"
          >
            Service <VIcon
              v-if="sort === 'name'"
              :icon="sortDirection === 'asc' ? 'tabler-arrow-up' : 'tabler-arrow-down'"
              size="16"
            />
          </button>
        </template>
        <template #item.id="{ item }">
          {{ item.id }}
        </template>
        <template #item.service="{ item }">
          {{ serviceName(item) }}
        </template>

        <template #item.country="{ item }">
          {{ countryName(item) }}
        </template>

        <template #item.is_active="{ item }">
          <VChip
            :color="item.is_active ? 'success' : 'secondary'"
            size="small"
            label
          >
            {{ item.is_active ? 'Active' : 'Inactive' }}
          </VChip>
        </template>

        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template #item.actions="{ item }">
          <IconBtn
            v-if="canUpdate"
            title="Edit offer"
            @click="openEditDialog(item)"
          >
            <VIcon icon="tabler-edit" />
          </IconBtn>
          <IconBtn
            v-if="canDelete"
            title="Delete offer"
            color="error"
            @click="openDeleteDialog(item)"
          >
            <VIcon icon="tabler-trash" />
          </IconBtn>
        </template>

        <template #bottom>
          <VDivider />
          <div class="d-flex align-center justify-sm-space-between justify-center flex-wrap gap-3 pa-5 pt-3">
            <p class="text-sm text-disabled mb-0">
              Showing {{ paginationFrom }} to {{ paginationTo }} of {{ total }} entries
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
                  Previous
                </VBtn>
              </template>
              <template #next="slotProps">
                <VBtn
                  variant="tonal"
                  color="default"
                  v-bind="slotProps"
                  :icon="false"
                >
                  Next
                </VBtn>
              </template>
            </VPagination>
          </div>
        </template>
      </VDataTableServer>
    </VCard>

    <OfferFormDialog
      v-model:is-dialog-visible="isFormDialogVisible"
      :offer="offerToEdit"
      :countries="countryOptions"
      :services="serviceOptions"
      @saved="showSuccess"
    />

    <BulkOfferImportDialog
      v-model:is-dialog-visible="isBulkImportDialogVisible"
      @imported="showSuccess"
    />

    <DeleteConfirmationDialog
      v-model:is-dialog-visible="isDeleteDialogVisible"
      :question="`Are you sure you want to delete &quot;${offerToDelete ? `${serviceName(offerToDelete)} - ${countryName(offerToDelete)}` : ''}&quot;?`"
      :loading="isDeleting"
      :error="deleteError"
      @confirm="deleteOffer"
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

<style scoped>
.sortable-header {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.reorder-table tbody tr {
  transition: background-color 120ms ease;
}

.reorder-row {
  cursor: grab;
}

.reorder-row:active {
  cursor: grabbing;
}

.drag-handle {
  color: rgb(var(--v-theme-secondary));
  cursor: grab;
}
</style>
