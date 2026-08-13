# Custom Site-Local Plugins

How to build a ParoiCMS plugin inside a website repo, without publishing it. Reference implementation: `plugins/edvl-plugin/` in the EDVL repo; the closest published example is `list-field-plugin` in the ParoiCMS repo.

## Loading

The server imports each schema-declared plugin with a bare `import(pluginName)`. A root `"my-plugin": "file:plugins/my-plugin"` dependency (npm creates a symlink in `node_modules`) is enough. An import failure is only logged (`Invalid plugin "my-plugin"`) and the plugin is skipped — check the server log after wiring.

Declare the plugin in `site-schema.json` `plugins`, and on each field it renders: `"plugin": "my-plugin"` in the field definition.

## Package layout

A self-contained package (own `package-lock.json`, installed with `npm install --prefix plugins/my-plugin`):

```
plugins/my-plugin/
├── package.json          # main: backend/dist/index.js, type: module
├── vitest.config.mjs     # projects: ["./backend/vitest.config.mjs"]
├── backend/
│   ├── tsconfig.json     # tsc build to dist/
│   └── src/index.ts
└── admin-ui-plugin/
    ├── tsconfig.json     # noEmit type-check
    ├── vite.config.mjs   # lib entry src/main.ts → dist/admin-ui-plugin.mjs (+ .css)
    └── src/main.ts
```

Dependencies: `@paroicms/script-lib`; peer + dev `@paroicms/public-server-lib`, `@paroicms/public-anywhere-lib`; dev `@paroicms/public-admin-ui-lib`, `typescript`, `vite`, `vitest`. `file:` dependencies run no lifecycle scripts on install — the site needs an explicit build script (`npm --prefix plugins/my-plugin run build`).

## Duplicated-lib pitfall

The plugin's `node_modules` holds its own copy of `@paroicms/public-server-lib`, while the server uses the site's copy — same version, two module instances (Node resolves imports from the plugin's real path, so the nested copy shadows the root one; peer-dependency semantics don't exist at runtime). Anything relying on module identity across that boundary breaks: `public-server-lib` **1.3.0** tagged load descriptors with a module-private `Symbol(...)`, so `extractDocumentsLoadDescriptor` returned `undefined` in a site-local plugin. Fixed in **1.3.1** (registry symbols, cross-instance `ApiError`): require `>= 1.3.1` on both sides. Watch for the same hazard with any other `Symbol(...)` or `instanceof` shared across the boundary; type-only imports are always safe.

## Backend contract

Default export `{ version, siteInit }` (`ParoiCmsPlugin` from `@paroicms/public-server-lib`; get `version` with `extractPackageNameAndVersionSync`). In `siteInit(service)`:

- `setAdminUiAssetsDirectory(dir)` — serve the admin-ui bundle from `<pkg>/admin-ui-plugin/dist`.
- `registerHook("beforeSaveValue", handler)` — transforms a single field value pre-commit: the return value replaces the persisted value. Each field is isolated: the handler receives `{ service, value, options: { fieldType, language } }` — no document id or type name, so filter on `fieldType` properties (`name`, `pluginName`, `dataType`; `qualifiedName` is `name[plugin]`, not type-qualified). Only fields present in the client payload pass through (the admin UI sends modified fields only). Plain `varchar`/`string` values arrive as plain strings.
- `registerHook("afterSaveValues", handler)` — fires after field values are saved, with `options: AfterSaveValuesInfo { nodeKind, lNodeId?, nodeId?, typeName, language?, changes: [{fieldName, oldValue, newValue}] }`. Only fires when something changed; also fires for the initial values of a created document (`oldValue: undefined`). Always self-filter on `nodeKind` / `typeName` / `fieldName`. Reentrancy rule: a handler that writes back through `updateFields` re-fires the hook and must self-filter; `publishDocument` / `unpublishDocument` / `deleteMedia` do not go through `saveFieldValues`, so they cannot re-fire it.
- `registerSetLiquidTagFunction(tagName, handler)` — a custom `{% set x = myTag(...) %}` tag. The declared handler type is a `Generator`, but the core wrapper yields the handler's return value and LiquidJS resolves a Promise stored in a scope variable, so write an **async function** and cast it (`as unknown as PluginSetLiquidTagHandler`). Do not write a generator: the returned generator object would be stored as-is in the scope.
- `registerLiquidFilter(filterName, handler, options?)` — a custom `{{ x | myFilter }}` Liquid filter. The handler `(service, value, { ctx, args })` may be async (LiquidJS awaits it). The declared return type is a string, but the core wrapper passes the return value through unchanged, so a filter may return any value — e.g. a sorted array for `{% assign sorted = docs | myFilter %}` — cast the handler (`as unknown as PluginLiquidFilterHandler`). Documents in a `docs()` array are drops: read a property with `await drop.liquidMethodMissing("title")`. `options.raw: true` exempts the output from HTML escaping (only relevant at output position).

### Full-access connector and draft loading

- `service.getUnsafeSiteConnector({ fqdn: service.fqdn })` returns a `RunningSiteConnector` with full access (no PAT guard): `loadRoutingClusterFromNode`, `getDocument`, `publishDocument(id, date?)` (stamps now when the date is omitted), `unpublishDocument`, `deleteMedia({ handle })`, `updateDocument(documentId, { title, slug, … })` (bypasses `saveFieldValues`, so it fires no `beforeSaveValue` / `afterSaveValues` hook — safe for a hook handler to call without re-entrancy), … A `mediaHandle` field value in `FullDocument.fieldValues` is `{ h: string }` where `h` is the handle `deleteMedia` wants (the handle is computed — its presence does not prove a media exists; `deleteMedia` on an empty handle is a no-op).
- Listing children **including drafts** needs a rendering service: `service.openRenderingService({ language, urlLike })` then `loadDocuments({ load: "list", nodeKind: "document", descriptorName: "children", parentDocumentId: { nodeId, language } }, { onlyPublished: false })`. `urlLike` is a cache key — make it unique per invocation, and `close()` the service in a `finally`.
- `loadDocuments` returns LiquidJS drops with lazy values. From plain JS, read a value with `await drop.liquidMethodMissing("id")` (cast the drop; the `LiquidPayload` type hides the drop API).

## Admin-UI contract

The admin-ui fetches `<pluginBaseUrl>/admin-ui-plugin.mjs` and calls `default.init(service)`. Default export `{ init, create }` (`AdminUiPlugin` from `@paroicms/public-admin-ui-lib`):

- `init({ pluginBaseUrl })` — inject `<pluginBaseUrl>/admin-ui-plugin.css` as a `<link>`.
- `create(service: AdminUiPluginFieldService)` — called for each field whose schema `"plugin"` matches the plugin name. The core already wraps the widget in a `PaField` block with the l10n `label`; render only the inner control. Returns `{ element, setValue, getValue, setLanguage, dispose }`.
- `service.initialValue` / `service.setModifiedValue(value)` — read and write the field value (marks the document dirty; the value is stored on save).
- `service.createModalDialog<T>({ header, content, footer })` + `await dialog.open()` — modal dialogs (e.g. confirmations); footer buttons call `dialog.close(result)`. Standard footer: `div.PaButtonBar.alignRight._paForm` with a `button.secondary` cancel.
- The core l10n `enum` map only applies to the core enum widget; a plugin widget provides its own labels.

## Migrating existing field data

Stored field rows record their owning plugin (`plugin` column in `PaFieldVarchar` / `PaFieldText` / `PaFieldLabeling`), checked on read (`Plugin mismatch for field ...`). Adding `"plugin"` to a field that already has data breaks reads of the existing rows: either recreate the content (e.g. re-run the site's data migration on a fresh store) or backfill the column (e.g. `UPDATE PaFieldVarchar SET plugin='my-plugin' WHERE field='status' AND plugin IS NULL`). New writes store the plugin name automatically.
