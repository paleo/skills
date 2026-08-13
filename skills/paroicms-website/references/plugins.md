# Available Plugins

Plugins extend ParoiCMS with additional field types, Liquid tags/filters, and functionality.

## Adding a Plugin

1. Add to `package.json` dependencies
2. Add to `site-schema.json` plugins array
3. Configure in `config.json` if needed (for server-level settings)

## Rich Text Editors

### @paroicms/tiptap-editor-plugin

Rich text editor based on TipTap. Recommended for new projects.

**site-schema.json:**

```json
{
  "plugins": [
    {
      "name": "@paroicms/tiptap-editor-plugin",
      "configuration": {
        "adminUi": { "code": true }
      }
    }
  ]
}
```

**Field usage (string shorthand):**

```json
"fields": [
  "htmlContent[@paroicms/tiptap-editor-plugin]",
  "leadParagraph[@paroicms/tiptap-editor-plugin]",
  "introduction[@paroicms/tiptap-editor-plugin]",
  "footerMention[@paroicms/tiptap-editor-plugin]"
]
```

**Field usage (object form — when you need per-field options):**

```json
"fields": [
  {
    "name": "htmlContent",
    "localized": true,
    "storedAs": "text",
    "dataType": "json",
    "plugin": "@paroicms/tiptap-editor-plugin",
    "adminUi": { "editorRows": 12 }
  }
]
```

> **⚠️ `dataType` must be `"json"`, not `"string"`.**
> Even though the field stores HTML text, the tiptap plugin serializes its content as a JSON tree (ProseMirror doc format). Using `dataType: "string"` causes a runtime error: *"field type is incompatible with Tiptap plugin, needs data type 'json'"*. This is counter-intuitive and easy to get wrong.
>
> **Required properties when using the object form:** `name`, `localized`, `storedAs`, `dataType`, and `plugin`. The string shorthand (e.g. `"htmlContent[@paroicms/tiptap-editor-plugin]"`) resolves all of these automatically from a library of predefined field types — but once you need to customize any property (like `adminUi.editorRows`), you must provide them all explicitly.

**Per-field `adminUi` options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `editorRows` | `number` | `26` | Editor content area height in `rem` units. The total editor height is `calc(editorRows + 79px)` (content + toolbar). For example, `editorRows: 12` → ~348px total. Reduce this for compact editors in part/block types where a full-height editor is excessive. |

**Template:**

```liquid
{{ doc.field.htmlContent | raw }}
```

### @paroicms/quill-editor-plugin

Rich text editor based on Quill.

**site-schema.json:**

```json
{
  "plugins": [
    {
      "name": "@paroicms/quill-editor-plugin",
      "configuration": {
        "adminUi": { "code": true }
      }
    }
  ]
}
```

**Field usage:**

```json
"fields": ["htmlContent[@paroicms/quill-editor-plugin]"]
```

## Content & Navigation

### @paroicms/content-loading-plugin

Provides search functionality and infinite loading.

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/content-loading-plugin"]
}
```

**Template - Search opener button:**

```liquid
{% set searchPage = doc(site.home.routing.searchPage) %}
{% out searchOpener(url: searchPage.url, class: "search-btn") %}
```

**Template - Search results page:**

```liquid
{% out searchApp(template: "partials/result-item.public", by: 10) %}
```

**Template - Infinite loading list:**

```liquid
{% set posts = paginatedDocs(doc.routing.children, by: 10) %}
{% out infiniteLoading(class: "Grid", paginatedDocs: posts, template: "partials/post.public") %}
```

**Note:** The partial template must end with `.public.liquid` for AJAX loading.

### @paroicms/public-menu-plugin

Mobile menu component with hamburger button.

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/public-menu-plugin"]
}
```

**Template:**

```liquid
<nav data-activate-menu-items="{{ doc.id | activateMenuItemsData }}" data-mobile-menu-part="content">
  <ul>
    <li><a data-menu-item-id="{{ site.home.id }}" href="{{ site.home.url }}">Home</a></li>
  </ul>
</nav>
<div data-mobile-menu="button"></div>

<div data-effect="paMobileMenu" style="display: none">
  <div data-inject="content"></div>
</div>
```

## Form & Communication

### @paroicms/contact-form-plugin

Contact form with reCAPTCHA support.

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/contact-form-plugin"]
}
```

**config.json:**

```json
{
  "plugins": [
    {
      "name": "@paroicms/contact-form-plugin",
      "configuration": {
        "googleRecaptchaSiteKey": "xxx",
        "googleRecaptchaSecretKey": "xxx"
      }
    }
  ]
}
```

**Template:**

```liquid
{% out contactForm %}
```

### @paroicms/send-mail-aws-ses-plugin

Send emails via AWS SES. Used by contact-form-plugin.

**config.json:**

```json
{
  "plugins": [
    {
      "name": "@paroicms/send-mail-aws-ses-plugin",
      "configuration": {
        "from": "noreply@example.com",
        "accessKeyId": "xxx",
        "secretAccessKey": "xxx",
        "region": "eu-west-3"
      }
    }
  ]
}
```

## Media & Fields

### @paroicms/platform-video-plugin

YouTube video field.

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/platform-video-plugin"]
}
```

**Field usage:**

```json
"fields": ["video[@paroicms/platform-video-plugin]"]
```

**Template:**

```liquid
{% if doc.field.video %}
  {{ doc.field.video | platformVideo }}
{% endif %}
```

### @paroicms/zoom-plugin

Image zoom on click.

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/zoom-plugin"]
}
```

**Template:**

```liquid
{% set img = image(doc.featuredImage, resize: "800x600") %}
<img src="{{ img.url }}" {{ doc.featuredImage | zoomable }}>
```

### @paroicms/internal-link-plugin

Field for linking to internal documents.

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/internal-link-plugin"]
}
```

**Field usage:**

```json
"fields": ["featuredDocument[@paroicms/internal-link-plugin]"]
```

**Template:**

```liquid
{% if doc.field.featuredDocument %}
  {% set featured = doc(doc.field.featuredDocument) %}
  <a href="{{ featured.url }}">{{ featured.title }}</a>
{% endif %}
```

### @paroicms/list-field-plugin

Dynamic list field (JSON array).

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/list-field-plugin"]
}
```

**Field usage:**

```json
"fields": [
  "phones[@paroicms/list-field-plugin]",
  {
    "name": "links",
    "localized": true,
    "storedAs": "text",
    "dataType": "json",
    "plugin": "@paroicms/list-field-plugin",
    "adminUi": {
      "sorting": "alpha",
      "ignorePunctuation": true
    }
  }
]
```

`adminUi` options: `"sorting": "alpha"` keeps the list alphabetically sorted
(locale-aware, on save — new items append at the end while editing, and drag
handles are hidden); `"ignorePunctuation": true` makes the collation skip
punctuation. Without `sorting`, the order is manual (drag-to-reorder).

**Template:**

```liquid
{% for phone in site.field.phones %}
  {{ phone | obfuscate: 'asLink' }}
{% endfor %}
```

## Remote API & Automation

### @paroicms/api-plugin

PAT-protected HTTP API over the whole content surface, with the `paroicms` CLI as its reference client. Use it for scripts, migrations, and automation against a running site.

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/api-plugin"]
}
```

Full documentation — authentication, CLI commands, HTTP actions with payload shapes, field value formats, behavior notes: [api-plugin.md](api-plugin.md).

## AI & Generation

### @paroicms/site-generator-plugin

AI-powered site generation (requires specific setup).

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/site-generator-plugin", "@paroicms/tiptap-editor-plugin"]
}
```

### @paroicms/mcp-plugin

Model Context Protocol integration for AI tools.

**site-schema.json:**

```json
{
  "plugins": ["@paroicms/mcp-plugin"]
}
```

## Plugin Configuration Patterns

### Schema-level configuration

In `site-schema.json`:

```json
{
  "plugins": [
    {
      "name": "@paroicms/tiptap-editor-plugin",
      "configuration": {
        "adminUi": { "code": true }
      }
    }
  ]
}
```

The `code` option enables color syntax highlighting in Tiptap.

### Server-level configuration

In `config.json` (for secrets and server settings):

```json
{
  "plugins": [
    {
      "name": "@paroicms/contact-form-plugin",
      "configuration": {
        "googleRecaptchaSiteKey": "xxx",
        "googleRecaptchaSecretKey": "xxx"
      }
    }
  ]
}
```

### Disabling a plugin

```json
{
  "plugins": [
    {
      "name": "@paroicms/some-plugin",
      "disabled": true
    }
  ]
}
```

## Common Plugin Combination

```json
{
  "plugins": [
    "@paroicms/tiptap-editor-plugin",
    "@paroicms/contact-form-plugin",
    "@paroicms/content-loading-plugin",
    "@paroicms/internal-link-plugin",
    "@paroicms/public-menu-plugin",
    "@paroicms/platform-video-plugin",
    "@paroicms/zoom-plugin"
  ]
}
```
