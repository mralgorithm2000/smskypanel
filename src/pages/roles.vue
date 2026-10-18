<script setup lang="ts">
import { VDataTableServer } from 'vuetify/labs/VDataTable'
import RoleFormDialog from '@/views/roles/RoleFormDialog.vue'
import type { PermissionOption, Role } from '@/views/roles/RoleFormDialog.vue'

definePage({
  meta: {
    action: 'roles.view',
    subject: 'all',
  },
})

const ability = useAbility()
const searchQuery = ref('')
const itemsPerPage = ref(10)
const page = ref(1)
const roles = ref<Role[]>([])
const permissionOptions = ref<PermissionOption[]>([])
const total = ref(0)
const lastPage = ref(1)
const paginationFrom = ref(0)
const paginationTo = ref(0)
const isLoading = ref(false)
const listError = ref('')
const isFormDialogVisible = ref(false)
const roleToEdit = ref<Role | null>(null)
const isDeleteDialogVisible = ref(false)
const roleToDelete = ref<Role | null>(null)
const isDeleting = ref(false)
const deleteError = ref('')
const isSnackbarVisible = ref(false)
const snackbarMessage = ref('')

const canCreate = computed(() => ability.can('roles.create', 'all'))
const canUpdate = computed(() => ability.can('roles.update', 'all'))
const canDelete = computed(() => ability.can('roles.delete', 'all'))

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
]

const requiredPermissionOptions: PermissionOption[] = [
  { title: 'View mini app requests', value: 'mini_app_requests.view' },
  { title: 'Update mini app requests', value: 'mini_app_requests.update' },
  { title: 'View analytics funnel', value: 'funnel.view' },
]

const fetchPermissions = async () => {
  try {
    const response: any = await $api('admin/permissions/all')
    const payload = response.data ?? response

    const apiPermissions: PermissionOption[] = payload.permissions ?? payload.data?.permissions ?? []
    const permissionValues = new Set(apiPermissions.map(permission => permission.value))

    permissionOptions.value = [
      ...apiPermissions,
      ...requiredPermissionOptions.filter(permission => !permissionValues.has(permission.value)),
    ]
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    listError.value = responseData?.message ?? 'Unable to load permissions.'
  }
}

const fetchRoles = async () => {
  isLoading.value = true
  listError.value = ''

  try {
    const response: any = await $api('admin/roles', {
      query: {
        search: searchQuery.value || undefined,
        per_page: itemsPerPage.value,
        page: page.value,
      },
    })

    const payload = response.data ?? response
    const records = Array.isArray(payload) ? payload : payload.data ?? []

    const metadata = Array.isArray(payload)
      ? response.meta ?? response
      : payload.meta ?? payload

    roles.value = records
    total.value = Number(metadata.total ?? records.length)
    lastPage.value = Number(metadata.last_page ?? Math.max(1, Math.ceil(total.value / itemsPerPage.value)))
    paginationFrom.value = Number(metadata.from ?? (total.value ? ((page.value - 1) * itemsPerPage.value) + 1 : 0))
    paginationTo.value = Number(metadata.to ?? Math.min(page.value * itemsPerPage.value, total.value))
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    roles.value = []
    total.value = 0
    lastPage.value = 1
    paginationFrom.value = 0
    paginationTo.value = 0
    listError.value = responseData?.message ?? 'Unable to load roles.'
  }
  finally {
    isLoading.value = false
  }
}

const resetAndFetch = () => {
  if (page.value !== 1)
    page.value = 1
  else
    fetchRoles()
}

const resetFilters = () => {
  searchQuery.value = ''

  if (page.value !== 1)
    page.value = 1
}

watch(searchQuery, useDebounceFn(resetAndFetch, 300))
watch(itemsPerPage, resetAndFetch)
watch(page, fetchRoles)
onMounted(() => {
  fetchPermissions()
  fetchRoles()
})

const openCreateDialog = () => {
  roleToEdit.value = null
  isFormDialogVisible.value = true
}

const openEditDialog = (role: Role) => {
  roleToEdit.value = role
  isFormDialogVisible.value = true
}

const openDeleteDialog = (role: Role) => {
  roleToDelete.value = role
  deleteError.value = ''
  isDeleteDialogVisible.value = true
}

const showSuccess = (message: string) => {
  snackbarMessage.value = message
  isSnackbarVisible.value = true
  fetchRoles()
}

const deleteRole = async () => {
  if (!roleToDelete.value)
    return

  isDeleting.value = true
  deleteError.value = ''

  try {
    await $api(`admin/roles/${roleToDelete.value.id}`, { method: 'DELETE' })
    isDeleteDialogVisible.value = false
    showSuccess('Role deleted successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    deleteError.value = responseData?.message ?? 'Unable to delete the role.'
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
            sm="10"
          >
            <AppTextField
              v-model="searchQuery"
              label="Search"
              placeholder="Search roles"
              clearable
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
          Add Role
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
        :items="roles"
        :items-length="total"
        :loading="isLoading"
        class="text-no-wrap"
      >
        <template #item.actions="{ item }">
          <div class="d-flex justify-end">
            <IconBtn
              v-if="canUpdate"
              title="Edit role"
              @click="openEditDialog(item)"
            >
              <VIcon icon="tabler-edit" />
            </IconBtn>
            <IconBtn
              v-if="canDelete"
              title="Delete role"
              color="error"
              @click="openDeleteDialog(item)"
            >
              <VIcon icon="tabler-trash" />
            </IconBtn>
          </div>
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

    <RoleFormDialog
      v-model:is-dialog-visible="isFormDialogVisible"
      :role="roleToEdit"
      :permission-options="permissionOptions"
      @saved="showSuccess"
    />

    <DeleteConfirmationDialog
      v-model:is-dialog-visible="isDeleteDialogVisible"
      :question="`Are you sure you want to delete &quot;${roleToDelete?.name ?? ''}&quot;?`"
      :loading="isDeleting"
      :error="deleteError"
      @confirm="deleteRole"
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
