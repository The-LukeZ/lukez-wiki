<script lang="ts">
  import { cn } from "$lib";
  import type { Snippet } from "svelte";

  type Props = {
    children?: Snippet;
    variant: "tip" | "important" | "info" | "warning" | "error";
  };

  let { children, variant }: Props = $props();
</script>

<div class={cn("tip", `tip-${variant}`)}>
  {@render children?.()}
</div>
