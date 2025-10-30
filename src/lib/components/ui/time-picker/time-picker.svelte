<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { cn } from "$lib/utils";

  /** UTC time string in 'HH:mm' format (e.g., '12:00') */
  export let value: string = '';

  export let disabled: boolean = false;
  export let id: string = `time-picker-${Math.random().toString(36).substring(2, 9)}`;
  export let className: string = '';

  const dispatch = createEventDispatcher();

  /** Local time string displayed in the input (e.g., '09:00' in São Paulo for UTC 12:00) */
  let internalValue = '';

  /**
   * Converts a UTC time string ('HH:mm') to the user's local time string ('HH:mm')
   * @param utcTime - Time in UTC (e.g., '12:00')
   * @returns Local time string in 'HH:mm' format
   */
  function utcToLocal(utcTime: string): string {
    if (!utcTime) return '';
    const [hours, minutes] = utcTime.split(':').map(Number);

    // Create a date in UTC with the given hours and minutes
    const date = new Date();
    date.setUTCHours(hours, minutes, 0, 0);

    // Extract local hours and minutes
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * Converts a local time string ('HH:mm') to UTC time string ('HH:mm')
   * @param localTime - Time in user's local timezone (e.g., '09:00')
   * @returns UTC time string in 'HH:mm' format
   */
  function localToUtc(localTime: string): string {
    if (!localTime) return '';
    const [hours, minutes] = localTime.split(':').map(Number);

    // Create a date in local time
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    // Convert to UTC
    const utcH = date.getUTCHours().toString().padStart(2, '0');
    const utcM = date.getUTCMinutes().toString().padStart(2, '0');
    return `${utcH}:${utcM}`;
  }

  // Reactively update displayed local time whenever the UTC value changes
  $: internalValue = utcToLocal(value);

  /**
   * Handles input changes: converts local time to UTC and updates bound value
   */
  function handleInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const localTime = input.value;
    const utcTime = localToUtc(localTime);

    value = utcTime;
    dispatch('change', value);
  }

  // Ensure initial value is properly converted on component mount
  onMount(() => {
    internalValue = utcToLocal(value);
  });
</script>

<div class={cn('flex flex-col gap-2', className)}>
  <div class="relative w-full">
    <input
      type="time"
      step="60"
      {id}
      bind:value={internalValue}
      on:input={handleInput}
      {disabled}
      class={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        internalValue ? 'text-foreground' : 'text-muted-foreground'
      )}
    />
  </div>
</div>
