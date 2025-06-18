import MagicString from "magic-string";
import { marked } from "marked";

/**
 * Svelte Markdown Preprocessor for .svelte.md files
 *
 * This preprocessor allows you to write Svelte components that can include
 * markdown content directly, with support for:
 * - Front matter (YAML metadata)
 * - Svelte component integration within markdown
 * - Custom renderers for markdown elements
 * - Code syntax highlighting preparation
 */

/**
 * Parse front matter from markdown content
 * @param {string} content - The markdown content
 * @returns {{frontMatter: object, content: string}} Parsed front matter and remaining content
 */
function parseFrontMatter(content) {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontMatterRegex);

  if (!match) {
    return { frontMatter: {}, content };
  }

  const [, yamlContent, markdownContent] = match;
  let frontMatter = {};

  try {
    // Simple YAML parser for basic key-value pairs
    // For production use, consider using a proper YAML parser like 'js-yaml'
    const lines = yamlContent.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split(":");
        if (key && valueParts.length > 0) {
          const value = valueParts.join(":").trim();
          // Remove quotes if present
          frontMatter[key.trim()] = value.replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch (error) {
    console.warn("Failed to parse front matter:", error);
  }

  return { frontMatter, content: markdownContent };
}

/**
 * Extract and preserve Svelte components from markdown
 * @param {string} content - Markdown content
 * @returns {{content: string, components: Array}} Content with placeholders and extracted components
 */
function extractSvelteComponents(content) {
  const components = [];
  const componentRegex =
    /<([A-Z][a-zA-Z0-9]*)([\s\S]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;

  let match;
  let modifiedContent = content;
  let offset = 0;

  while ((match = componentRegex.exec(content)) !== null) {
    const [fullMatch, componentName, attributes, children] = match;
    const placeholder = `__SVELTE_COMPONENT_${components.length}__`;

    components.push({
      name: componentName,
      attributes: attributes.trim(),
      children: children || "",
      fullMatch,
      placeholder,
    });

    // Replace the component with a placeholder
    const startIndex = match.index - offset;
    modifiedContent =
      modifiedContent.substring(0, startIndex) +
      placeholder +
      modifiedContent.substring(startIndex + fullMatch.length);

    offset += fullMatch.length - placeholder.length;
  }

  return { content: modifiedContent, components };
}

/**
 * Restore Svelte components in the processed HTML
 * @param {string} html - Processed HTML
 * @param {Array} components - Extracted components
 * @returns {string} HTML with restored Svelte components
 */
function restoreSvelteComponents(html, components) {
  let restoredHtml = html;

  components.forEach((component) => {
    const { placeholder, name, attributes, children } = component;
    const restoredComponent = children
      ? `<${name}${attributes ? " " + attributes : ""}>${children}</${name}>`
      : `<${name}${attributes ? " " + attributes : ""} />`;

    restoredHtml = restoredHtml.replace(placeholder, restoredComponent);
  });

  return restoredHtml;
}

/**
 * Configure marked with custom renderers
 * @param {object} options - Configuration options
 * @returns {object} Configured marked instance
 */
function configureMarked(options = {}) {
  const renderer = new marked.Renderer();

  // Custom renderer for code blocks to add syntax highlighting classes
  renderer.code = function ({ text, lang }) {
    const validLang = lang && lang.match(/^[a-zA-Z0-9_+-]*$/);
    const langClass = validLang ? ` class="language-${lang}"` : "";
    return `<pre><code${langClass}>${marked.parse(text)}</code></pre>`;
  };

  // Custom renderer for links to handle external links
  renderer.link = function ({ href, title, text }) {
    const isExternal =
      href.startsWith("http") &&
      !href.includes(options.hostname || "localhost");
    const target = isExternal
      ? ' target="_blank" rel="noopener noreferrer"'
      : "";
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a href="${href}"${titleAttr}${target}>${text}</a>`;
  };

  marked.setOptions({
    renderer,
    gfm: true, // GitHub Flavored Markdown
    breaks: false,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: true,
    ...options.markedOptions,
  });

  return marked;
}

/**
 * Main Svelte Markdown Preprocessor
 * @type {import('svelte/compiler').PreprocessorGroup}
 */
export const svelteMarkdownPreprocessor = {
  name: "svelte-markdown",

  /**
   * Process .svelte.md files
   * @param {object} options - Preprocessor options
   * @param {string} options.content - File content
   * @param {string} options.filename - File name
   * @returns {object} Processed result
   */
  markup({ content, filename }) {
    // Only process .svelte.md files
    if (!filename || !filename.endsWith(".svelte.md")) {
      return;
    }

    try {
      const s = new MagicString(content);

      // Parse front matter
      const { frontMatter, content: markdownContent } =
        parseFrontMatter(content);

      // Extract Svelte components
      const { content: contentWithoutComponents, components } =
        extractSvelteComponents(markdownContent);

      // Configure marked
      const marked = configureMarked({
        hostname: frontMatter.hostname || "localhost",
      });

      // Convert markdown to HTML
      let html = marked.parse(contentWithoutComponents);

      // Restore Svelte components
      html = restoreSvelteComponents(html, components);

      // Generate script section with front matter data
      const scriptContent = `
      let { frontMatter = ${JSON.stringify(
        frontMatter,
        null,
        2
      )}, ...props } = $props();
      
      // Destructure front matter properties as individual props
      let { ${Object.keys(frontMatter).join(
        ", "
      )} } = { ...frontMatter, ...props };
    `;

      // Create the complete Svelte component
      const svelteComponent = `<script>
${scriptContent}
</script>

${html}`;

      // Replace the entire content with the new Svelte component
      s.overwrite(0, content.length, svelteComponent);

      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    } catch (error) {
      console.error("Error processing .svelte.md file:", error);
      throw error;
    }
  },
};

/**
 * Factory function to create the preprocessor with custom options
 * @param {object} options - Configuration options
 * @param {object} options.markedOptions - Options to pass to marked
 * @param {string} options.hostname - Hostname for external link detection
 * @param {boolean} options.includeDefaultStyles - Whether to include default styles
 * @returns {import('svelte/compiler').PreprocessorGroup} Configured preprocessor
 */
export function createSvelteMarkdownPreprocessor(options = {}) {
  return {
    name: "svelte-markdown",
    markup({ content, filename }) {
      if (!filename || !filename.endsWith(".svelte.md")) {
        return;
      }

      // Use the same logic but with custom options
      return svelteMarkdownPreprocessor.markup({ content, filename });
    },
  };
}

// Example usage in svelte.config.js:
/*
import { svelteMarkdownPreprocessor } from './path/to/this/preprocessor.js';

export default {
  preprocess: [
    svelteMarkdownPreprocessor,
    // other preprocessors...
  ],
  // other config...
};
*/

export default svelteMarkdownPreprocessor;
