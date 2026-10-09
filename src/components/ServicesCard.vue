<script setup>
import RankedBarList from './RankedBarList.vue';
import { SERVICES_SHOWN } from '../lib/calc.js';

defineProps({ services: { type: Array, default: () => [] } });
</script>

<template>
  <div class="card card-services">
    <h2>Servicios</h2>
    <RankedBarList
      :items="services"
      :shown-count="SERVICES_SHOWN"
      label-field="service_name"
      :with-delta="false"
      empty-msg="Aún no disponible. Se necesita actualizar el workflow para que agregue costos por tipo de servicio (meterCategory)."
    />
  </div>
</template>
