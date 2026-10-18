<script setup lang="ts">
interface Props {
  error?: string
  isDialogVisible: boolean
  loading?: boolean
  question: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'update:isDialogVisible', value: boolean): void
}>()
</script>

<template>
  <VDialog
    max-width="500"
    :model-value="props.isDialogVisible"
    persistent
    @update:model-value="emit('update:isDialogVisible', $event)"
  >
    <VCard class="text-center px-10 py-6">
      <DialogCloseBtn
        :disabled="loading"
        @click="emit('update:isDialogVisible', false)"
      />

      <VCardText>
        <VBtn
          icon
          variant="outlined"
          color="warning"
          class="my-4"
          style="block-size: 88px; inline-size: 88px; pointer-events: none;"
        >
          <span class="text-5xl">!</span>
        </VBtn>

        <h6 class="text-lg font-weight-medium">
          {{ question }}
        </h6>
      </VCardText>

      <VAlert
        v-if="error"
        color="error"
        variant="tonal"
        class="mb-4 text-start"
      >
        {{ error }}
      </VAlert>

      <VCardText class="d-flex align-center justify-center gap-2">
        <VBtn
          color="error"
          :loading="loading"
          :disabled="loading"
          @click="emit('confirm')"
        >
          Delete
        </VBtn>

        <VBtn
          color="secondary"
          variant="tonal"
          :disabled="loading"
          @click="emit('update:isDialogVisible', false)"
        >
          Cancel
        </VBtn>
      </VCardText>
    </VCard>
  </VDialog>
</template>
