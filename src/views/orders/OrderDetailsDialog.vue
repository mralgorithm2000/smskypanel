<script setup lang="ts">
interface RelatedRecord {
  id?: number | string
  name?: string
  title?: string
}

interface NumberAttempt {
  assigned_at?: string | null
  canceled_at?: string | null
  cancelled_at?: string | null
  code_received_at?: string | null
  cost?: number | string
  created_at?: string | null
  currency?: string
  expires_at?: string | null
  expiration_date?: string | null
  external_id?: number | string
  failure_reason?: string | null
  id: number | string
  number?: string
  phone_number?: string
  provider?: RelatedRecord
  provider_reference?: string
  requested_at?: string | null
  status?: string
}

interface OrderItem {
  country?: RelatedRecord
  id?: number | string
  number_attempts?: NumberAttempt[]
  quantity?: number | string
  service?: RelatedRecord
  total?: number | string
  total_amount?: number | string
  unit_price?: number | string
}

interface OrderDetails {
  canceled_at?: string | null
  cancelled_at?: string | null
  completed_at?: string | null
  created_at?: string | null
  currency?: string
  discount?: number | string
  discount_amount?: number | string
  id: number | string
  items?: OrderItem[]
  order_items?: OrderItem[]
  status?: string
  subtotal?: number | string
  subtotal_amount?: number | string
  total?: number | string
  total_amount?: number | string
  user?: {
    email?: string
    name?: string
  }
}

interface Props {
  isDialogVisible: boolean
  orderId?: number | string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:isDialogVisible', value: boolean): void
}>()

const order = ref<OrderDetails | null>(null)
const isLoading = ref(false)
const loadError = ref('')

const detailItems = computed(() => order.value?.items ?? order.value?.order_items ?? [])

const statusColor = (status?: string) => ({
  pending: 'warning',
  processing: 'info',
  completed: 'success',
  canceled: 'secondary',
  failed: 'error',
  assigned: 'info',
  code_received: 'success',
}[status ?? ''] ?? 'secondary')

const statusLabel = (status?: string) => status
  ? status.split('_').map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ')
  : '—'

const relatedTitle = (record?: RelatedRecord) => record?.name ?? record?.title ?? (record?.id ? `#${record.id}` : '—')
const valueOrDash = (value: unknown) => value === null || value === undefined || value === '' ? '—' : value
const dateOrDash = (value?: string | null) => value ? formatDate(value) : '—'
const itemTotal = (item: OrderItem) => item.total ?? item.total_amount
const subtotal = computed(() => order.value?.subtotal ?? order.value?.subtotal_amount)
const discount = computed(() => order.value?.discount ?? order.value?.discount_amount)
const total = computed(() => order.value?.total ?? order.value?.total_amount)

const fetchOrder = async () => {
  if (!props.orderId)
    return

  isLoading.value = true
  loadError.value = ''
  order.value = null

  try {
    const response: any = await $api(`admin/orders/${props.orderId}`)
    const payload = response.data ?? response

    order.value = payload.order ?? payload.data?.order ?? payload
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    loadError.value = responseData?.message ?? 'Unable to load order details.'
  }
  finally {
    isLoading.value = false
  }
}

const closeDialog = () => emit('update:isDialogVisible', false)

watch(
  () => [props.isDialogVisible, props.orderId],
  ([isVisible]) => {
    if (isVisible)
      fetchOrder()
    else
      order.value = null
  },
)
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="1200"
    scrollable
    @update:model-value="emit('update:isDialogVisible', $event)"
  >
    <VCard>
      <DialogCloseBtn @click="closeDialog" />

      <VCardItem>
        <VCardTitle class="text-h4">
          Order Details<span v-if="order"> #{{ order.id }}</span>
        </VCardTitle>
      </VCardItem>

      <VDivider />

      <VCardText class="pa-6">
        <div
          v-if="isLoading"
          class="d-flex justify-center py-12"
        >
          <VProgressCircular
            indeterminate
            color="primary"
          />
        </div>

        <VAlert
          v-else-if="loadError"
          color="error"
          variant="tonal"
        >
          <div class="d-flex align-center justify-space-between flex-wrap gap-3">
            <span>{{ loadError }}</span>
            <VBtn
              size="small"
              variant="tonal"
              color="error"
              @click="fetchOrder"
            >
              Retry
            </VBtn>
          </div>
        </VAlert>

        <template v-else-if="order">
          <VCard
            variant="outlined"
            class="mb-6"
          >
            <VCardItem>
              <VCardTitle>General Information</VCardTitle>
              <template #append>
                <VChip
                  :color="statusColor(order.status)"
                  label
                  size="small"
                >
                  {{ statusLabel(order.status) }}
                </VChip>
              </template>
            </VCardItem>
            <VDivider />
            <VCardText>
              <VRow>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Order ID
                  </div>
                  <div class="font-weight-medium">
                    #{{ order.id }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    User
                  </div>
                  <div class="font-weight-medium">
                    {{ valueOrDash(order.user?.name) }}
                  </div>
                  <div class="text-sm">
                    {{ valueOrDash(order.user?.email) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Currency
                  </div>
                  <div class="font-weight-medium">
                    {{ valueOrDash(order.currency) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Created date
                  </div>
                  <div class="font-weight-medium">
                    {{ dateOrDash(order.created_at) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Subtotal
                  </div>
                  <div class="font-weight-medium">
                    {{ valueOrDash(subtotal) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Discount
                  </div>
                  <div class="font-weight-medium">
                    {{ valueOrDash(discount) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Total
                  </div>
                  <div class="font-weight-medium">
                    {{ valueOrDash(total) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Completed date
                  </div>
                  <div class="font-weight-medium">
                    {{ dateOrDash(order.completed_at) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Cancelled date
                  </div>
                  <div class="font-weight-medium">
                    {{ dateOrDash(order.cancelled_at ?? order.canceled_at) }}
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>

          <h5 class="text-h5 mb-4">
            Order Items
          </h5>

          <VAlert
            v-if="!detailItems.length"
            color="info"
            variant="tonal"
          >
            This order has no items.
          </VAlert>

          <VCard
            v-for="(item, index) in detailItems"
            :key="item.id ?? index"
            variant="outlined"
            class="mb-5"
          >
            <VCardItem>
              <VCardTitle>Item {{ index + 1 }}</VCardTitle>
            </VCardItem>
            <VDivider />
            <VCardText>
              <VRow class="mb-2">
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Service
                  </div>
                  <div class="font-weight-medium">
                    {{ relatedTitle(item.service) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="3"
                >
                  <div class="text-sm text-disabled">
                    Country
                  </div>
                  <div class="font-weight-medium">
                    {{ relatedTitle(item.country) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <div class="text-sm text-disabled">
                    Quantity
                  </div>
                  <div class="font-weight-medium">
                    {{ valueOrDash(item.quantity) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <div class="text-sm text-disabled">
                    Unit price
                  </div>
                  <div class="font-weight-medium">
                    {{ valueOrDash(item.unit_price) }}
                  </div>
                </VCol>
                <VCol
                  cols="12"
                  sm="6"
                  md="2"
                >
                  <div class="text-sm text-disabled">
                    Total
                  </div>
                  <div class="font-weight-medium">
                    {{ valueOrDash(itemTotal(item)) }}
                  </div>
                </VCol>
              </VRow>

              <h6 class="text-h6 mb-3">
                Number Attempts
              </h6>

              <div class="overflow-x-auto border rounded">
                <VTable class="text-no-wrap">
                  <thead>
                    <tr>
                      <th>Attempt ID</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th>Phone number</th>
                      <th>External ID</th>
                      <th>Provider reference</th>
                      <th>Failure reason</th>
                      <th>Cost</th>
                      <th>Currency</th>
                      <th>Requested date</th>
                      <th>Assigned date</th>
                      <th>Code received date</th>
                      <th>Cancelled date</th>
                      <th>Expiration date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="attempt in item.number_attempts ?? []"
                      :key="attempt.id"
                    >
                      <td>#{{ attempt.id }}</td>
                      <td>{{ relatedTitle(attempt.provider) }}</td>
                      <td>
                        <VChip
                          :color="statusColor(attempt.status)"
                          size="x-small"
                          label
                        >
                          {{ statusLabel(attempt.status) }}
                        </VChip>
                      </td>
                      <td>{{ valueOrDash(attempt.phone_number ?? attempt.number) }}</td>
                      <td>{{ valueOrDash(attempt.external_id) }}</td>
                      <td>{{ valueOrDash(attempt.provider_reference) }}</td>
                      <td>{{ valueOrDash(attempt.failure_reason) }}</td>
                      <td>{{ valueOrDash(attempt.cost) }}</td>
                      <td>{{ valueOrDash(attempt.currency) }}</td>
                      <td>{{ dateOrDash(attempt.requested_at ?? attempt.created_at) }}</td>
                      <td>{{ dateOrDash(attempt.assigned_at) }}</td>
                      <td>{{ dateOrDash(attempt.code_received_at) }}</td>
                      <td>{{ dateOrDash(attempt.cancelled_at ?? attempt.canceled_at) }}</td>
                      <td>{{ dateOrDash(attempt.expires_at ?? attempt.expiration_date) }}</td>
                    </tr>
                    <tr v-if="!item.number_attempts?.length">
                      <td
                        colspan="14"
                        class="text-center text-disabled"
                      >
                        No number attempts.
                      </td>
                    </tr>
                  </tbody>
                </VTable>
              </div>
            </VCardText>
          </VCard>
        </template>
      </VCardText>

      <VDivider />
      <VCardActions class="justify-end pa-4">
        <VBtn
          color="secondary"
          variant="tonal"
          @click="closeDialog"
        >
          Close
        </VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
