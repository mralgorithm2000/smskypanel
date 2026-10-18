<script setup lang="ts">
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import ServiceFormDialog from '@/views/services/ServiceFormDialog.vue'
import type { Service } from '@/views/services/ServiceFormDialog.vue'

definePage({
  meta: {
    action: 'services.view',
    subject: 'all',
  },
})

const ability = useAbility()
const searchQuery = ref('')
const selectedStatus = ref<boolean | null>(null)
const itemsPerPage = ref(10)
const page = ref(1)
type SortField = 'sort_order' | 'id' | 'name'
const sort = ref<SortField>('sort_order')
const sortDirection = ref<'asc' | 'desc'>('asc')
let latestServicesRequest = 0
const services = ref<Service[]>([])
const total = ref(0)
const lastPage = ref(1)
const paginationFrom = ref(0)
const paginationTo = ref(0)
const isLoading = ref(false)
const listError = ref('')
const isFormDialogVisible = ref(false)
const selectedService = ref<Service | null>(null)
const isDeleteDialogVisible = ref(false)
const serviceToDelete = ref<Service | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const isSnackbarVisible = ref(false)
const snackbarMessage = ref('')
const isReorderMode = ref(false)
const isSavingOrder = ref(false)
const reorderError = ref('')
const draggedServiceIndex = ref<number | null>(null)
const originalServicesOrder = ref<Service[]>([])

const canCreate = computed(() => ability.can('services.create', 'all'))
const canUpdate = computed(() => ability.can('services.update', 'all'))
const canDelete = computed(() => ability.can('services.delete', 'all'))

const headers = [
  { title: 'ID', key: 'id', sortable: false },
  { title: 'Icon', key: 'icon', sortable: false },
  { title: 'Name', key: 'name', sortable: false },
  { title: 'Code', key: 'code' },
  { title: 'Sort Order', key: 'sort_order', sortable: false },
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

const fetchServices = async () => {
  const requestId = ++latestServicesRequest

  isLoading.value = true
  listError.value = ''

  try {
    const response: any = await $api('admin/services', {
      query: {
        search: searchQuery.value || undefined,
        is_active: selectedStatus.value ?? undefined,
        per_page: itemsPerPage.value,
        page: page.value,
        sort: sort.value,
        sort_direction: sortDirection.value,
      },
    })

    if (requestId !== latestServicesRequest)
      return

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []

    const metadata = Array.isArray(payload)
      ? response.meta ?? response
      : payload.meta ?? payload

    services.value = records
    total.value = Number(metadata.total ?? records.length)
    lastPage.value = Number(metadata.last_page ?? Math.max(1, Math.ceil(total.value / itemsPerPage.value)))
    paginationFrom.value = Number(metadata.from ?? (total.value ? ((page.value - 1) * itemsPerPage.value) + 1 : 0))
    paginationTo.value = Number(metadata.to ?? Math.min(page.value * itemsPerPage.value, total.value))
  }
  catch (error: any) {
    if (requestId !== latestServicesRequest)
      return

    const responseData = error?.data ?? error?.response?._data

    services.value = []
    total.value = 0
    lastPage.value = 1
    paginationFrom.value = 0
    paginationTo.value = 0
    listError.value = responseData?.message ?? 'Unable to load services.'
  }
  finally {
    if (requestId === latestServicesRequest)
      isLoading.value = false
  }
}

const resetAndFetch = () => {
  if (page.value !== 1)
    page.value = 1
  else
    fetchServices()
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedStatus.value = null

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

const canEnterReorderMode = computed(() => !searchQuery.value.trim()
  && selectedStatus.value === null
  && page.value === 1
  && sort.value === 'sort_order'
  && sortDirection.value === 'asc'
  && !isLoading.value)

const enterReorderMode = async () => {
  if (!canEnterReorderMode.value)
    return

  reorderError.value = ''
  isLoading.value = true

  try {
    const response: any = await $api('admin/services', {
      query: { page: 1, per_page: Math.max(total.value, 1), sort: 'sort_order', sort_direction: 'asc' },
    })

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []
    const metadata = Array.isArray(payload) ? response.meta ?? response : payload.meta ?? payload
    const hasReliableCount = Array.isArray(payload) || Number.isFinite(Number(metadata.total))
    const recordCount = Number(metadata.total ?? records.length)

    if (!hasReliableCount || records.length !== recordCount) {
      reorderError.value = `Reordering is unavailable because the API returned ${records.length} of ${recordCount} services. Clear filters and try again, or ask an administrator to increase the API page-size limit.`

      return
    }

    originalServicesOrder.value = [...records]
    services.value = records
    total.value = recordCount
    isReorderMode.value = true
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    reorderError.value = responseData?.message ?? 'Unable to load all services for reordering.'
  }
  finally {
    isLoading.value = false
  }
}

const moveService = (from: number, to: number) => {
  if (isSavingOrder.value || from === to || from < 0 || to < 0 || to >= services.value.length)
    return

  const [service] = services.value.splice(from, 1)

  services.value.splice(to, 0, service)
}

const cancelReorder = () => {
  if (isSavingOrder.value)
    return

  isReorderMode.value = false
  services.value = [...originalServicesOrder.value]
  originalServicesOrder.value = []
  draggedServiceIndex.value = null
  reorderError.value = ''
}

const saveServiceOrder = async () => {
  if (!isReorderMode.value || isSavingOrder.value)
    return

  isSavingOrder.value = true
  reorderError.value = ''

  const orderedItems = services.value.map((service, index) => ({ id: service.id, sort_order: index }))

  try {
    await $api('admin/services/reorder', {
      method: 'PUT',
      body: { items: orderedItems },
    })
    isReorderMode.value = false
    originalServicesOrder.value = []
    isSnackbarVisible.value = true
    snackbarMessage.value = 'Service order saved successfully.'
    await fetchServices()
  }
  catch (error: any) {
    if (!error?.response && !error?.data) {
      try {
        const response: any = await $api('admin/services', {
          query: { page: 1, per_page: Math.max(orderedItems.length, 1), sort: 'sort_order', sort_direction: 'asc' },
        })

        const payload = response.data ?? response
        const records = Array.isArray(payload) ? payload : payload.data ?? []

        const orderWasSaved = records.length === orderedItems.length
          && records.every((service: Service, index: number) => String(service.id) === String(orderedItems[index]?.id))

        if (orderWasSaved) {
          isReorderMode.value = false
          isSnackbarVisible.value = true
          snackbarMessage.value = 'Service order saved successfully.'
          await fetchServices()

          return
        }
      }
      catch {
        // Keep the proposed order available when the save outcome cannot be confirmed.
      }
    }

    const responseData = error?.data ?? error?.response?._data

    reorderError.value = responseData?.message ?? 'Unable to save the service order. Your proposed order is still available to retry.'
  }
  finally {
    isSavingOrder.value = false
  }
}

watch([searchQuery, selectedStatus], useDebounceFn(resetAndFetch, 300))
watch([sort, sortDirection], resetAndFetch)
watch(itemsPerPage, resetAndFetch)
watch(page, fetchServices)
onMounted(fetchServices)

const openCreateDialog = () => {
  selectedService.value = null
  isFormDialogVisible.value = true
}

const openEditDialog = (service: Service) => {
  selectedService.value = service
  isFormDialogVisible.value = true
}

const openDeleteDialog = (service: Service) => {
  serviceToDelete.value = service
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

const showSuccess = (message: string) => {
  snackbarMessage.value = message
  isSnackbarVisible.value = true
  fetchServices()
}

const deleteService = async () => {
  if (!serviceToDelete.value)
    return

  isDeleting.value = true
  deleteError.value = ''

  try {
    await $api(`admin/services/${serviceToDelete.value.id}`, { method: 'DELETE' })
    isDeleteDialogVisible.value = false
    showSuccess('Service deleted successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    deleteError.value = responseData?.message ?? 'Unable to delete the service.'
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
            sm="6"
            md="3"
          >
            <AppTextField
              v-model="searchQuery"
              label="Search"
              placeholder="Search services"
              clearable
              :disabled="isReorderMode"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
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
            sm="6"
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
            sm="6"
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
            sm="6"
            md="3"
            class="d-flex align-end"
          >
            <VBtn
              block
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
            @click="saveServiceOrder"
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
          Add Service
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
        To reorder services, clear search and filters, return to page 1, and select Sort Order ascending.
      </VAlert>

      <VAlert
        v-if="isReorderMode"
        color="info"
        variant="tonal"
        class="mx-5 mb-5"
      >
        Drag rows using the grip handle to set the global service order.
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
            <th>Icon</th>
            <th>Name</th>
            <th>Code</th>
            <th>Sort Order</th>
            <th>Active status</th>
            <th>Created date</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(service, index) in services"
            :key="service.id"
            :class="{ 'reorder-row': !isSavingOrder }"
            :draggable="!isSavingOrder"
            @dragstart="draggedServiceIndex = index"
            @dragover.prevent
            @drop.prevent="draggedServiceIndex !== null && moveService(draggedServiceIndex, index)"
            @dragend="draggedServiceIndex = null"
          >
            <td>
              <VIcon
                icon="tabler-grip-vertical"
                class="drag-handle"
                :class="{ 'text-disabled': isSavingOrder }"
              />
            </td>
            <td>{{ service.id }}</td>
            <td>
              <VAvatar
                rounded
                size="32"
                color="secondary"
                variant="tonal"
              >
                <VImg
                  v-if="service.icon"
                  :src="service.icon"
                  :alt="`${service.name} icon`"
                  cover
                />
                <VIcon
                  v-else
                  icon="tabler-photo"
                  size="18"
                />
              </VAvatar>
            </td>
            <td>{{ service.name }}</td>
            <td>{{ service.code }}</td>
            <td>{{ index }}</td>
            <td>{{ service.is_active ? 'Active' : 'Inactive' }}</td>
            <td>{{ formatDate(service.created_at) }}</td>
          </tr>
          <tr v-if="!services.length">
            <td
              colspan="8"
              class="text-center text-medium-emphasis"
            >
              No services found
            </td>
          </tr>
        </tbody>
      </VTable>

      <VDataTableServer
        v-else
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :headers="headers"
        :items="services"
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
        <template #column.name>
          <button
            type="button"
            class="sortable-header"
            @click="setSort('name')"
          >
            Name <VIcon
              v-if="sort === 'name'"
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
        <template #item.id="{ item }">
          {{ item.id }}
        </template>
        <template #item.icon="{ item }">
          <VAvatar
            rounded
            size="40"
            color="secondary"
            variant="tonal"
          >
            <VImg
              v-if="item.icon"
              :src="item.icon"
              :alt="`${item.name} icon`"
              cover
            />
            <VIcon
              v-else
              icon="tabler-photo"
              size="20"
            />
          </VAvatar>
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
            title="Edit service"
            @click="openEditDialog(item)"
          >
            <VIcon icon="tabler-edit" />
          </IconBtn>
          <IconBtn
            v-if="canDelete"
            title="Delete service"
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

    <ServiceFormDialog
      v-model:is-dialog-visible="isFormDialogVisible"
      :service="selectedService"
      @saved="showSuccess"
    />

    <DeleteConfirmationDialog
      v-model:is-dialog-visible="isDeleteDialogVisible"
      :question="`Are you sure you want to delete &quot;${serviceToDelete?.name ?? ''}&quot;?`"
      :loading="isDeleting"
      :error="deleteError"
      @confirm="deleteService"
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
