<script setup lang="ts">
export interface FunnelChartStage {
  count: number
  event: string
  label: string
}

const props = defineProps<{
  stages: FunnelChartStage[]
}>()

const stageProgress = (index: number) => props.stages.length > 1
  ? index / (props.stages.length - 1)
  : 0
</script>

<template>
  <div
    class="conversion-funnel"
    role="list"
  >
    <div
      v-for="(stage, index) in stages"
      :key="`${stage.event}-${index}`"
      class="funnel-stage-wrap"
      :class="{ 'has-connector': index < stages.length - 1 }"
      :style="{ '--stage-progress': stageProgress(index) }"
      role="listitem"
    >
      <div class="funnel-stage">
        <span class="funnel-stage-label">{{ stage.label }}</span>
        <strong class="funnel-stage-count">{{ stage.count }}</strong>
      </div>
      <div
        v-if="index < stages.length - 1"
        class="funnel-connector"
        aria-hidden="true"
      >
        <VIcon
          icon="tabler-chevron-down"
          size="18"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.conversion-funnel {
  display: flex;
  flex-direction: column;
  align-items: center;
  inline-size: 100%;
  max-inline-size: 64rem;
  margin-inline: auto;
  padding: 1.5rem 1rem 2rem;
}

.funnel-stage-wrap {
  --stage-inline-size: calc(96% - (var(--stage-progress) * 48%));

  display: flex;
  flex-direction: column;
  align-items: center;
  inline-size: var(--stage-inline-size);
  transition: inline-size 200ms ease;
}

.funnel-stage {
  display: flex;
  min-block-size: 5.75rem;
  inline-size: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 2.5rem;
  border: 1px solid rgba(var(--v-theme-primary), 0.42);
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.98), rgba(var(--v-theme-primary), 0.72));
  box-shadow: 0 0.4rem 1.2rem rgba(var(--v-theme-primary), 0.18);
  clip-path: polygon(2.5% 0, 97.5% 0, 94.5% 100%, 5.5% 100%);
  color: rgb(var(--v-theme-on-primary));
  text-align: center;
}

.funnel-stage-label {
  overflow-wrap: anywhere;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  line-height: 1.25rem;
}

.funnel-stage-count {
  margin-block-start: 0.25rem;
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.funnel-connector {
  position: relative;
  display: flex;
  block-size: 2rem;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-primary));
}

.funnel-connector::before,
.funnel-connector::after {
  position: absolute;
  border-radius: 1rem;
  background: rgba(var(--v-theme-primary), 0.28);
  content: '';
  inline-size: 2px;
}

.funnel-connector::before {
  block-size: 0.65rem;
  transform: translateY(-0.6rem);
}

.funnel-connector::after {
  block-size: 0.45rem;
  transform: translateY(0.55rem);
}

@media (max-width: 600px) {
  .conversion-funnel {
    padding-inline: 0;
  }

  .funnel-stage-wrap {
    --stage-inline-size: calc(100% - (var(--stage-progress) * 28%));
  }

  .funnel-stage {
    min-block-size: 5.25rem;
    padding-inline: 1.75rem;
  }
}
</style>
