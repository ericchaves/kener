<script lang="ts">
  import { createEventDispatcher } from 'svelte';
	import { cn } from "$lib/utils";

  export let value: string = ''; // Value formatted as 'HH:mm'
  export let disabled: boolean = false;
  export let id: string = `time-picker-${Math.random().toString(36).substring(2, 9)}`;
  export let className: string = '';

  const dispatch = createEventDispatcher();

  function handleInput(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    value = inputElement.value;
    dispatch('change', value);
  }
</script>

<div class={cn('flex flex-col gap-2', className)}>

  <div class="relative w-full">
    <input
      type="time"
      step="60"
      {id}
      bind:value
      on:input={handleInput}
      {disabled}
      class={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        value ? 'text-foreground' : 'text-muted-foreground'
      )}
    />
  </div>

</div>
