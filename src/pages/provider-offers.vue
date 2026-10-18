<script setup lang="ts">
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import ProviderOfferFormDialog from '@/views/provider-offers/ProviderOfferFormDialog.vue'
import type { ProviderOffer, SelectOption } from '@/views/provider-offers/ProviderOfferFormDialog.vue'

definePage({
  meta: {
    action: 'provider-offers.view',
    subject: 'all',
  },
})

const ability = useAbility()
const selectedProvider = ref<number | string | null>(null)
const selectedService = ref<number | string | null>(null)
const selectedCountry = ref<number | string | null>(null)
const selectedStatus = ref<string | null>(null)
const itemsPerPage = ref(10)
const page = ref(1)
type SortField = 'sort_order' | 'id' | 'name'
const sort = ref<SortField>('sort_order')
const sortDirection = ref<'asc' | 'desc'>('asc')
let latestProviderOffersRequest = 0
const providerOffers = ref<ProviderOffer[]>([])
const providerOptions = ref<SelectOption[]>([])
const serviceOptions = ref<SelectOption[]>([])
const countryOptions = ref<SelectOption[]>([])
const offerOptions = ref<SelectOption[]>([])
const total = ref(0)
const lastPage = ref(1)
const paginationFrom = ref(0)
const paginationTo = ref(0)
const isLoading = ref(false)
const listError = ref('')
const isFormDialogVisible = ref(false)
const providerOfferToEdit = ref<ProviderOffer | null>(null)
const isDeleteDialogVisible = ref(false)
const providerOfferToDelete = ref<ProviderOffer | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const isSnackbarVisible = ref(false)
const snackbarMessage = ref('')

const canCreate = computed(() => ability.can('provider-offers.create', 'all'))
const canUpdate = computed(() => ability.can('provider-offers.update', 'all'))
const canDelete = computed(() => ability.can('provider-offers.delete', 'all'))

const headers = [
  { title: 'ID', key: 'id', sortable: false },
  { title: 'Provider', key: 'provider', sortable: false },
  { title: 'Service', key: 'service', sortable: false },
  { title: 'Country', key: 'country', sortable: false },
  { title: 'Product ID', key: 'external_product_id', sortable: false },
  { title: 'Price', key: 'price', sortable: false },
  { title: 'Cost', key: 'cost' },
  { title: 'Currency', key: 'currency', sortable: false },
  { title: 'Priority', key: 'priority' },
  { title: 'Sort Order', key: 'sort_order', sortable: false },
  { title: 'Status', key: 'status', sortable: false },
  { title: 'Created date', key: 'created_at' },
  { title: 'Updated date', key: 'updated_at', sortable: false },
  { title: 'Actions', key: 'actions', sortable: false },
]

const statusOptions = [
  { title: 'All', value: null },
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
]

const optionsFrom = (response: any, key: 'countries' | 'offers' | 'providers' | 'services'): SelectOption[] => {
  const payload = response.data ?? response

  return payload[key] ?? payload.data?.[key] ?? []
}

const fetchOptions = async () => {
  try {
    const [countriesResponse, servicesResponse, providersResponse, offersResponse] = await Promise.all([
      $api('admin/countries/all'),
      $api('admin/services/all'),
      $api('admin/providers/all'),
      $api('admin/offers/all'),
    ])

    countryOptions.value = optionsFrom(countriesResponse, 'countries')
    serviceOptions.value = optionsFrom(servicesResponse, 'services')
    providerOptions.value = optionsFrom(providersResponse, 'providers')
    offerOptions.value = optionsFrom(offersResponse, 'offers')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    listError.value = responseData?.message ?? 'Unable to load filter options.'
  }
}

const fetchProviderOffers = async () => {
  const requestId = ++latestProviderOffersRequest

  isLoading.value = true
  listError.value = ''

  try {
    const response: any = await $api('admin/provider-offers', {
      query: {
        provider_id: selectedProvider.value ?? undefined,
        service_id: selectedService.value ?? undefined,
        country_id: selectedCountry.value ?? undefined,
        status: selectedStatus.value ?? undefined,
        per_page: itemsPerPage.value,
        page: page.value,
        sort: sort.value,
        sort_direction: sortDirection.value,
      },
    })

    if (requestId !== latestProviderOffersRequest)
      return

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []
    const metadata = Array.isArray(payload) ? response.meta ?? response : payload.meta ?? payload

    providerOffers.value = records
    total.value = Number(metadata.total ?? records.length)
    lastPage.value = Number(metadata.last_page ?? Math.max(1, Math.ceil(total.value / itemsPerPage.value)))
    paginationFrom.value = Number(metadata.from ?? (total.value ? ((page.value - 1) * itemsPerPage.value) + 1 : 0))
    paginationTo.value = Number(metadata.to ?? Math.min(page.value * itemsPerPage.value, total.value))
  }
  catch (error: any) {
    if (requestId !== latestProviderOffersRequest)
      return

    const responseData = error?.data ?? error?.response?._data

    providerOffers.value = []
    total.value = 0
    lastPage.value = 1
    paginationFrom.value = 0
    paginationTo.value = 0
    listError.value = responseData?.message ?? 'Unable to load provider offers.'
  }
  finally {
    if (requestId === latestProviderOffersRequest)
      isLoading.value = false
  }
}

const resetAndFetch = () => {
  if (page.value !== 1)
    page.value = 1
  else
    fetchProviderOffers()
}

const resetFilters = () => {
  selectedProvider.value = null
  selectedService.value = null
  selectedCountry.value = null
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

  if (page.value !== 1)
    page.value = 1
  else
    fetchProviderOffers()
}

watch(
  [selectedProvider, selectedService, selectedCountry, selectedStatus],
  useDebounceFn(resetAndFetch, 300),
)
watch(itemsPerPage, resetAndFetch)
watch(page, fetchProviderOffers)
onMounted(() => {
  fetchOptions()
  fetchProviderOffers()
})

const openCreateDialog = () => {
  providerOfferToEdit.value = null
  isFormDialogVisible.value = true
}

const openEditDialog = (providerOffer: ProviderOffer) => {
  providerOfferToEdit.value = providerOffer
  isFormDialogVisible.value = true
}

const openDeleteDialog = (providerOffer: ProviderOffer) => {
  providerOfferToDelete.value = providerOffer
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

const showSuccess = (message: string) => {
  snackbarMessage.value = message
  isSnackbarVisible.value = true
  fetchProviderOffers()
}

const deleteProviderOffer = async () => {
  if (!providerOfferToDelete.value)
    return

  isDeleting.value = true
  deleteError.value = ''

  try {
    await $api(`admin/provider-offers/${providerOfferToDelete.value.id}`, { method: 'DELETE' })
    isDeleteDialogVisible.value = false
    showSuccess('Provider offer deleted successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    deleteError.value = responseData?.message ?? 'Unable to delete the provider offer.'
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
            <AppAutocomplete
              v-model="selectedProvider"
              label="Provider"
              placeholder="All providers"
              :items="providerOptions"
              clearable
              clear-icon="tabler-x"
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
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
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
            class="d-flex justify-end"
          >
            <VBtn
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
        <VSpacer />
        <VBtn
          v-if="canCreate"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Add Provider Offer
        </VBtn>
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
        :items="providerOffers"
        :items-length="total"
        :loading="isLoading"
        class="text-no-wrap"
      >
        <template #header.id>
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
        <template #header.name>
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
        <template #header.sort_order>
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
        <template #item.provider="{ item }">
          {{ item.provider?.name ?? '—' }}
        </template>
        <template #item.service="{ item }">
          {{ item.service?.name ?? '—' }}
        </template>
        <template #item.country="{ item }">
          {{ item.country?.name ?? '—' }}
        </template>
        <template #item.cost="{ item }">
          {{ item.cost }}
        </template>
        <template #item.price="{ item }">
          {{ item.price }}
        </template>
        <template #item.status="{ item }">
          <VChip
            :color="item.status === 'active' ? 'success' : 'secondary'"
            size="small"
            label
          >
            {{ item.status === 'active' ? 'Active' : 'Inactive' }}
          </VChip>
        </template>
        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>
        <template #item.updated_at="{ item }">
          {{ formatDate(item.updated_at) }}
        </template>
        <template #item.actions="{ item }">
          <IconBtn
            v-if="canUpdate"
            title="Edit provider offer"
            @click="openEditDialog(item)"
          >
            <VIcon icon="tabler-edit" />
          </IconBtn>
          <IconBtn
            v-if="canDelete"
            title="Delete provider offer"
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

    <ProviderOfferFormDialog
      v-model:is-dialog-visible="isFormDialogVisible"
      :provider-offer="providerOfferToEdit"
      :providers="providerOptions"
      :offers="offerOptions"
      @saved="showSuccess"
    />

    <DeleteConfirmationDialog
      v-model:is-dialog-visible="isDeleteDialogVisible"
      :question="`Are you sure you want to delete provider offer &quot;${providerOfferToDelete?.external_product_id ?? ''}&quot;?`"
      :loading="isDeleting"
      :error="deleteError"
      @confirm="deleteProviderOffer"
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
</style>
