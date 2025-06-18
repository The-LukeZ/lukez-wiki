<script lang="ts">
  import "../app.css";

  let { children } = $props();
</script>

<div class="nav-wrapper">
  <nav>
    <a href="/">LukeZ Wiki</a>
  </nav>
</div>

{@render children()}
