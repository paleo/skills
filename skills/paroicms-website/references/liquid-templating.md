# Liquid Templating Reference

ParoiCMS uses [LiquidJS](https://liquidjs.com/) with custom tags and filters.

## Injected Variables

Every template receives two variables automatically:

- **`site`** - Site-level data (always injected, no need to pass to partials)
- **`doc`** - Current document data

## Template Structure

### Layouts

Use `{% layout %}` and `{% block %}` for template inheritance:

```liquid
{% layout 'layouts/main-layout.liquid' %}
{% block %}
  <main>{{ doc.title }}</main>
{% endblock %}
```

Layout file (`layouts/main-layout.liquid`):

```liquid
<!doctype html>
<html lang="{{ doc.language }}">
  <head>
    <title>{{ doc.title }} - {{ site.field.title }}</title>
    <link rel="stylesheet" href="{{ site.assetsUrl }}/bundle.css">
    {{ doc | headTags }}
  </head>
  <body>
    {% block %}{% endblock %}
  </body>
</html>
```

### Partials

Use `{% render %}` to include partials. The `site` variable is always available; pass other variables explicitly:

```liquid
{% render 'partials/header', doc: doc %}
{% render 'partials/post.public', doc: post %}
```

Partial templates in `partials/` that end with `.public.liquid` can be used by plugins for AJAX loading.

## ParoiCMS Liquid Tags: `set` and `out`

### set image

Resize an image. Returns an object with `url`, `width`, `height`.

```liquid
{% set img = image(doc.featuredImage, resize: "400x300") %}
<img src="{{ img.url }}" width="{{ img.width }}" height="{{ img.height }}">
```

Resize rules:

- `"400x300"` - Exact dimensions (400px width, 300px height)
- `"400x"` - Width only, height auto
- `"x300"` - Height only, width auto
- `"x300x"` - Resize the greater dimension to 300px, other dimension auto

Optional parameters:

- `pixelRatio: 2` - Override the theme pixel ratio (default from theme.json)
- `mediaType: "image/jpeg"` - Force output format. Defaults to `image/webp`.

**Note on pixel ratio:** When requesting `400x300` with pixelRatio `1.5`, the actual image delivered is `600x450`, but the returned `width` and `height` properties are `400` and `300`. Use these display dimensions in HTML `width` and `height` attributes.

### set doc

Load a single document:

```liquid
{% set aboutPage = doc(site.home.routing.aboutPage) %}
{% if aboutPage %}
  <a href="{{ aboutPage.url }}">{{ aboutPage.title }}</a>
{% endif %}

{% set previous = doc(doc.siblings.previous) %}
{% set next = doc(doc.siblings.next) %}
```

### set docs

Load multiple documents:

```liquid
{% set posts = docs(doc.routing.children, limit: 4) %}
{% for post in posts %}
  <h2>{{ post.title }}</h2>
{% endfor %}
```

Parameters:

- `limit: N` - Maximum number of documents (optional)
- `sorting: "fieldName asc|desc"` - Sort order (optional). Use `"publishDate desc"` to sort by newest first. Can sort by any field.
- `term: doc|nodeId` - Filter by taxonomy term (optional). Can be a document object, node ID string, or numeric node ID.
- `labeledWith: "fieldName"` - Field name for taxonomy filtering (optional). Required when using `term`.
- `where: "fieldName=value"` - Filter by a field value (optional). Exactly one equality condition on a varchar-stored field, compared as strings (numbers as `"2024"`, booleans as `"1"`/`"0"`). Applied SQL-side. Also available on `paginatedDocs`. Example: `where: "status=started"`.
- `fields: "field1,field2,..."` - Comma-separated list of field names to load (optional). Optimizes performance by only loading specified fields.

Examples:

```liquid
{# Get 4 latest posts #}
{% set latestPosts = docs(site.home.routing.blog.children, limit: 4, sorting: "publishDate desc") %}

{# Get posts filtered by a specific tag #}
{% set taggedPosts = docs(site.home.routing.blog.children, term: doc, labeledWith: "tags") %}

{# Get posts by tag node ID #}
{% set taggedPosts = docs(site.home.routing.blog.children, term: "20", labeledWith: "postTags") %}

{# Get sorted and limited posts with only specific fields #}
{% set posts = docs(doc.routing.children, limit: 10, sorting: "publishDate desc", fields: "title,excerpt") %}
```

**Note**: When using `term` and `labeledWith` together, the `term` parameter filters documents that have been labeled (tagged) with that specific taxonomy term in the specified field.

Limits to be aware of:

- **Only published documents are returned.** Drafts are always excluded (`onlyPublished` is hardcoded in the rendering pipeline; backend plugins can opt out via `PluginRenderingService.loadDocuments`).
- **`where` supports a single `=` condition** on varchar-stored fields only; anything more complex (ranges, multiple conditions) must be done in a loop.
- **An empty result is `undefined`, not an empty array.** `{% if posts %}` works to test for emptiness; `posts | size` on an empty result is `0` because `undefined | size` is `0`.

### set paginatedDocs and out infiniteLoading

Load paginated documents for use with infinite loading:

```liquid
{% set posts = paginatedDocs(doc.routing.children, by: 10, page: doc.urlQuery.page) %}
{% out infiniteLoading(class: "MyList", paginatedDocs: posts, template: "partials/post.public") %}
```

`set paginatedDocs` parameters:

- `by: N` - Page size (required)
- `page: N` - 1-based page number (optional, defaults to 1). Can use `doc.urlQuery.page` for URL-based pagination.
- `term: doc` - Filter by taxonomy term (optional)
- `labeledWith: "fieldName"` - Field name for taxonomy filtering (optional)
- `pageIndex: N` - **Deprecated**, use `page` instead. 0-based page index.

`out infiniteLoading` parameters:

- `class: "CssClass"` - CSS class for the container (optional)
- `paginatedDocs: paginatedDocs` - The paginated object (required)
- `template: "partials/item.public"` - Partial template for rendering items (required)

### out pagination

Render pagination navigation links for paginated documents:

```liquid
{% set posts = paginatedDocs(doc.routing.children, by: 10, page: doc.urlQuery.page) %}
<div class="MyList">
  {% for post in posts.items %}
    {% render 'partials/post.public', doc: post %}
  {% endfor %}
</div>
{% out pagination(paginatedDocs: posts) %}
```

`out pagination` parameters:

- `paginatedDocs: paginatedDocs` - The paginated object (required)
- `url: "..."` - Base URL for pagination links (optional, defaults to current document URL)
- `class: "CssClass"` - Additional CSS class for the container (optional)
- `maxVisible: N` - Maximum number of page links to display (optional, default 5)
- `param: "page"` - Query parameter name for page number (optional, default "page")

Example of generated HTML:

```html
<nav class="PaPagination">
  <a class="PaPagination-item" href="/en/pages?page=1">1</a>
  <span class="PaPagination-item active">2</span>
  <a class="PaPagination-item" href="/en/pages?page=3">3</a>
  <a class="PaPagination-item" href="/en/pages?page=4">4</a>
  <span class="PaPagination-ellipsis">&hellip;</span>
  <a class="PaPagination-item" href="/en/pages?page=8">8</a>
</nav>
```

**Note**: To use URL-based pagination, the document type must have `useUrlQuery: true` in the site schema.

### out

Output content from a handler:

```liquid
{% out contactForm %}
{% out searchOpener(url: searchPage.url, class: "btn") %}
{% out searchApp(template: "partials/result-item.public", by: 10) %}
```

## Filters

### Translation

**`t`** - Translate using theme locales:

```liquid
{{ 'Read more' | t }}
{{ 'Hello %1' | t: userName }}
```

### HTML Output

**`raw`** - Output unescaped HTML (required for rich text fields):

```liquid
{{ doc.field.htmlContent | raw }}
```

**`headTags`** - Generate meta tags, Open Graph, favicon, RSS link:

```liquid
{{ doc | headTags }}
```

### Text Processing

**`makeExcerpt`** - Truncate text to N characters, cutting back to the previous word boundary and appending `…` when truncated:

```liquid
{{ doc.excerpt | makeExcerpt: 200 }}
```

### Obfuscation

**`obfuscate`** - Obfuscate text (email, phone) to prevent scraping:

```liquid
{{ site.field.contactEmail | obfuscate }}
{{ site.field.phone | obfuscate: 'asLink' }}
```

### Date Formatting

**`formatDate`** - Format a date:

```liquid
{{ doc.publishDate | formatDate: 'long' }}
{{ doc.publishDate | formatDate: 'MMMM yyyy' }}
```

### Number Formatting

**`formatNumber`** - Format a number with locale:

```liquid
{{ price | formatNumber }}
```

### Debugging

**`info`** - Display payload content for debugging (renders HTML tables):

```liquid
{{ site | info }}
{{ doc | info }}
{{ doc.field.tags | info }}
```

Can be used with any payload or sub-payload to inspect its structure.

### Plugin Filters

**`platformVideo`** - Render YouTube embed (from `@paroicms/platform-video-plugin`):

```liquid
{{ doc.field.video | platformVideo }}
```

**`zoomable`** - Add zoom capability to image (from `@paroicms/zoom-plugin`):

```liquid
<img src="{{ img.url }}" {{ doc.featuredImage | zoomable }}>
```

**`activateMenuItemsData`** - Generate menu activation data (from `@paroicms/public-menu-plugin`):

```liquid
<nav data-activate-menu-items="{{ doc.id | activateMenuItemsData }}">
```

## Payload Reference

### site Object

```
site.fqdn              # Domain name
site.assetsUrl         # URL to theme assets
site.field.*           # Site-level field values
site.home.url          # Home page URL
site.home.id           # Home document ID
site.home.language     # Current language code
site.home.languageLabel # Language display name
site.home.routing.*    # Routing cluster navigation
```

### doc Object

```
doc.id                 # Document ID (lNodeId format)
doc.type               # Document type name
doc.title              # Document title
doc.url                # Document URL
doc.language           # Language code
doc.languageLabel      # Language display name
doc.publishDate        # Publication date
doc.excerpt            # Auto-generated excerpt
doc.field.*            # Document field values
doc.featuredImage      # Featured image (if enabled)
doc.defaultImage       # First image from content
doc.translations[]     # Array of translation links
doc.breadcrumb[]       # Breadcrumb trail
doc.siblings.previous  # Previous sibling descriptor
doc.siblings.next      # Next sibling descriptor
doc.list.*             # Part lists (for documents with parts)
doc.routing.*          # Child routing descriptors (routing docs only)
doc.cluster            # Parent cluster reference
doc.urlQuery           # URL query parameters (if useUrlQuery enabled)
```

### Part Object (in lists)

```
part.id                # Part ID
part.type              # Part type name
part.number            # Position in list (1-based)
part.numberOfType      # Position among same type
part.field.*           # Part field values
part.defaultImage      # First image from part
part.parts[]           # Nested parts (if defined)
```

### Image Object

```
image.url              # Image URL
image.width            # Rendered width
image.height           # Rendered height
image.rawWidth         # Original width
image.rawHeight        # Original height
image.mediaId          # Media identifier
image.mediaType        # MIME type
```

### Translation Object

```
translation.language      # Language code
translation.languageLabel # Display name
translation.url           # URL to translation
translation.active        # Is current language
```

### Breadcrumb Item

```
crumb.id               # Document ID
crumb.title            # Document title
crumb.url              # Document URL (null for current)
```

## Common Patterns

### Language Switcher

```liquid
{% for translation in doc.translations %}
  {% if translation.active %}
    <span>{{ translation.languageLabel }}</span>
  {% else %}
    <a href="{{ translation.url }}">{{ translation.languageLabel }}</a>
  {% endif %}
{% endfor %}
```

### Breadcrumb

```liquid
{% for crumb in doc.breadcrumb %}
  {% if crumb.url %}
    <a href="{{ crumb.url }}">{{ crumb.title }}</a>
  {% else %}
    <span>{{ crumb.title }}</span>
  {% endif %}
  {% unless forloop.last %} / {% endunless %}
{% endfor %}
```

### Previous/Next Navigation

```liquid
{% set previous = doc(doc.siblings.previous) %}
{% set next = doc(doc.siblings.next) %}

{% if previous %}
  <a href="{{ previous.url }}">{{ 'Previous' | t }}: {{ previous.title }}</a>
{% endif %}
{% if next %}
  <a href="{{ next.url }}">{{ 'Next' | t }}: {{ next.title }}</a>
{% endif %}
```

### Responsive Images

```liquid
{% set smallImg = image(doc.featuredImage, resize: "400x") %}
{% set largeImg = image(doc.featuredImage, resize: "1200x") %}

<picture>
  <source srcset="{{ smallImg.url }}" media="(max-width: 600px)">
  <img src="{{ largeImg.url }}" width="{{ largeImg.width }}" height="{{ largeImg.height }}">
</picture>
```

### Taxonomy Tags

```liquid
{% if doc.field.tags %}
  {% for tag in doc.field.tags %}
    {% if tag.inRightLanguage %}
      <a href="{{ tag.url }}">{{ tag.title }}</a>
    {% else %}
      <span>{{ tag.title }}</span>
    {% endif %}
  {% endfor %}
{% endif %}
```

**Labeling terms are lightweight.** The items of a labeling field (`doc.field.tags`
above) expose `title`, `url`, `nodeId`… but **no `field`** — you cannot read the
term document's own fields from them. When you need a term's fields, load the
taxonomy's children with `docs()` (which returns full documents) and match on
`nodeId`:

```liquid
{% set terms = docs(site.home.routing.tags.children) %}
{% for term in terms %}
  {% if term.field.color %}...{% endif %}
{% endfor %}
```

### Paginated List with Infinite Loading

```liquid
{% set posts = paginatedDocs(doc.routing.children, by: 10) %}
{% out infiniteLoading(class: "Grid", paginatedDocs: posts, template: "partials/post.public") %}
```

### Filter by Taxonomy Term

```liquid
{% set posts = paginatedDocs(site.home.routing.posts.children, by: 10, term: doc, labeledWith: "tags") %}
{% out infiniteLoading(paginatedDocs: posts, template: "partials/post.public") %}
```

### Gallery Loop

```liquid
{% if doc.field.gallery %}
  {% for media in doc.field.gallery %}
    {% set img = image(media, resize: "300x200") %}
    <img src="{{ img.url }}" width="{{ img.width }}" height="{{ img.height }}" {{ media | zoomable }}>
  {% endfor %}
{% endif %}
```

### Iterating Over Parts

```liquid
{% for item in doc.list.sections %}
  {% if item.type == 'textBlock' %}
    <section>{{ item.field.htmlContent | raw }}</section>
  {% elsif item.type == 'imageBlock' %}
    {% set img = image(item.defaultImage, resize: "800x") %}
    <img src="{{ img.url }}">
  {% endif %}
{% endfor %}
```
