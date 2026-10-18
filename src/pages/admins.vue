<script setup lang="ts">
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import AdminFormDialog from '@/views/admins/AdminFormDialog.vue'
import type { AdminUser, RoleOption } from '@/views/admins/AdminFormDialog.vue'

definePage({
  meta: {
    action: 'users.view',
    subject: 'all',
  },
})

const ability = useAbility()
const searchQuery = ref('')
const selectedStatus = ref<boolean | null>(null)
const selectedRole = ref<number | string | null>(null)
const itemsPerPage = ref(10)
const page = ref(1)
const sort = ref<string>()
const admins = ref<AdminUser[]>([])
const roleOptions = ref<RoleOption[]>([])
const total = ref(0)
const lastPage = ref(1)
const paginationFrom = ref(0)
const paginationTo = ref(0)
const isLoading = ref(false)
const listError = ref('')
const isFormDialogVisible = ref(false)
const adminToEdit = ref<AdminUser | null>(null)
const isDeleteDialogVisible = ref(false)
const adminToDelete = ref<AdminUser | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const isSnackbarVisible = ref(false)
const snackbarMessage = ref('')

const canCreate = computed(() => ability.can('users.create', 'all'))
const canUpdate = computed(() => ability.can('users.update', 'all'))
const canDelete = computed(() => ability.can('users.delete', 'all'))

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Email', key: 'email' },
  { title: 'Status', key: 'status' },
  { title: 'Roles', key: 'roles', sortable: false },
  { title: 'Created date', key: 'created_at' },
  { title: 'Actions', key: 'actions', sortable: false },
]

const statusOptions = [
  { title: 'All', value: null },
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'disabled' },
]

const roleName = (role: AdminUser['roles'][number]) => typeof role === 'string'
  ? role
  : role.name ?? '—'

const fetchRoles = async () => {
  try {
    const response: any = await $api('admin/roles/all')
    const payload = response.data ?? response

    roleOptions.value = payload.roles ?? payload.data?.roles ?? payload.countries ?? []
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    listError.value = responseData?.message ?? 'Unable to load roles.'
  }
}

const fetchAdmins = async () => {
  isLoading.value = true
  listError.value = ''

  try {
    const response: any = await $api('admin/users', {
      query: {
        search: searchQuery.value || undefined,
        status: selectedStatus.value ?? undefined,
        role: selectedRole.value ?? undefined,
        per_page: itemsPerPage.value,
        page: page.value,
        sort: sort.value,
      },
    })

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []

    const metadata = Array.isArray(payload)
      ? response.meta ?? response
      : payload.meta ?? payload

    admins.value = records
    total.value = Number(metadata.total ?? records.length)
    lastPage.value = Number(metadata.last_page ?? Math.max(1, Math.ceil(total.value / itemsPerPage.value)))
    paginationFrom.value = Number(metadata.from ?? (total.value ? ((page.value - 1) * itemsPerPage.value) + 1 : 0))
    paginationTo.value = Number(metadata.to ?? Math.min(page.value * itemsPerPage.value, total.value))
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    admins.value = []
    total.value = 0
    lastPage.value = 1
    paginationFrom.value = 0
    paginationTo.value = 0
    listError.value = responseData?.message ?? 'Unable to load admins.'
  }
  finally {
    isLoading.value = false
  }
}

const resetAndFetch = () => {
  if (page.value !== 1)
    page.value = 1
  else
    fetchAdmins()
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedStatus.value = null
  selectedRole.value = null

  if (page.value !== 1)
    page.value = 1
}

const updateOptions = (options: any) => {
  const selectedSort = options.sortBy?.[0]

  const nextSort = selectedSort
    ? `${selectedSort.order === 'desc' ? '-' : ''}${selectedSort.key}`
    : undefined

  if (sort.value !== nextSort)
    sort.value = nextSort
}

watch([searchQuery, selectedStatus, selectedRole], useDebounceFn(resetAndFetch, 300))
watch([itemsPerPage, sort], resetAndFetch)
watch(page, fetchAdmins)
onMounted(() => {
  fetchRoles()
  fetchAdmins()
})

const openCreateDialog = () => {
  adminToEdit.value = null
  isFormDialogVisible.value = true
}

const openEditDialog = (admin: AdminUser) => {
  adminToEdit.value = admin
  isFormDialogVisible.value = true
}

const openDeleteDialog = (admin: AdminUser) => {
  adminToDelete.value = admin
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

const showSuccess = (message: string) => {
  snackbarMessage.value = message
  isSnackbarVisible.value = true
  fetchAdmins()
}

const deleteAdmin = async () => {
  if (!adminToDelete.value)
    return

  isDeleting.value = true
  deleteError.value = ''

  try {
    await $api(`admin/users/${adminToDelete.value.id}`, { method: 'DELETE' })
    isDeleteDialogVisible.value = false
    showSuccess('Admin deleted successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    deleteError.value = responseData?.message ?? 'Unable to delete the admin.'
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
              placeholder="Search admins"
              clearable
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
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
          >
            <AppAutocomplete
              v-model="selectedRole"
              label="Role"
              placeholder="All roles"
              :items="roleOptions"
              clearable
              clear-icon="tabler-x"
            />
          </VCol>
          <VCol
            cols="12"
            md="3"
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
          Add Admin
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
        :items="admins"
        :items-length="total"
        :loading="isLoading"
        class="text-no-wrap"
        @update:options="updateOptions"
      >
        <template #item.status="{ item }">
          <VChip
            :color="item.status === 'active' ? 'success' : 'secondary'"
            size="small"
            label
            class="text-capitalize"
          >
            {{ item.status }}
          </VChip>
        </template>

        <template #item.roles="{ item }">
          <div class="d-flex gap-2">
            <VChip
              v-for="role in item.roles"
              :key="roleName(role)"
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ roleName(role) }}
            </VChip>
          </div>
        </template>

        <template #item.created_at="{ item }">
          {{ formatDate(item.created_at) }}
        </template>

        <template #item.actions="{ item }">
          <IconBtn
            v-if="canUpdate"
            title="Edit admin"
            @click="openEditDialog(item)"
          >
            <VIcon icon="tabler-edit" />
          </IconBtn>
          <IconBtn
            v-if="canDelete"
            title="Delete admin"
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

    <AdminFormDialog
      v-model:is-dialog-visible="isFormDialogVisible"
      :admin="adminToEdit"
      :roles="roleOptions"
      @saved="showSuccess"
    />

    <DeleteConfirmationDialog
      v-model:is-dialog-visible="isDeleteDialogVisible"
      :question="`Are you sure you want to delete &quot;${adminToDelete?.name ?? ''}&quot;?`"
      :loading="isDeleting"
      :error="deleteError"
      @confirm="deleteAdmin"
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
