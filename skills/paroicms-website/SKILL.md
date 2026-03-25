---
name: paroicms-website
description: Guidelines for working on a ParoiCMS website directory. Use when developing or debugging website themes, templates, and configuration.
---

# Working on a ParoiCMS Website

A ParoiCMS website is a directory containing configuration files, a theme with Liquid templates, and static assets.

## References

Documentation:

- [liquid-templating.md](references/liquid-templating.md) - LiquidJS syntax and ParoiCMS extensions
- [plugins.md](references/plugins.md) - Available plugins with configuration examples
- [site-schema.md](references/site-schema.md) - Additional documentation on site schema.
- [configuration.md](references/configuration.md) - Server configuration for standalone websites

Annotated type definitions:

- [site-schema-json-types.d.ts](references/site-schema-json-types.d.ts) - Site schema types
- [template-payload.types.d.ts](references/template-payload.types.d.ts) - Template payload types
- [configuration-types.d.ts](references/configuration-types.d.ts) - Configuration types

## Build and Run

```bash
npm start            # Run the server
npm run build        # Build CSS bundle
npm run dev          # Run `css:watch` and `start:dev` concurrently (watch modes)
npm run start:dev    # Run the server - watch mode
npm run css:watch    # Build CSS bundle - watch mode
```

When the server is running, the website is available at `http://localhost:8080`.

Note: PostCSS is used to bundle CSS. The entry point is `theme/assets/css/index.css`, output is `theme/assets/bundle.css`.

## Core Architecture Concepts

### Site Schema

A **Site Schema** defines the types of:

- **Document**: Every webpage is called a document. There are two kinds:
  - **Routing document**: A site section (homepage, blog index, about page) - never an item of a list.
  - **Regular document**: Blog post, article, etc. - always an item of a list.
- **Part**: Sub-section within a document, can be nested - always an item of a list.
- **Field**: Attached to a document or part.

Note: A document always contains a **title**, **publish date**, and **featured image**. These are not fields in the site-schema.

### Tree of Nodes

The main database of a website stores a **tree** of **nodes**: `site` -> `home` -> (other documents & parts).

- **Node**: Non-localized, it has one parent (except for the site root).
- **lNode**: Documents and parts are _lNodes_ (localized nodes). A lNode is attached to a node.

Important identifiers:

- **nodeId**: String containing an integer
- **lNodeId**: Format `nodeId:language` - localized node identifier - use `parseLNodeId()` and `encodeLNodeId()` for conversion (sparingly)
- **documentId**, **partId**: Alias for lNodeId
- **relativeId**: Short node identifier used in URLs, unique among siblings (children of the same parent node).

### Routing Clusters

A **routing cluster** (or _cluster_) groups nodes of routing documents. It contains the cluster _root node_ (the home node or a regular document) and a tree of _routing nodes_ attached to the root.

Key points:

- A website always starts with the _home routing cluster_ (cluster root = home node)
- Every regular document with routing document children is the root of a new routing cluster
- In a routing cluster, each document type is unique

### Taxonomies

Any routing document can be used as a taxonomy, then the regular child documents are the taxonomy **terms**.

A taxonomy is used in a **labeling field**. Labeling fields can reference taxonomy from the same cluster or a parent cluster only.

## Directory Structure

```
my-website/
├── config.json              # Server configuration (standalone sites only)
├── package.json             # Dependencies (plugins) and scripts
├── site-schema.json         # Document types, parts, fields, plugins
├── site-schema.l10n.*.json  # UI labels for Admin-UI (one per language)
├── postcss.config.js        # PostCSS configuration for CSS bundling
├── static-files/            # Files served as-is (robots.txt, etc.)
└── theme/
    ├── theme.json           # Image resize rules, pixel ratio
    ├── .theme-check.yml     # VS Code Shopify extension config (ignore)
    ├── templates/           # Liquid templates
    │   ├── layouts/         # Layout templates
    │   ├── partials/        # Reusable partial templates
    │   ├── home.liquid      # One template per document type
    │   ├── 404.liquid       # Error page
    │   └── ...
    ├── locales/             # Theme translations (JSON files per language)
    │   ├── en.json
    │   └── fr.json
    └── assets/
        ├── css/             # CSS source files
        ├── js/              # JavaScript files
        ├── bundle.css       # Generated CSS bundle
        └── icons/           # SVG icons, images
```

## Key Files

### theme.json

```json
{
  "fTextImages": ["700x350", "700x", "x400x"],
  "pixelRatio": 1.5
}
```

- `fTextImages`: Image resize rules for HTML content fields
- `pixelRatio`: Default pixel ratio for responsive images

### Localization Files

**`site-schema.l10n.{lang}.json`** - Labels for document types and fields displayed in Admin-UI:

```json
{
  "nodeTypes": {
    "home": { "label": "Home page" },
    "post": {
      "label": "Post",
      "fields": { "tags": { "label": "Tags" } }
    }
  }
}
```

**`theme/locales/{lang}.json`** - Translations for the `t` filter in templates:

```json
{
  "Read more": "Lire la suite",
  "Home": "Accueil"
}
```
