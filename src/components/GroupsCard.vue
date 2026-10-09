<script setup>
import RankedBarList from './RankedBarList.vue';
import { GROUPS_SHOWN } from '../lib/calc.js';

defineProps({ groups: { type: Array, default: () => [] }, active: { type: String, default: null } });
defineEmits(['hover']);
</script>

<template>
  <div class="card card-groups">
    <h2>Por grupo de recursos</h2>
    <RankedBarList :items="groups" :shown-count="GROUPS_SHOWN" label-field="resource_group" :with-delta="true" :active="active" empty-msg="Sin datos." @hover="$emit('hover', $event)" />
  </div>
</template>
