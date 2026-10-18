<script setup lang="ts">
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { VForm } from 'vuetify/components/VForm'

export interface SelectOption {
  title: string
  value: number | string
}

interface RelatedRecord {
  id: number | string
  name: string
  code?: string
}

export interface ProviderOffer {
  id: number | string
  provider?: RelatedRecord
  service?: RelatedRecord
  country?: RelatedRecord
  number_provider_id?: number | string
  number_offer_id: number | string
  external_service_id: string
  external_country_id: string
  external_product_id: string
  price: number | string
  currency: string
  cost: number | string
  priority: number | string
  sort_order?: number | null
  status: 'active' | 'inactive'
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface Props {
  isDialogVisible: boolean
  offers: SelectOption[]
  providerOffer?: ProviderOffer | null
  providers: SelectOption[]
}

interface FiveSimPriceRow {
  service: string
  provider: string
  actualCost: number
  cost: number
  price: number
  count: number | null
  country?: string
  providerLabel?: string
  providerPlatform?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'saved', message: string): void
  (e: 'update:isDialogVisible', value: boolean): void
}>()

const refForm = ref<VForm>()
const isLoading = ref(false)
const isFetchingPrices = ref(false)
const isPriceDialogVisible = ref(false)
const priceRows = ref<FiveSimPriceRow[]>([])
const generalError = ref('')
const fetchPricesError = ref('')
const errors = ref<Record<string, string | string[] | undefined>>({})

const statusOptions = [
  { title: 'Active', value: 'active' },
  { title: 'Inactive', value: 'inactive' },
]

const form = ref({
  number_provider_id: null as number | string | null,
  number_offer_id: null as number | null,
  external_service_id: '',
  external_country_id: '',
  external_product_id: '',
  price: null as number | null,
  currency: 'USD',
  cost: null as number | null,
  priority: 0,
  sort_order: 0,
  status: 'active' as 'active' | 'inactive',
  metadata: {} as Record<string, unknown>,
})

const syncExternalCountryId = () => {
  if (props.providerOffer || form.value.number_offer_id === null)
    return

  const selectedCountry = props.offers.find(option => String(option.value) === String(form.value.number_offer_id))

  if (selectedCountry) {
    const country = selectedCountry.title.split('-').at(-1)?.trim()

    if (country)
      form.value.external_country_id = country.toLowerCase()
  }
}

watch(
  [() => form.value.number_provider_id, () => form.value.number_offer_id],
  syncExternalCountryId,
)

const resetForm = () => {
  const providerOffer = props.providerOffer

  form.value = {
    number_provider_id: providerOffer?.number_provider_id ?? providerOffer?.provider?.id ?? null,
    number_offer_id: providerOffer ? Number(providerOffer.number_offer_id) : null,
    external_service_id: providerOffer?.external_service_id ?? '',
    external_country_id: providerOffer?.external_country_id ?? '',
    external_product_id: providerOffer?.external_product_id ?? '',
    price: providerOffer ? Number(providerOffer.price) : null,
    currency: providerOffer?.currency ?? 'USD',
    cost: providerOffer ? Number(providerOffer.cost) : null,
    priority: providerOffer ? Number(providerOffer.priority) : 0,
    sort_order: providerOffer?.sort_order ?? 0,
    status: providerOffer?.status ?? 'active',
    metadata: providerOffer?.metadata ?? {},
  }
  generalError.value = ''
  fetchPricesError.value = ''
  isPriceDialogVisible.value = false
  priceRows.value = []
  errors.value = {}
  nextTick(() => refForm.value?.resetValidation())
}

watch(() => props.isDialogVisible, isVisible => {
  if (isVisible)
    resetForm()
})

const closeDialog = () => {
  if (!isLoading.value && !isFetchingPrices.value)
    emit('update:isDialogVisible', false)
}

const roundUpToTwoDecimals = (value: number) => Math.ceil(value * 100) / 100

const decimalToCentsRoundedUp = (value: unknown, multiplierNumerator: bigint, multiplierDenominator: bigint) => {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value).trim())

  if (!match)
    return null

  const decimals = match[2] ?? ''
  const denominator = 10n ** BigInt(decimals.length)
  const numerator = BigInt(`${match[1]}${decimals}`)
  const scaledNumerator = numerator * multiplierNumerator * 100n
  const scaledDenominator = denominator * multiplierDenominator

  return (scaledNumerator + scaledDenominator - 1n) / scaledDenominator
}

const fetchFiveSimPrices = async () => {
  const response: any = await $api('v1/admin/providers/5sim/prices', {
    query: {
      provider_offer_id: form.value.number_offer_id,
      country: form.value.external_country_id,
    },
  })

  const countries = response?.data ?? response
  const rows: FiveSimPriceRow[] = []

  if (countries && typeof countries === 'object') {
    Object.values(countries).forEach(services => {
      if (!services || typeof services !== 'object')
        return

      Object.entries(services).forEach(([service, providers]) => {
        if (!providers || typeof providers !== 'object')
          return

        Object.entries(providers).forEach(([provider, pricing]) => {
          if (!pricing || typeof pricing !== 'object')
            return

          const apiCost = Number((pricing as Record<string, unknown>).cost)
          const count = Number((pricing as Record<string, unknown>).count)

          if (!Number.isFinite(apiCost))
            return

          rows.push({
            service,
            provider,
            actualCost: roundUpToTwoDecimals(apiCost),
            cost: roundUpToTwoDecimals(apiCost * 1.05),
            price: roundUpToTwoDecimals(apiCost * 1.5),
            count: Number.isFinite(count) ? count : 0,
          })
        })
      })
    })
  }

  priceRows.value = rows.sort((firstRow, secondRow) => firstRow.actualCost - secondRow.actualCost)
  isPriceDialogVisible.value = true
}

const fetchSmsCodexPrices = async () => {
  const country = form.value.external_country_id.trim()
  const service = form.value.external_service_id.trim()

  if (!country || !service) {
    fetchPricesError.value = 'External country ID and External service ID are required to fetch SMSCodex prices.'

    return
  }

  const response: any = await $api('v1/admin/providers/smscodex/prices', {
    query: { country, service },
  })

  const payload = response?.data ?? response
  const items = Array.isArray(payload?.items) ? payload.items : []
  const rows: FiveSimPriceRow[] = []

  items.forEach((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return

    const item = entry as Record<string, unknown>
    const minPrice = item.min_price
    const actualCostCents = decimalToCentsRoundedUp(minPrice, 1n, 1n)
    const costCents = decimalToCentsRoundedUp(minPrice, 110n, 100n)

    if (actualCostCents === null || costCents === null)
      return

    const availableValue = item.available

    const available = availableValue === null || availableValue === undefined || String(availableValue).trim() === ''
      ? null
      : Number(availableValue)

    const countryValue = typeof item.country === 'string' ? item.country.trim() : ''
    const providerId = typeof item.provider_id === 'string' ? item.provider_id.trim() : ''
    const providerLabel = typeof item.provider_label === 'string' ? item.provider_label.trim() : ''
    const itemService = typeof item.service === 'string' ? item.service.trim() : ''
    const priceCents = (costCents * 150n + 99n) / 100n

    if (!providerId || !itemService)
      return

    const actualCost = Number(actualCostCents) / 100
    const cost = Number(costCents) / 100
    const price = Number(priceCents) / 100

    if (![actualCost, cost, price].every(Number.isFinite))
      return

    rows.push({
      service: itemService,
      provider: providerId,
      providerLabel,
      providerPlatform: 1,
      country: countryValue,
      actualCost,
      cost,
      price,
      count: available !== null && Number.isFinite(available) && available >= 0 ? available : null,
    })
  })

  priceRows.value = rows.sort((firstRow, secondRow) => firstRow.actualCost - secondRow.actualCost)
  isPriceDialogVisible.value = true
}

const fetchPrices = async () => {
  fetchPricesError.value = ''

  const providerId = Number(form.value.number_provider_id)

  if (providerId === 2 && (!form.value.number_offer_id || !form.value.external_country_id.trim())) {
    fetchPricesError.value = 'Offer ID and External country ID are required to fetch 5SIM prices.'

    return
  }

  if (providerId === 1 && (!form.value.external_country_id.trim() || !form.value.external_service_id.trim())) {
    fetchPricesError.value = 'External country ID and External service ID are required to fetch SMSCodex prices.'

    return
  }

  if (providerId !== 1 && providerId !== 2) {
    fetchPricesError.value = 'Price lookup is available for SMSCodex and 5SIM providers.'

    return
  }

  isFetchingPrices.value = true

  try {
    if (providerId === 2)
      await fetchFiveSimPrices()
    else
      await fetchSmsCodexPrices()
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    fetchPricesError.value = responseData?.message ?? `Unable to fetch ${providerId === 1 ? 'SMSCodex' : '5SIM'} prices.`
  }
  finally {
    isFetchingPrices.value = false
  }
}

const selectPrice = (row: FiveSimPriceRow) => {
  form.value.cost = row.cost
  form.value.price = row.price
  form.value.external_product_id = row.provider

  if (row.providerPlatform !== 1)
    form.value.external_service_id = row.service

  if (row.providerPlatform === 1) {
    form.value.number_provider_id = row.providerPlatform
    form.value.external_country_id = row.country ?? ''
  }

  isPriceDialogVisible.value = false
}

const formatPrice = (value: number) => value.toFixed(2)
const formatCount = (value: number | null) => value === null ? '—' : new Intl.NumberFormat().format(value)

const submit = async () => {
  const { valid } = await refForm.value?.validate() ?? { valid: false }

  if (!valid)
    return

  isLoading.value = true
  generalError.value = ''
  errors.value = {}

  try {
    const isEditing = Boolean(props.providerOffer)

    const payload = {
      number_provider_id: form.value.number_provider_id,
      number_offer_id: Number(form.value.number_offer_id),
      external_service_id: form.value.external_service_id,
      external_country_id: form.value.external_country_id,
      external_product_id: form.value.external_product_id,
      price: Number(form.value.price),
      currency: form.value.currency,
      cost: Number(form.value.cost),
      priority: Number(form.value.priority),
      sort_order: Number(form.value.sort_order),
      status: form.value.status,
      metadata: form.value.metadata,
    }

    await $api(isEditing ? `admin/provider-offers/${props.providerOffer?.id}` : 'admin/provider-offers', {
      method: isEditing ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    })

    if (isEditing) {
      emit('update:isDialogVisible', false)
    }
    else {
      form.value.number_offer_id = null
      form.value.external_country_id = ''
      errors.value = {}
      generalError.value = ''
      nextTick(() => refForm.value?.resetValidation())
    }

    emit('saved', isEditing ? 'Provider offer updated successfully.' : 'Provider offer created successfully.')
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    errors.value = responseData?.errors ?? {}
    generalError.value = responseData?.message ?? 'Unable to save the provider offer.'
  }
  finally {
    isLoading.value = false
  }
}
</script>

<template>
  <VDialog
    :model-value="props.isDialogVisible"
    max-width="800"
    persistent
    @update:model-value="emit('update:isDialogVisible', $event)"
  >
    <VCard>
      <DialogCloseBtn
        :disabled="isLoading"
        @click="closeDialog"
      />

      <VCardItem class="text-center">
        <VCardTitle class="text-h4">
          {{ providerOffer ? 'Edit Provider Offer' : 'Add Provider Offer' }}
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

        <VAlert
          v-if="fetchPricesError"
          color="error"
          variant="tonal"
          class="mb-5"
        >
          {{ fetchPricesError }}
        </VAlert>

        <VForm
          ref="refForm"
          @submit.prevent="submit"
        >
          <VRow>
            <VCol
              cols="12"
              sm="6"
            >
              <AppAutocomplete
                v-model="form.number_provider_id"
                label="Provider"
                placeholder="Select provider"
                :items="providers"
                :rules="[requiredValidator]"
                :error-messages="errors.number_provider_id"
              />
              <VBtn
                class="mt-3"
                variant="tonal"
                prepend-icon="tabler-download"
                :loading="isFetchingPrices"
                :disabled="isLoading || isFetchingPrices"
                @click="fetchPrices"
              >
                Fetch Prices
              </VBtn>
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppAutocomplete
                v-model="form.number_offer_id"
                label="Offer ID"
                placeholder="Select offer"
                :items="offers"
                :rules="[requiredValidator]"
                :error-messages="errors.number_offer_id"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppTextField
                v-model="form.external_service_id"
                label="External service ID"
                :rules="[requiredValidator]"
                :error-messages="errors.external_service_id"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppTextField
                v-model="form.external_country_id"
                label="External country ID"
                :rules="[requiredValidator]"
                :error-messages="errors.external_country_id"
              />
            </VCol>
            <VCol cols="12">
              <AppTextField
                v-model="form.external_product_id"
                label="External product ID"
                :rules="[requiredValidator]"
                :error-messages="errors.external_product_id"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppTextField
                v-model.number="form.price"
                label="Price"
                type="number"
                min="0"
                step="any"
                :rules="[requiredValidator]"
                :error-messages="errors.price"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppTextField
                v-model="form.currency"
                label="Currency"
                placeholder="USD"
                :rules="[requiredValidator]"
                :error-messages="errors.currency"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppTextField
                v-model.number="form.cost"
                label="Cost"
                type="number"
                min="0"
                step="any"
                :rules="[requiredValidator]"
                :error-messages="errors.cost"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppTextField
                v-model.number="form.priority"
                label="Priority"
                type="number"
                min="0"
                :rules="[requiredValidator]"
                :error-messages="errors.priority"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppTextField
                v-model.number="form.sort_order"
                label="Sort Order"
                type="number"
                step="1"
                :rules="[requiredValidator, integerValidator]"
                :error-messages="errors.sort_order"
              />
            </VCol>
            <VCol
              cols="12"
              sm="6"
            >
              <AppAutocomplete
                v-model="form.status"
                label="Status"
                :items="statusOptions"
                :rules="[requiredValidator]"
                :error-messages="errors.status"
              />
            </VCol>
            <VCol
              cols="12"
              class="d-flex justify-end gap-3"
            >
              <VBtn
                color="secondary"
                variant="tonal"
                :disabled="isLoading || isFetchingPrices"
                @click="closeDialog"
              >
                Cancel
              </VBtn>
              <VBtn
                type="submit"
                :loading="isLoading"
                :disabled="isLoading"
              >
                Save
              </VBtn>
            </VCol>
          </VRow>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>

  <VDialog
    v-model="isPriceDialogVisible"
    max-width="900"
    persistent
  >
    <VCard>
      <DialogCloseBtn @click="isPriceDialogVisible = false" />

      <VCardItem class="text-center">
        <VCardTitle class="text-h4">
          Select {{ Number(form.number_provider_id) === 1 ? 'SMSCodex' : '5SIM' }} Price
        </VCardTitle>
      </VCardItem>

      <VCardText>
        <VAlert
          v-if="!priceRows.length"
          color="info"
          variant="tonal"
        >
          No prices were returned for this offer and country.
        </VAlert>

        <VTable v-else>
          <thead>
            <tr>
              <th>Service</th>
              <th>Provider</th>
              <th class="text-end">
                Actual Cost
              </th>
              <th class="text-end">
                Cost
              </th>
              <th class="text-end">
                Price
              </th>
              <th class="text-end">
                Count
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, index) in priceRows"
              :key="`${row.service}-${row.provider}-${index}`"
            >
              <td>{{ row.service }}</td>
              <td>
                {{ row.providerLabel || row.provider }}
              </td>
              <td class="text-end">
                {{ formatPrice(row.actualCost) }}
              </td>
              <td class="text-end">
                {{ formatPrice(row.cost) }}
              </td>
              <td class="text-end">
                {{ formatPrice(row.price) }}
              </td>
              <td class="text-end">
                {{ formatCount(row.count) }}
              </td>
              <td>
                <VBtn
                  size="small"
                  @click="selectPrice(row)"
                >
                  Select
                </VBtn>
              </td>
            </tr>
          </tbody>
        </VTable>
      </VCardText>
    </VCard>
  </VDialog>
</template>
