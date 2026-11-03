<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createMap } from '@/map/controller'
import { mapRef } from '@/state/store'

const el = ref<HTMLDivElement>()
onMounted(() => createMap(el.value!))
onBeforeUnmount(() => mapRef.value?.remove())
</script>

<template>
  <div>
    <div ref="el" class="h-full w-full" />
  </div>
</template>
