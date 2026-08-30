# Site Schema Reference

The `site-schema.json` file defines the structure of a ParoiCMS website.

## Basic Structure

```json
{
  "ParoiCMSSiteSchemaFormatVersion": "10",
  "languages": ["en", "fr"],
  "languageRoutingMode": "auto",
  "plugins": [
    "@paroicms/tiptap-editor-plugin",
    "@paroicms/contact-form-plugin"
  ],
  "configuration": {
    "adminUi": {
      "enableMetaKeywords": true
    }
  },
  "nodeTypes": [...],
  "fieldTypes": [...],
  "mediaPolicies": [...]
}
```

## Top-Level Properties

| Property | Type | Description |
|----------|------|-------------|
| `ParoiCMSSiteSchemaFormatVersion` | `"10"` | Schema version (required) |
| `languages` | `string[]` | Language codes (ISO 639-1), first is primary |
| `languageRoutingMode` | `"auto" \| "prefixAll" \| "prefixSecondary"` | URL language prefix mode |
| `plugins` | `(string \| PluginRef)[]` | List of plugins |
| `configuration` | `object` | Site configuration |
| `nodeTypes` | `NodeType[]` | Document and part types |
| `fieldTypes` | `FieldType[]` | Reusable field definitions |
| `mediaPolicies` | `MediaPolicy[]` | Media upload rules |

## Plugins

Plugins can be specified as strings or objects:

```json
"plugins": [
  "@paroicms/tiptap-editor-plugin",
  {
    "name": "@paroicms/contact-form-plugin",
    "disabled": false,
    "configuration": {
      "adminUi": { "code": true }
    }
  }
]
```

## Node Types

There are three kinds of node types:

### Site Type

Defines site-level fields:

```json
{
  "kind": "site",
  "fields": ["logo", "slogan", "footerMention[@paroicms/tiptap-editor-plugin]"]
}
```

Built-in site fields: `access`, `title`, `contactEmail`, `favicon`, `ogImage`.

### Routing Document

A site section with a fixed URL path:

```json
{
  "typeName": "posts",
  "kind": "document",
  "documentKind": "routing",
  "route": { "en": "posts", "fr": "articles" },
  "withFeaturedImage": true,
  "fields": ["htmlContent[@paroicms/tiptap-editor-plugin]"],
  "routingChildren": ["tags"],
  "regularChildren": ["post"],
  "regularChildrenSorting": "publishDate desc",
  "cluster": { "autoCreate": true },
  "adminUi": { "defaultTab": "edit", "menuPlacement": "default" }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `typeName` | `string` | Unique identifier |
| `route` | `string \| { [lang]: string }` | URL path segment |
| `redirectTo` | `"parent"` | No content, just a parent for children |
| `withFeaturedImage` | `boolean` | Enable featured image |
| `fields` | `(string \| FieldType)[]` | Document fields |
| `lists` | `ListType[]` | Part lists |
| `routingChildren` | `string[]` | Child routing document types |
| `regularChildren` | `string[]` | Child regular document types |
| `regularChildrenSorting` | `string \| string[]` | Sorting of regular children in lists and admin UI. Accepts a string (e.g. `"title asc"`, `"publishDate desc"`, `"relativeId desc"`), an array of strings for multi-field sort, or `"manual"`. Supported fields: `title`, `publishDate`, `updatedAt`, `relativeId`, any `varchar` field of the document type, and `manual`. |
| `childLimit` | `number` | Max children count |
| `cluster.autoCreate` | `boolean` | Auto-create routing children |
| `hasFrontendApp` | `boolean` | Serves a SPA |
| `useUrlQuery` | `boolean` | Expose URL query to templates |

#### `adminUi` options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultTab` | `"parts" \| "edit" \| "auto"` | `"auto"` | Which tab to open when navigating to a document. `"auto"` opens `"parts"` if the type has part lists, otherwise `"edit"`. When set explicitly, the same tab is used from all entry points (list click, sidebar, breadcrumb, search). Without this option, different entry points may default to different tabs — a known inconsistency. |
| `menuPlacement` | `"default" \| "popup"` | `"default"` | Where the node type appears in the admin sidebar. `"popup"` hides it behind a parent menu item. |

### Regular Document

A content item in a list (blog post, article):

```json
{
  "typeName": "post",
  "kind": "document",
  "documentKind": "regular",
  "jsonLdType": "Article",
  "route": ":yyyy/:mm/:dd/:relativeId-:slug",
  "withFeaturedImage": true,
  "fields": [
    { "name": "tags", "localized": false, "storedAs": "labeling", "taxonomy": "tags", "multiple": true },
    "leadParagraph[@paroicms/tiptap-editor-plugin]",
    "htmlContent[@paroicms/tiptap-editor-plugin]"
  ],
  "autoPublish": true,
  "relativeIdGenerator": ["default", 6]
}
```

Route patterns:

- `:relativeId-:slug` - ID and slug
- `:yyyy/:mm/:dd/:relativeId-:slug` - Date-based URL
- `:relativeId` - ID only. With this pattern, the Admin-UI displays an editable
  "relative ID" field on the document, so editors control the URL segment
  directly (e.g. a year: `/contests/2026`)
- `:slug` - slug only

The relative ID identifies the document among its siblings: a URL with a wrong
slug is 301-redirected to the canonical URL. `updateDocument` (admin GraphQL)
accepts a `relativeId` value for any route pattern, validated for format and
sibling uniqueness — only the Admin-UI editor is limited to `:relativeId` routes.

| Property | Type | Description |
|----------|------|-------------|
| `autoPublish` | `boolean` | Skip draft state |
| `relativeIdGenerator` | `[string, ...args]` | ID generation strategy |

`jsonLdType` specifies the schema.org type for JSON-LD structured data. Allowed values: `"Article"`, `"BlogPosting"`, `"Product"`, `"AboutPage"`, `"ContactPage"`, `"SearchResultsPage"`, `"CollectionPage"`, `"ProfilePage"`. When set, `ogType` is derived automatically if not explicitly provided.

### Part Type

A sub-section within a document:

```json
{
  "typeName": "sideImage",
  "kind": "part",
  "fields": ["image", "htmlContent[@paroicms/tiptap-editor-plugin]"],
  "list": {
    "parts": ["nestedPart"],
    "sorting": "manual"
  },
  "mediaPolicy": "partImages"
}
```

### Part Lists

Documents can contain named lists of parts:

```json
{
  "lists": [
    {
      "listName": "sections",
      "parts": ["textBlock", "imageBlock", "videoBlock"],
      "sorting": "manual",
      "limit": 10
    }
  ]
}
```

## Field Types

Fields can be defined inline or referenced by name.

### Inline Field Definition

```json
{
  "name": "color",
  "localized": false,
  "storedAs": "varchar",
  "dataType": "string"
}
```

### Custom Field Localization

For every inline custom field displayed as an Admin-UI input, add a `label` to
each `site-schema.l10n.{lang}.json` file under the field's node type:

```json
{
  "nodeTypes": {
    "post": {
      "fields": {
        "subtitle": { "label": "Sous-titre" }
      }
    }
  }
}
```

This remains required when a predefined shorthand field is converted to object
form only to set options. For example, an inline `htmlContent` field using the
Tiptap plugin does not inherit the localized label of
`"htmlContent[@paroicms/tiptap-editor-plugin]"`; without an explicit label, the
Admin-UI displays the raw field name.

Related cases:

- A shorthand predefined field inherits its field library label. Override it only
  when the website needs different wording.
- Localize each `enum` value under the field's `enum` map, unless a custom widget
  deliberately renders its own localized values.
- An `infoPanel` field is not an input: localize its `content` instead of adding a
  `label`.

When changing `site-schema.json`, compare every inline field with every
`site-schema.l10n.{lang}.json` file before finishing. Check the field label, enum
values where applicable, and `infoPanel` content.

### Field Ordering

The order of fields in the `fields` array determines their display order in the Admin-UI editor (top to bottom). To move a field above another, simply reorder it in the array.

When converting a field from string shorthand to object form (e.g. to add `adminUi.editorRows`), all required properties must be provided explicitly — see the [tiptap plugin docs](plugins.md#paroicmstiptap-editor-plugin) for a worked example and the `dataType` gotcha.

### Predefined Field Reference

Reference with plugin: `"htmlContent[@paroicms/tiptap-editor-plugin]"`

Common predefined fields:

- `logo`, `image`, `backgroundImage` - Media fields
- `gallery` - Gallery field
- `title`, `slogan`, `buttonLabel` - String fields
- `phone`, `phone2` - Phone fields
- `htmlContent[@paroicms/tiptap-editor-plugin]` - Rich text
- `leadParagraph[@paroicms/tiptap-editor-plugin]` - Lead paragraph
- `video[@paroicms/platform-video-plugin]` - YouTube video

### Field Properties

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Field identifier |
| `localized` | `boolean` | Different value per language |
| `storedAs` | `string` | Storage type |
| `dataType` | `string` | Data type |
| `plugin` | `string` | Plugin providing the field editor |
| `normalizeTypography` | `boolean` | Apply typography rules |
| `renderAs` | `"html"` | Render as HTML |
| `withGallery` | `boolean` | Enable gallery in editor |
| `useAsDefaultImage` | `number` | Use Nth image as default |
| `useAsExcerpt` | `number` | Use as document excerpt |

### Data Types

**String fields:**

```json
{ "name": "subtitle", "localized": true, "storedAs": "varchar", "dataType": "string" }
{ "name": "description", "localized": true, "storedAs": "text", "dataType": "string", "multiline": true }
{ "name": "status", "localized": false, "storedAs": "varchar", "dataType": "string", "enum": ["draft", "published"] }
```

**Number fields:**

```json
{ "name": "price", "localized": false, "storedAs": "varchar", "dataType": "number", "currency": "EUR" }
```

**Boolean fields:**

```json
{ "name": "featured", "localized": false, "storedAs": "varchar", "dataType": "boolean" }
```

**Date/Time fields:**

```json
{ "name": "eventDate", "localized": false, "storedAs": "varchar", "dataType": "date" }
{ "name": "eventDateTime", "localized": false, "storedAs": "varchar", "dataType": "dateTime" }
{ "name": "startTime", "localized": false, "storedAs": "varchar", "dataType": "time" }
```

**JSON fields (for plugins):**

```json
{ "name": "myList", "localized": true, "storedAs": "text", "dataType": "json", "plugin": "@paroicms/list-field-plugin" }
```

**Media fields:**

```json
{ "name": "image", "localized": false, "storedAs": "mediaHandle", "dataType": "media", "accept": "image/*" }
{ "name": "gallery", "localized": false, "storedAs": "mediaHandle", "dataType": "gallery", "accept": "image/*" }
```

**Labeling fields (taxonomy):**

```json
{
  "name": "tags",
  "localized": false,
  "storedAs": "labeling",
  "taxonomy": "tags",
  "multiple": true
}
```

## Taxonomies

Any routing document can be used as a taxonomy. Its regular children become the terms:

```json
{
  "typeName": "tags",
  "kind": "document",
  "documentKind": "routing",
  "route": "tags",
  "redirectTo": "parent",
  "regularChildren": ["tag"],
  "regularChildrenSorting": "title asc",
  "adminUi": { "menuPlacement": "popup" }
},
{
  "typeName": "tag",
  "kind": "document",
  "documentKind": "regular",
  "route": ":relativeId-:slug",
  "autoPublish": true
}
```

Reference the taxonomy in a labeling field:

```json
{ "name": "tags", "localized": false, "storedAs": "labeling", "taxonomy": "tags", "multiple": true }
```

## Media Policies

Define upload limits:

```json
{
  "mediaPolicies": [
    {
      "policyName": "default",
      "mediaLimitPerDocument": 10,
      "mediaLimitPerPart": 5,
      "image": { "weightLimitB": 5000000, "areaLimitPx": 4000000 },
      "attachedDocument": { "siteWeightLimitB": 50000000 }
    }
  ]
}
```

## Complete Example

```json
{
  "ParoiCMSSiteSchemaFormatVersion": "10",
  "languages": ["fr"],
  "plugins": [
    "@paroicms/tiptap-editor-plugin",
    "@paroicms/contact-form-plugin",
    "@paroicms/content-loading-plugin",
    "@paroicms/public-menu-plugin"
  ],
  "nodeTypes": [
    {
      "kind": "site",
      "fields": ["logo", "footerMention[@paroicms/tiptap-editor-plugin]"]
    },
    {
      "typeName": "home",
      "kind": "document",
      "documentKind": "routing",
      "withFeaturedImage": false,
      "fields": ["htmlContent[@paroicms/tiptap-editor-plugin]"],
      "routingChildren": ["posts", "contactPage", "searchPage"],
      "cluster": { "autoCreate": true }
    },
    {
      "typeName": "posts",
      "kind": "document",
      "documentKind": "routing",
      "jsonLdType": "CollectionPage",
      "route": "articles",
      "withFeaturedImage": true,
      "regularChildren": ["post"],
      "regularChildrenSorting": "publishDate desc"
    },
    {
      "typeName": "post",
      "kind": "document",
      "documentKind": "regular",
      "jsonLdType": "Article",
      "route": ":yyyy/:mm/:dd/:relativeId-:slug",
      "ogType": "article",
      "withFeaturedImage": true,
      "fields": [
        "leadParagraph[@paroicms/tiptap-editor-plugin]",
        "htmlContent[@paroicms/tiptap-editor-plugin]"
      ]
    },
    {
      "typeName": "contactPage",
      "kind": "document",
      "documentKind": "routing",
      "jsonLdType": "ContactPage",
      "route": "contact",
      "withFeaturedImage": false,
      "fields": ["introduction[@paroicms/tiptap-editor-plugin]"]
    },
    {
      "typeName": "searchPage",
      "kind": "document",
      "documentKind": "routing",
      "jsonLdType": "SearchResultsPage",
      "route": "recherche",
      "withFeaturedImage": false
    }
  ]
}
```

See [site-schema-json-types.d.ts](site-schema-json-types.d.ts) for complete TypeScript definitions.
