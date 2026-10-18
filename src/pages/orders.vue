<script setup lang="ts">
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import OrderDetailsDialog from '@/views/orders/OrderDetailsDialog.vue'

definePage({
  meta: {
    action: 'orders.view',
    subject: 'all',
  },
})

const ability = useAbility()

interface SelectOption {
  title: string
  value: number | string
}

interface RelatedRecord {
  id?: number | string
  name?: string
  title?: string
}

interface OrderItem {
  country?: RelatedRecord
  service?: RelatedRecord
}

interface Order {
  id: number | string
  amount?: number | string
  canceled_at?: string | null
  cancelled_at?: string | null
  completed_at?: string | null
  country?: RelatedRecord
  created_at: string
  currency?: string
  items?: OrderItem[]
  order_items?: OrderItem[]
  service?: RelatedRecord
  status: 'pending' | 'processing' | 'completed' | 'canceled' | string
  total?: number | string
  total_amount?: number | string
  user?: {
    email?: string
    id?: number | string
    name?: string
    phone?: string
  }
  user_id?: number | string
}

const searchQuery = ref('')
const selectedStatus = ref<string | null>(null)
const selectedUser = ref('')
const selectedService = ref<number | string | null>(null)
const selectedCountry = ref<number | string | null>(null)
const dateFrom = ref('')
const dateTo = ref('')
const selectedSort = ref<'newest' | 'oldest'>('newest')
const itemsPerPage = ref(10)
const page = ref(1)
const orders = ref<Order[]>([])
const serviceOptions = ref<SelectOption[]>([])
const countryOptions = ref<SelectOption[]>([])
const total = ref(0)
const lastPage = ref(1)
const paginationFrom = ref(0)
const paginationTo = ref(0)
const isLoading = ref(false)
const isOptionsLoading = ref(false)
const listError = ref('')
const optionsError = ref('')
const isDetailsDialogVisible = ref(false)
const selectedOrderId = ref<number | string | null>(null)

const canView = computed(() => ability.can('orders.view', 'all'))

const headers = [
  { title: 'Order ID', key: 'id', sortable: false },
  { title: 'User', key: 'user', sortable: false },
  { title: 'Services / Countries', key: 'summary', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Currency', key: 'currency', sortable: false },
  { title: 'Total', key: 'total', sortable: false },
  { title: 'Created date', key: 'created_at', sortable: false },
  { title: 'Completed / Canceled', key: 'finished_at', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false },
]

const statusOptions = [
  { title: 'All', value: null },
  { title: 'Pending', value: 'pending' },
  { title: 'Processing', value: 'processing' },
  { title: 'Completed', value: 'completed' },
  { title: 'Canceled', value: 'canceled' },
]

const sortOptions = [
  { title: 'Newest', value: 'newest' },
  { title: 'Oldest', value: 'oldest' },
]

const datePickerConfig = { dateFormat: 'Y-m-d' }

const optionsFrom = (response: any, key: 'countries' | 'services'): SelectOption[] => {
  const payload = response.data ?? response

  return payload[key] ?? payload.data?.[key] ?? []
}

const fetchOptions = async () => {
  isOptionsLoading.value = true
  optionsError.value = ''

  try {
    const [servicesResponse, countriesResponse] = await Promise.all([
      $api('admin/services/all'),
      $api('admin/countries/all'),
    ])

    serviceOptions.value = optionsFrom(servicesResponse, 'services')
    countryOptions.value = optionsFrom(countriesResponse, 'countries')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    optionsError.value = responseData?.message ?? 'Unable to load filter options.'
  }
  finally {
    isOptionsLoading.value = false
  }
}

const fetchOrders = async () => {
  isLoading.value = true
  listError.value = ''

  try {
    const response: any = await $api('admin/orders', {
      query: {
        search: searchQuery.value || undefined,
        status: selectedStatus.value ?? undefined,
        user_id: selectedUser.value || undefined,
        service_id: selectedService.value ?? undefined,
        country_id: selectedCountry.value ?? undefined,
        date_from: dateFrom.value || undefined,
        date_to: dateTo.value || undefined,
        per_page: itemsPerPage.value,
        page: page.value,
        sort: selectedSort.value,
      },
    })

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []
    const metadata = Array.isArray(payload) ? response.meta ?? response : payload.meta ?? payload

    orders.value = records
    total.value = Number(metadata.total ?? records.length)
    lastPage.value = Number(metadata.last_page ?? Math.max(1, Math.ceil(total.value / itemsPerPage.value)))
    paginationFrom.value = Number(metadata.from ?? (total.value ? ((page.value - 1) * itemsPerPage.value) + 1 : 0))
    paginationTo.value = Number(metadata.to ?? Math.min(page.value * itemsPerPage.value, total.value))
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    orders.value = []
    total.value = 0
    lastPage.value = 1
    paginationFrom.value = 0
    paginationTo.value = 0
    listError.value = responseData?.message ?? 'Unable to load orders.'
  }
  finally {
    isLoading.value = false
  }
}

const resetAndFetch = () => {
  if (page.value !== 1)
    page.value = 1
  else
    fetchOrders()
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedStatus.value = null
  selectedUser.value = ''
  selectedService.value = null
  selectedCountry.value = null
  dateFrom.value = ''
  dateTo.value = ''
  selectedSort.value = 'newest'

  if (page.value !== 1)
    page.value = 1
}

const relatedTitle = (record?: RelatedRecord) => record?.name ?? record?.title

const itemSummary = (order: Order) => {
  const items = order.items ?? order.order_items ?? []
  const services = [relatedTitle(order.service), ...items.map(item => relatedTitle(item.service))].filter(Boolean)
  const countries = [relatedTitle(order.country), ...items.map(item => relatedTitle(item.country))].filter(Boolean)

  const parts = [
    [...new Set(services)].join(', '),
    [...new Set(countries)].join(', '),
  ].filter(Boolean)

  return parts.join(' / ') || '—'
}

const userName = (order: Order) => order.user?.name ?? order.user?.email ?? order.user?.phone ?? (order.user_id ? `#${order.user_id}` : '—')
const orderTotal = (order: Order) => order.total ?? order.total_amount ?? order.amount ?? '—'
const finishedAt = (order: Order) => order.completed_at ?? order.canceled_at ?? order.cancelled_at

const statusColor = (status: string) => ({
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  canceled: 'secondary',
}[status] ?? 'secondary')

const statusLabel = (status: string) => status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : '—'

const viewOrder = (order: Order) => {
  selectedOrderId.value = order.id
  isDetailsDialogVisible.value = true
}

watch(
  [searchQuery, selectedStatus, selectedUser, selectedService, selectedCountry, dateFrom, dateTo],
  useDebounceFn(resetAndFetch, 300),
)
watch([itemsPerPage, selectedSort], resetAndFetch)
watch(page, fetchOrders)
onMounted(() => {
  fetchOptions()
  fetchOrders()
})
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
            md="4"
          >
            <AppTextField
              v-model="searchQuery"
              label="Search"
              placeholder="Search orders"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <AppAutocomplete
              v-model="selectedStatus"
              label="Status"
              placeholder="All statuses"
              :items="statusOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <AppTextField
              v-model="selectedUser"
              label="User ID"
              placeholder="Filter by user ID"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppAutocomplete
              v-model="selectedService"
              label="Service"
              placeholder="All services"
              :items="serviceOptions"
              :loading="isOptionsLoading"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppAutocomplete
              v-model="selectedCountry"
              label="Country"
              placeholder="All countries"
              :items="countryOptions"
              :loading="isOptionsLoading"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppDateTimePicker
              v-model="dateFrom"
              label="Date from"
              placeholder="Select start date"
              :config="datePickerConfig"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="3"
          >
            <AppDateTimePicker
              v-model="dateTo"
              label="Date to"
              placeholder="Select end date"
              :config="datePickerConfig"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="4"
          >
            <AppAutocomplete
              v-model="selectedSort"
              label="Sort"
              :items="sortOptions"
            />
          </VCol>
          <VCol
            cols="12"
            sm="6"
            md="2"
            class="d-flex align-end"
          >
            <VBtn
              block
              color="secondary"
              variant="tonal"
              prepend-icon="tabler-refresh"
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
          v-model="itemsPerPage"
          :items="[10, 25, 50, 100]"
          style="inline-size: 6.25rem;"
        />
      </VCardText>

      <VAlert
        v-if="optionsError || listError"
        color="error"
        variant="tonal"
        class="mx-5 mb-5"
      >
        {{ listError || optionsError }}
      </VAlert>

      <VDivider />

      <VDataTableServer
        v-model:items-per-page="itemsPerPage"
        v-model:page="page"
        :headers="headers"
        :items="orders"
        :items-length="total"
        :loading="isLoading"
        class="text-no-wrap"
      >
        <template #item.id="{ item }">
          <span class="font-weight-medium">#{{ item.id }}</span>
        </template>
        <template #item.user="{ item }">
          <div class="d-flex flex-column">
            <span class="font-weight-medium">{{ userName(item) }}</span>
            <span
              v-if="item.user?.name && item.user?.email"
              class="text-sm text-disabled"
            >
              {{ item.user.email }}
            </span>
          </div>
        </template>
        <template #item.summary="{ item }">
          {{ itemSummary(item) }}
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
        <template #item.currency="{ item }">
          {{ item.currency ?? '—' }}
        </template>
        <template #item.total="{ item }">
          {{ orderTotal(item) }}
        </template>
        <template #item.created_at="{ item }">
          {{ item.created_at ? formatDate(item.created_at) : '—' }}
        </template>
        <template #item.finished_at="{ item }">
          {{ finishedAt(item) ? formatDate(finishedAt(item)!) : '—' }}
        </template>
        <template #item.actions="{ item }">
          <VBtn
            v-if="canView"
            size="small"
            variant="tonal"
            prepend-icon="tabler-eye"
            @click="viewOrder(item)"
          >
            View
          </VBtn>
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

    <OrderDetailsDialog
      v-model:is-dialog-visible="isDetailsDialogVisible"
      :order-id="selectedOrderId"
    />
  </section>
</template>
