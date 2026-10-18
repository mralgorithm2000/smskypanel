<script setup lang="ts">
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import CountryFormDialog from '@/views/countries/CountryFormDialog.vue'
import type { Country } from '@/views/countries/CountryFormDialog.vue'

definePage({
  meta: {
    action: 'countries.view',
    subject: 'all',
  },
})

const ability = useAbility()
const searchQuery = ref('')
const selectedStatus = ref<boolean | null>(null)
const itemsPerPage = ref(10)
const page = ref(1)
const countries = ref<Country[]>([])
const total = ref(0)
const lastPage = ref(1)
const paginationFrom = ref(0)
const paginationTo = ref(0)
const isLoading = ref(false)
const listError = ref('')
const isFormDialogVisible = ref(false)
const selectedCountry = ref<Country | null>(null)
const isDeleteDialogVisible = ref(false)
const countryToDelete = ref<Country | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const isSnackbarVisible = ref(false)
const snackbarMessage = ref('')

const canCreate = computed(() => ability.can('countries.create', 'all'))
const canUpdate = computed(() => ability.can('countries.update', 'all'))
const canDelete = computed(() => ability.can('countries.delete', 'all'))

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Code', key: 'code' },
  { title: 'Active status', key: 'is_active' },
  { title: 'Created date', key: 'created_at' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const statusOptions = [
  { title: 'All', value: null },
  { title: 'Active', value: true },
  { title: 'Inactive', value: false },
]

const fetchCountries = async () => {
  isLoading.value = true
  listError.value = ''

  try {
    const response: any = await $api('admin/countries', {
      query: {
        search: searchQuery.value || undefined,
        is_active: selectedStatus.value ?? undefined,
        per_page: itemsPerPage.value,
        page: page.value,
      },
    })

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []

    const metadata = Array.isArray(payload)
      ? response.meta ?? response
      : payload.meta ?? payload

    countries.value = records
    total.value = Number(metadata.total ?? records.length)
    lastPage.value = Number(metadata.last_page ?? Math.max(1, Math.ceil(total.value / itemsPerPage.value)))
    paginationFrom.value = Number(metadata.from ?? (total.value ? ((page.value - 1) * itemsPerPage.value) + 1 : 0))
    paginationTo.value = Number(metadata.to ?? Math.min(page.value * itemsPerPage.value, total.value))
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    countries.value = []
    total.value = 0
    lastPage.value = 1
    paginationFrom.value = 0
    paginationTo.value = 0
    listError.value = responseData?.message ?? 'Unable to load countries.'
  }
  finally {
    isLoading.value = false
  }
}

const resetAndFetch = () => {
  if (page.value !== 1)
    page.value = 1
  else
    fetchCountries()
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedStatus.value = null

  if (page.value !== 1)
    page.value = 1
}

watch([searchQuery, selectedStatus], useDebounceFn(resetAndFetch, 300))
watch(itemsPerPage, resetAndFetch)
watch(page, fetchCountries)
onMounted(fetchCountries)

const openCreateDialog = () => {
  selectedCountry.value = null
  isFormDialogVisible.value = true
}

const openEditDialog = (country: Country) => {
  selectedCountry.value = country
  isFormDialogVisible.value = true
}

const openDeleteDialog = (country: Country) => {
  countryToDelete.value = country
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

const showSuccess = (message: string) => {
  snackbarMessage.value = message
  isSnackbarVisible.value = true
  fetchCountries()
}

const deleteCountry = async () => {
  if (!countryToDelete.value)
    return

  isDeleting.value = true
  deleteError.value = ''

  try {
    await $api(`admin/countries/${countryToDelete.value.id}`, { method: 'DELETE' })
    isDeleteDialogVisible.value = false
    showSuccess('Country deleted successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    deleteError.value = responseData?.message ?? 'Unable to delete the country.'
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
            sm="5"
          >
            <AppTextField
              v-model="searchQuery"
              label="Search"
              placeholder="Search countries"
              clearable
            />
          </VCol>
          <VCol
            cols="12"
            sm="5"
          >
            <AppAutocomplete
              v-model="selectedStatus"
              label="Active status"
              placeholder="All statuses"
              :items="statusOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
          <VCol
            cols="12"
            sm="2"
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
        <VSpacer />
        <VBtn
          v-if="canCreate"
          prepend-icon="tabler-plus"
          @click="openCreateDialog"
        >
          Add Country
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
        :items="countries"
        :items-length="total"
        :loading="isLoading"
        class="text-no-wrap"
      >
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
            title="Edit country"
            @click="openEditDialog(item)"
          >
            <VIcon icon="tabler-edit" />
          </IconBtn>
          <IconBtn
            v-if="canDelete"
            title="Delete country"
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

    <CountryFormDialog
      v-model:is-dialog-visible="isFormDialogVisible"
      :country="selectedCountry"
      @saved="showSuccess"
    />

    <DeleteConfirmationDialog
      v-model:is-dialog-visible="isDeleteDialogVisible"
      :question="`Are you sure you want to delete &quot;${countryToDelete?.name ?? ''}&quot;?`"
      :loading="isDeleting"
      :error="deleteError"
      @confirm="deleteCountry"
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
