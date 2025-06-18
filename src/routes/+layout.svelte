<script lang="ts">
  import "../app.css";

  let { children } = $props();
</script>

<div class="nav-wrapper">
  <nav>
    <a href="#/" class="btn btn-primary no-underline btn-sm">LukeZ Wiki</a>
  </nav>
</div>

<main class="markdown-body">
  {@render children()}
</main>
