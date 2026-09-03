<script setup lang="ts">
defineProps<{ message: string; detail: string }>()
</script>

<template>
  <aside class="round-result" aria-live="polite">
    <span class="kicker"><i></i>Verdict du tour</span>
    <h2>{{ message }}</h2>
    <p>{{ detail }}</p>
  </aside>
</template>