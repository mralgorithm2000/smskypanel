<script setup lang="ts">
definePage({
  meta: {
    action: 'funnel.view',
    subject: 'all',
  },
})

interface FunnelStage {
  stage?: string
  count?: number | null
  conversion_from_first?: number | null
  conversion_from_previous?: number | null
}

interface FunnelPayload {
  filters?: Record<string, unknown>
  main_funnel?: FunnelStage[]
  activation_funnel?: FunnelStage[]
  purchase_attempts?: { customers?: number | null; attempts?: number | null }
  activation_outcomes?: {
    cancelled_attempts?: number | null
    expired_attempts?: number | null
    still_waiting_attempts?: number | null
    unlinked_purchase_customers?: number | null
  }
  platform_comparison?: {
    customers?: Record<string, { count?: number | null; percentage?: number | null } | undefined>
  }
  payments?: Record<string, { events?: number | null; transactions?: number | null } | undefined>
}

type FunnelResponse = FunnelPayload | { data?: FunnelResponse | null } | null | undefined

// $api is ofetch and normally returns the parsed response body. Keep accepting
// the API's { data: ... } envelope as well as an already-unwrapped payload.
const normalizeFunnelResponse = (response: FunnelResponse): FunnelPayload => {
  let value: FunnelResponse = response

  // Some deployments/interceptors can wrap the body more than once. Unwrap
  // only when the current object isn't already recognizably a funnel payload.
  for (let depth = 0; depth < 3 && value && typeof value === 'object'; depth++) {
    const candidate = value as Record<string, unknown>
    if ('main_funnel' in candidate || 'activation_funnel' in candidate || 'purchase_attempts' in candidate || 'activation_outcomes' in candidate || 'platform_comparison' in candidate || 'payments' in candidate)
      return value as FunnelPayload

    if (!('data' in candidate))
      break

    value = candidate.data as FunnelResponse
  }

  return value && typeof value === 'object' ? value as FunnelPayload : {}
}

const { t } = useI18n()

const startOrigin = ref('')
const platformId = ref('')
const deduplicate = ref(true)
const dateFrom = ref('')
const dateTo = ref('')
const payload = ref<FunnelPayload>({})
const isLoading = ref(false)
const hasLoaded = ref(false)
const loadError = ref('')

const datePickerConfig = { dateFormat: 'Y-m-d' }
const numberFormat = new Intl.NumberFormat()
const formatCount = (value: number | null | undefined) => typeof value === 'number' ? numberFormat.format(value) : '—'
const formatPercent = (value: number | null | undefined) => typeof value === 'number' ? `${value.toFixed(value % 1 ? 2 : 0)}%` : '—'

const mainStages = computed(() => Array.isArray(payload.value.main_funnel) ? payload.value.main_funnel : [])
const activationStages = computed(() => Array.isArray(payload.value.activation_funnel) ? payload.value.activation_funnel : [])
const mainMax = computed(() => Math.max(0, ...mainStages.value.map(stage => Number(stage.count) || 0)))
const activationMax = computed(() => Math.max(0, ...activationStages.value.map(stage => Number(stage.count) || 0)))
const funnelStageWidth = (count: number | null | undefined, maximum: number) => `${maximum ? 55 + (Math.max(0, Number(count) || 0) / maximum) * 45 : 55}%`

const hasData = computed(() => mainStages.value.length > 0
  || activationStages.value.length > 0
  || !!payload.value.purchase_attempts
  || !!payload.value.activation_outcomes
  || !!payload.value.platform_comparison
  || !!payload.value.payments)  

const summary = computed(() => [
  { label: t('analyticsFunnel.startedCustomers'), value: mainStages.value[0]?.count, icon: 'tabler-player-play', color: 'primary' },
  { label: t('analyticsFunnel.purchaseSuccessfulCustomers'), value: mainStages.value.at(-1)?.count, icon: 'tabler-circle-check', color: 'success' },
  { label: t('analyticsFunnel.purchaseCustomers'), value: payload.value.purchase_attempts?.customers, icon: 'tabler-users', color: 'info' },
  { label: t('analyticsFunnel.purchaseAttempts'), value: payload.value.purchase_attempts?.attempts, icon: 'tabler-repeat', color: 'warning' },
  { label: t('analyticsFunnel.smsCodesReceived'), value: activationStages.value.find(stage => stage.stage === 'SMS Code Received')?.count, icon: 'tabler-message-check', color: 'secondary' },
])

const outcomeCards = computed(() => {
  const outcomes = payload.value.activation_outcomes ?? {}

  return [
    { key: 'cancelled_attempts', label: t('analyticsFunnel.cancelledAttempts'), value: outcomes.cancelled_attempts, icon: 'tabler-circle-x', color: 'error' },
    { key: 'expired_attempts', label: t('analyticsFunnel.expiredAttempts'), value: outcomes.expired_attempts, icon: 'tabler-clock-x', color: 'warning' },
    { key: 'still_waiting_attempts', label: t('analyticsFunnel.stillWaitingAttempts'), value: outcomes.still_waiting_attempts, icon: 'tabler-hourglass', color: 'info' },
    { key: 'unlinked_purchase_customers', label: t('analyticsFunnel.unlinkedPurchaseCustomers'), value: outcomes.unlinked_purchase_customers, icon: 'tabler-link-off', color: 'secondary' },
  ]
})

const platformKeys = ['bot', 'mini_app', 'unknown'] as const
const platformLabels: Record<string, string> = { bot: 'Bot', mini_app: 'Mini App', unknown: 'Unknown' }

const platforms = computed(() => platformKeys.map(key => ({
  key,
  label: platformLabels[key],
  count: payload.value.platform_comparison?.customers?.[key]?.count,
  percentage: payload.value.platform_comparison?.customers?.[key]?.percentage,
})))

const platformValues = computed(() => platforms.value.map(item => Number(item.count) || 0))

const platformChartOptions = computed(() => ({
  chart: { type: 'donut', toolbar: { show: false }, fontFamily: 'inherit', animations: { enabled: false } },
  labels: platforms.value.map(item => item.label),
  colors: ['#7367f0', '#28c76f', '#a8aaae'],
  legend: { show: false },
  dataLabels: { enabled: false },
  stroke: { width: 3, colors: ['rgb(var(--v-theme-surface))'] },
  tooltip: { y: { formatter: (value: number) => `${numberFormat.format(value)} ${t('analyticsFunnel.customers').toLowerCase()}` } },
  plotOptions: { pie: { donut: { size: '72%' } } },
  responsive: [{ breakpoint: 600, options: { chart: { height: 230 } } }],
}))

const payments = computed(() => [
  { key: 'started', label: t('analyticsFunnel.paymentStarted'), value: payload.value.payments?.started },
  { key: 'succeeded', label: t('analyticsFunnel.paymentSucceeded'), value: payload.value.payments?.succeeded },
  { key: 'failed', label: t('analyticsFunnel.paymentFailed'), value: payload.value.payments?.failed },
])

const paymentValue = (value: number | null | undefined) => value === null ? t('analyticsFunnel.notAvailable') : formatCount(value)

const fetchFunnel = async () => {
  isLoading.value = true
  loadError.value = ''

  try {
    const response = await $api<FunnelResponse>('v1/admin/analytics/funnel', {
      query: {
        start_origin: startOrigin.value || undefined,
        platform_id: platformId.value || undefined,
        deduplicate: deduplicate.value,
        date_from: dateFrom.value || undefined,
        date_to: dateTo.value || undefined,
      },
    })

    payload.value = normalizeFunnelResponse(response)
  }
  catch (error: any) {
    const responseData = error?.data ?? error?.response?._data

    payload.value = {}
    loadError.value = responseData?.message ?? t('analyticsFunnel.loadError')
  }
  finally {
    isLoading.value = false
    hasLoaded.value = true
  }
}

const resetFilters = () => {
  startOrigin.value = ''
  platformId.value = ''
  deduplicate.value = true
  dateFrom.value = ''
  dateTo.value = ''
  fetchFunnel()
}

onMounted(fetchFunnel)
</script>

<template>
  <section class="analytics-funnel-page">
    <div class="d-flex flex-wrap align-center justify-space-between gap-3 mb-6">
      <div>
        <h1 class="text-h4 mb-1">{{ t('analyticsFunnel.title') }}</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">{{ t('analyticsFunnel.subtitle') }}</p>
      </div>
      <VBtn
        color="primary"
        variant="tonal"
        prepend-icon="tabler-refresh"
        :loading="isLoading"
        @click="fetchFunnel"
      >
        {{ t('analyticsFunnel.refresh') }}
      </VBtn>
    </div>

    <VCard class="mb-6">
      <VCardItem>
        <VCardTitle>{{ t('analyticsFunnel.filters') }}</VCardTitle>
      </VCardItem>
      <VCardText>
        <VRow>
          <VCol cols="12" sm="6" md="4">
            <AppTextField v-model="startOrigin" :label="t('analyticsFunnel.startOrigin')" clearable />
          </VCol>
          <VCol cols="12" sm="6" md="4">
            <AppTextField v-model="platformId" :label="t('analyticsFunnel.platformId')" inputmode="numeric" clearable />
          </VCol>
          <VCol cols="12" sm="6" md="4" class="d-flex align-center">
            <VSwitch v-model="deduplicate" :label="t('analyticsFunnel.deduplicate')" color="primary" hide-details />
          </VCol>
          <VCol cols="12" sm="6" md="4">
            <AppDateTimePicker v-model="dateFrom" :label="t('analyticsFunnel.dateFrom')" :config="datePickerConfig" clearable />
          </VCol>
          <VCol cols="12" sm="6" md="4">
            <AppDateTimePicker v-model="dateTo" :label="t('analyticsFunnel.dateTo')" :config="datePickerConfig" clearable />
          </VCol>
          <VCol cols="12" sm="6" md="4" class="d-flex align-end gap-3">
            <VBtn color="primary" prepend-icon="tabler-search" :loading="isLoading" @click="fetchFunnel">
              {{ t('analyticsFunnel.apply') }}
            </VBtn>
            <VBtn color="secondary" variant="tonal" prepend-icon="tabler-refresh" :disabled="isLoading" @click="resetFilters">
              {{ t('analyticsFunnel.reset') }}
            </VBtn>
          </VCol>
        </VRow>
      </VCardText>
    </VCard>

    <VProgressLinear v-if="isLoading" indeterminate color="primary" class="mb-4" />
    <VAlert v-if="loadError" color="error" variant="tonal" class="mb-6" role="alert">
      <div class="d-flex flex-wrap align-center justify-space-between gap-3">
        <span>{{ loadError }}</span>
        <VBtn color="error" variant="outlined" size="small" prepend-icon="tabler-refresh" @click="fetchFunnel">
          {{ t('analyticsFunnel.retry') }}
        </VBtn>
      </div>
    </VAlert>
    <VCard v-else-if="hasLoaded && !isLoading && !hasData" class="mb-6">
      <VCardText class="text-center text-medium-emphasis py-10">{{ t('analyticsFunnel.empty') }}</VCardText>
    </VCard>

    <template v-else-if="hasData">
      <VRow class="mb-2">
        <VCol v-for="metric in summary" :key="metric.label" cols="12" sm="6" lg="2.4">
          <VCard class="summary-card h-100">
            <VCardText class="d-flex align-start justify-space-between gap-2">
              <div>
                <div class="text-body-2 text-medium-emphasis mb-2">{{ metric.label }}</div>
                <div class="text-h4 font-weight-semibold">{{ formatCount(metric.value) }}</div>
                <div class="text-caption text-medium-emphasis mt-1">{{ t('analyticsFunnel.customersOrAttempts') }}</div>
              </div>
              <VAvatar :color="metric.color" variant="tonal" rounded>
                <VIcon :icon="metric.icon" />
              </VAvatar>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VCard class="mb-6">
        <VCardItem>
          <VCardTitle>{{ t('analyticsFunnel.mainTitle') }}</VCardTitle>
          <VCardSubtitle>{{ t('analyticsFunnel.mainSubtitle') }}</VCardSubtitle>
        </VCardItem>
        <VCardText v-if="mainStages.length" class="pt-2">
          <div class="funnel-visual" role="list" :aria-label="t('analyticsFunnel.mainTitle')">
            <div
              v-for="(stage, index) in mainStages"
              :key="`${stage.stage}-${index}`"
              class="funnel-step"
              role="listitem"
              :style="{ '--step-width': funnelStageWidth(stage.count, mainMax) }"
            >
              <div class="funnel-step-band">
                <span class="funnel-stage-label">{{ stage.stage || t('analyticsFunnel.unknownStage') }}</span>
                <strong class="funnel-count">{{ formatCount(stage.count) }}</strong>
              </div>
              <div class="funnel-conversions">
                <span>{{ t('analyticsFunnel.fromFirst') }} <strong>{{ formatPercent(stage.conversion_from_first) }}</strong></span>
                <span>{{ t('analyticsFunnel.fromPrevious') }} <strong>{{ formatPercent(stage.conversion_from_previous) }}</strong></span>
              </div>
            </div>
          </div>
        </VCardText>
        <VCardText v-else class="text-medium-emphasis">{{ t('analyticsFunnel.noStageData') }}</VCardText>
      </VCard>

      <VRow v-if="payload.purchase_attempts" class="mb-6">
        <VCol cols="12">
          <VCard>
            <VCardItem>
              <VCardTitle>{{ t('analyticsFunnel.purchaseMetricsTitle') }}</VCardTitle>
              <VCardSubtitle>{{ t('analyticsFunnel.purchaseMetricsSubtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText class="d-flex flex-wrap ga-8">
              <div><div class="text-caption text-medium-emphasis">{{ t('analyticsFunnel.uniqueCustomers') }}</div><strong class="text-h5">{{ formatCount(payload.purchase_attempts.customers) }}</strong></div>
              <div><div class="text-caption text-medium-emphasis">{{ t('analyticsFunnel.purchaseAttempts') }}</div><strong class="text-h5">{{ formatCount(payload.purchase_attempts.attempts) }}</strong></div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VRow class="mb-2">
        <VCol cols="12" lg="6">
          <VCard class="h-100">
            <VCardItem>
              <VCardTitle>{{ t('analyticsFunnel.activationTitle') }}</VCardTitle>
              <VCardSubtitle>{{ t('analyticsFunnel.activationSubtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText v-if="activationStages.length" class="pt-2">
              <div class="funnel-visual activation-list" role="list" :aria-label="t('analyticsFunnel.activationTitle')">
                <div
                  v-for="(stage, index) in activationStages"
                  :key="`${stage.stage}-${index}`"
                  class="funnel-step"
                  role="listitem"
                  :style="{ '--step-width': funnelStageWidth(stage.count, activationMax) }"
                >
                  <div class="funnel-step-band activation-step-band">
                    <span class="funnel-stage-label">{{ stage.stage || t('analyticsFunnel.unknownStage') }}</span>
                    <strong class="funnel-count">{{ formatCount(stage.count) }}</strong>
                  </div>
                  <div class="funnel-conversions">
                    <span>{{ t('analyticsFunnel.fromFirst') }} <strong>{{ formatPercent(stage.conversion_from_first) }}</strong></span>
                    <span>{{ t('analyticsFunnel.fromPrevious') }} <strong>{{ formatPercent(stage.conversion_from_previous) }}</strong></span>
                  </div>
                </div>
              </div>
            </VCardText>
            <VCardText v-else class="text-medium-emphasis">{{ t('analyticsFunnel.noStageData') }}</VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" lg="6">
          <VCard class="h-100">
            <VCardItem>
              <VCardTitle>{{ t('analyticsFunnel.outcomesTitle') }}</VCardTitle>
              <VCardSubtitle>{{ t('analyticsFunnel.outcomesSubtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <VRow>
                <VCol v-for="outcome in outcomeCards" :key="outcome.key" cols="12" sm="6">
                  <div class="outcome-card">
                    <VAvatar :color="outcome.color" variant="tonal" size="38" rounded>
                      <VIcon :icon="outcome.icon" size="20" />
                    </VAvatar>
                    <div class="min-width-0">
                      <div class="text-caption text-medium-emphasis">{{ outcome.label }}</div>
                      <strong class="text-h5">{{ formatCount(outcome.value) }}</strong>
                    </div>
                  </div>
                </VCol>
              </VRow>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>

      <VRow>
        <VCol cols="12" lg="6">
          <VCard class="h-100">
            <VCardItem>
              <VCardTitle>{{ t('analyticsFunnel.platformTitle') }}</VCardTitle>
              <VCardSubtitle>{{ t('analyticsFunnel.platformSubtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <div v-if="platforms.some(item => typeof item.count === 'number')" class="platform-layout">
                <div class="platform-chart" role="img" :aria-label="t('analyticsFunnel.platformChartLabel')">
                  <VueApexCharts type="donut" height="260" :options="platformChartOptions" :series="platformValues" />
                </div>
                <div class="platform-legend" role="list" :aria-label="t('analyticsFunnel.platformTitle')">
                  <div v-for="(platform, index) in platforms" :key="platform.key" class="platform-legend-row" role="listitem">
                    <span class="legend-dot" :class="`legend-dot-${index}`" aria-hidden="true" />
                    <span class="platform-name">{{ platform.label }}</span>
                    <strong>{{ formatCount(platform.count) }}</strong>
                    <span class="text-medium-emphasis">{{ formatPercent(platform.percentage) }}</span>
                  </div>
                </div>
              </div>
              <div v-else class="text-center text-medium-emphasis py-8">{{ t('analyticsFunnel.noPlatformData') }}</div>
              <div class="text-caption text-medium-emphasis mt-2">{{ t('analyticsFunnel.platformBasis') }}</div>
            </VCardText>
          </VCard>
        </VCol>
        <VCol cols="12" lg="6">
          <VCard class="h-100">
            <VCardItem>
              <VCardTitle>{{ t('analyticsFunnel.paymentsTitle') }}</VCardTitle>
              <VCardSubtitle>{{ t('analyticsFunnel.paymentsSubtitle') }}</VCardSubtitle>
            </VCardItem>
            <VCardText>
              <div class="payment-list" role="list" :aria-label="t('analyticsFunnel.paymentsTitle')">
                <div v-for="payment in payments" :key="payment.key" class="payment-row" role="listitem">
                  <span class="payment-label">{{ payment.label }}</span>
                  <div class="payment-values">
                    <span><strong>{{ formatCount(payment.value?.events) }}</strong> {{ t('analyticsFunnel.eventsLabel') }}</span>
                    <span><strong>{{ paymentValue(payment.value?.transactions) }}</strong> {{ t('analyticsFunnel.transactionsLabel') }}</span>
                  </div>
                </div>
              </div>
            </VCardText>
          </VCard>
        </VCol>
      </VRow>
    </template>
  </section>
</template>

<style scoped>
.analytics-funnel-page { --analytics-gap: 1rem; }
.summary-card { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.funnel-visual { display: grid; justify-items: center; gap: .25rem; max-width: 760px; margin-inline: auto; padding-block: .5rem; }
.funnel-step { display: grid; justify-items: center; width: 100%; }
.funnel-step-band { display: flex; align-items: center; justify-content: space-between; gap: .75rem; width: var(--step-width); min-height: 3.5rem; padding: .65rem clamp(.75rem, 3vw, 1.5rem); color: white; background: linear-gradient(110deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), .78)); clip-path: polygon(0 0, 100% 0, 94% 100%, 6% 100%); transition: width .25s ease; }
.activation-step-band { background: linear-gradient(110deg, rgb(var(--v-theme-info)), rgba(var(--v-theme-info), .76)); }
.funnel-stage-label { min-width: 0; font-size: .9375rem; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
.funnel-count { flex: 0 0 auto; font-size: 1rem; font-variant-numeric: tabular-nums; }
.funnel-conversions { display: flex; justify-content: center; flex-wrap: wrap; gap: .25rem 1.25rem; padding-block: .3rem .45rem; color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); font-size: .75rem; }
.funnel-conversions strong { margin-inline-start: .2rem; color: rgb(var(--v-theme-on-surface)); font-variant-numeric: tabular-nums; }
.activation-list { max-width: 620px; }
.outcome-card { display: flex; min-height: 5rem; align-items: center; gap: .8rem; padding: .75rem; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: .5rem; }
.platform-layout { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr); align-items: center; gap: 1rem; }
.platform-chart { min-width: 0; }
.platform-legend { display: grid; gap: .9rem; }
.platform-legend-row { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto auto; align-items: center; gap: .55rem; font-size: .875rem; }
.platform-name { overflow-wrap: anywhere; }
.legend-dot { width: .65rem; height: .65rem; border-radius: 50%; background: #7367f0; }
.legend-dot-1 { background: #28c76f; }
.legend-dot-2 { background: #a8aaae; }
.payment-list { display: grid; }
.payment-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; padding: .95rem 0; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.payment-row:first-child { padding-top: .25rem; }
.payment-row:last-child { padding-bottom: .25rem; border-bottom: 0; }
.payment-label { font-weight: 600; }
.payment-values { display: flex; flex-wrap: wrap; gap: .5rem 1rem; color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity)); font-size: .8125rem; }
.payment-values strong { color: rgb(var(--v-theme-on-surface)); font-variant-numeric: tabular-nums; }
@media (max-width: 600px) {
  .platform-layout { grid-template-columns: 1fr; gap: .25rem; }
  .platform-chart { max-width: 320px; width: 100%; margin-inline: auto; }
  .platform-legend { gap: .7rem; }
}
</style>
