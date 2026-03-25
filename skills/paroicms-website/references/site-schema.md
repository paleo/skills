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
| `regularChildrenSorting` | `string` | Sorting: `"title asc"`, `"publishDate desc"`, `"manual"` |
| `childLimit` | `number` | Max children count |
| `cluster.autoCreate` | `boolean` | Auto-create routing children |
| `hasFrontendApp` | `boolean` | Serves a SPA |
| `useUrlQuery` | `boolean` | Expose URL query to templates |

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
