// Site Schema JSON Types
// This file describes the structure of site-schema.json

export interface JtSiteSchema {
  /**
   * This is the version of the schema engine.
   */
  ParoiCMSSiteSchemaFormatVersion: "10";
  /**
   * Specify the list of 2-letters language codes (ISO 639-1) of the website. Use 3-letters codes
   * (ISO 639-3) for languages that doesn't have a 2-letters code ("qya", etc.). It's possible but
   * not recommanded to use 5-letters codes with regions (IETF BCP 47, for example "fr-FR"). Every
   * language is allowed. The first language is the primary language of the website.
   * @example `["en", "fr"]`
   */
  languages: string[];
  /**
   * Routing mode for multilingual sites. Default is "auto".
   * - "auto": behaves like "prefixSecondary" for unilingual sites, "prefixAll" for multilingual sites
   * - "prefixAll": all languages are prefixed in URLs
   * - "prefixSecondary": all languages but the first are prefixed in URLs
   */
  languageRoutingMode?: "prefixSecondary" | "prefixAll" | "auto";
  /**
   * List of plugins that are used in the schema.
   * @example ["@paroicms/tiptap-editor-plugin"]
   */
  plugins?: (string | JtPluginRef)[];
  configuration?: JtSiteConfiguration;
  /**
   * Types of documents, parts that will be handled on the site.
   */
  nodeTypes?: JtNodeType[];
  /**
   * A library of fields.
   */
  fieldTypes?: JtFieldType[];
  /**
   * Media policies
   */
  mediaPolicies?: JtMediaPolicy[];
  /**
   * We can set the image compression quality here. The list must be ordered from the lowest area
   * to the highest.
   */
  imageQualityPolicy?: JtImageCompressionQualityPolicyStep[];
}

export interface JtPluginRef {
  name: string;
  disabled?: boolean;
  configuration?: JtPluginConfFromSchema;
}

export interface JtPluginConfFromSchema {
  [key: string]: unknown;
}

export interface JtSiteConfiguration {
  adminUi?: {
    enableMetaKeywords?: boolean;
  };
}

// ----- NODE TYPES -----

export type JtNodeType = JtSiteType | JtDocumentType | JtPartType;

export interface JtSiteType {
  /**
   * Can be omitted. Its default value is `"_site"`.
   */
  typeName?: "_site";
  kind: "site";
  /**
   * The site fields. They will be appended to the required fields:
   * `["access", "title", "contactEmail", "favicon", "ogImage"]`.
   *
   * @example `["logo", "slogan", "phone"]`
   */
  fields?: (JtFieldType | string)[];
}

/**
 * A document is another name for a web page, with a path in the URL.
 */
export type JtDocumentType = JtRoutingDocumentType | JtRegularDocumentType;

export interface JtDocumentTypeBase {
  /**
   * The type name is the identifier of the document type.
   */
  typeName: string;
  kind: "document";
  /**
   * @see [Open Graph Protocol](https://ogp.me/)
   * @example `"article"`
   */
  ogType?: string;
  /**
   * The schema.org type for JSON-LD structured data.
   * Allowed values: `"Article"`, `"BlogPosting"`, `"AboutPage"`, `"ContactPage"`,
   * `"SearchResultsPage"`, `"CollectionPage"`, `"ProfilePage"`.
   */
  jsonLdType?: string;
  /**
   * If `true`, the document will have a featured image. Most of the time, documents like
   * search-page, contact-page, the home page, don't need a featured image. But other documents
   * does.
   */
  withFeaturedImage?: boolean;
  /**
   * The fields in the document. Items in this list can be either field types or predefined field
   * type names.
   */
  fields?: (JtFieldType | string)[];
  /**
   * The name of the media policy.
   */
  mediaPolicy?: string;
  /**
   * Lists of parts in the document.
   */
  lists?: JtListType[];
  /**
   * Type names of child routing documents.
   */
  routingChildren?: string[];
  /**
   * Type names of child regular documents.
   */
  regularChildren?: string[];
  /**
   * The sorting order of regular children. It is required when `children` is defined.
   * Examples: `"title asc"`, `"publishDate desc"`, `"manual"`.
   */
  regularChildrenSorting?: JtSorting;
  /**
   * The maximum number of children.
   */
  childLimit?: number;
  /**
   * If `true`, the document will serve a SPA. It means that all the child routes will be handled by
   * the document.
   *
   * This property is not compatible with `routingChildren`, `regularChildren`, `redirectTo`
   * properties. Also, if the document type is regular, then sibling regular document types must not
   * have routing or regular children.
   */
  hasFrontendApp?: boolean;
  /**
   * If `true`, then the url query will be exposed to the liquid templates. By default it's better
   * to not enable it, then the same content will be served from the cache for all the URL query
   * values.
   */
  useUrlQuery?: boolean;
  /**
   * Cluster configuration for this document type.
   */
  cluster?: JtClusterType;
  adminUi?: JtDocumentAdminUiSettings;
}

export interface JtClusterType {
  /**
   * Determine if the routing documents of the cluster should be automatically created when the root
   * document is created.
   */
  autoCreate?: boolean;
}

export type JtSorting = string[] | "manual" | string;

export interface JtRoutingDocumentType extends JtDocumentTypeBase {
  documentKind: "routing";
  /**
   * Value `"parent"` means that the document is just a hierarchy parent for other documents. But it
   * has no content itself.
   *
   * This value is ignored in the home page type.
   */
  redirectTo?: "parent";
  /**
   * The `route` of a routing document contains a kind of _directory name_ (one per language) that
   * will be the last part of the document URL path.
   *
   * This value is ignored in the home page type.
   */
  route?: string | JtTranslatedStrings;
}

export interface JtTranslatedStrings {
  [language: string]: string;
}

export interface JtDocumentAdminUiSettings {
  /** Default value is `"auto"`. */
  defaultTab?: JtDocumentTabName;
  /** Used by routing documents only. Default value is `"default"`. */
  menuPlacement?: "default" | "popup";
}

export type JtDocumentTabName = "auto" | "edit" | "childDocuments" | "parts";

export interface JtRegularDocumentType extends JtDocumentTypeBase {
  documentKind: "regular";
  /**
   * Available values are: `":relativeId-:slug"` and `":yyyy/:mm/:dd/:relativeId-:slug"`.
   */
  route: string;
  relativeIdGenerator?: JtRelativeIdGeneratorType;
  /**
   * Value `true` means that the document will be automatically published without being a
   * draft before. Useful for taxonomy terms, like tags or categories.
   */
  autoPublish?: boolean;
}

export type JtRelativeIdGeneratorType = any[]; // [makerName: string, ...args: any[]]

// ----- PART TYPES -----

export interface JtSubListType {
  /** Type names of the parts in the list. */
  parts: string[];
  /** How to sort the list. Example: `"manual"`. */
  sorting: JtSorting;
  /**
   * The maximum number of parts in the list.
   */
  limit?: number;
}

export interface JtListType extends JtSubListType {
  listName: string;
}

export interface JtPartType {
  /** The type name is the identifier of the part type. */
  typeName: string;
  kind: "part";
  fields?: (JtFieldType | string)[];
  /** If the part type can have children parts, then it's a sub-list. */
  list?: JtSubListType;
  mediaPolicy?: string;
}

// ----- FIELD TYPES -----

export type JtFieldType = JtMainDbFieldType | JtMediaDbFieldType | JtLabelingFieldType;

export interface JtFieldTypeBase {
  name: string;
  withGallery?: boolean;
  useAsDefaultImage?: number;
  renderAs?: "html";
  useAsExcerpt?: number;
  /** A plugin name. For example: `@paroicms/tiptap-editor-plugin`. */
  plugin?: string;
  /**
   * UI settings in the admin-ui.
   */
  adminUi?: JtFieldAdminUiSettings;
}

export interface JtFieldAdminUiSettings {
  /** Default is `"auto"`. */
  showInCard?: boolean | "auto";
  [key: string]: any;
}

export interface JtLocalizableFieldTypeBase extends JtFieldTypeBase {
  /**
   * If `true`, then each translation will have its own value. Otherwise, the value is shared
   * between all translations.
   */
  localized: boolean;
  /**
   * This property should be set to `true` for real textual field types, like an html body or a
   * label.
   *
   * Note: Its value has no effect when `localized` is `false`.
   */
  normalizeTypography?: boolean;
}

/**
 * The field type represents a labeling link between the current node, and a term from a taxonomy.
 */
export interface JtLabelingFieldType extends JtFieldTypeBase {
  localized: false;
  storedAs: "labeling";
  /**
   * It's the type name of a routing document. Regular documents that are child of this routing
   * document will be the terms of the taxonomy.
   *
   * Notice: Any routing point can be used as a taxonomy. Terms are always regular documents.
   */
  taxonomy: string;
  /**
   * If `true`, multiple terms can be selected. Otherwise, only one term can be selected.
   */
  multiple?: boolean;
}

export type JtMainDbFieldType =
  | JtNumberFieldType
  | JtBooleanFieldType
  | JtDateFieldType
  | JtDateTimeFieldType
  | JtTimeFieldType
  | JtStringFieldType
  | JtJsonFieldType;

export interface JtNumberFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "varchar";
  dataType: "number";
  currency?: string;
  enum?: number[];
}

export interface JtBooleanFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "varchar";
  dataType: "boolean";
}

export interface JtDateFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "varchar";
  dataType: "date";
}

export interface JtDateTimeFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "varchar";
  dataType: "dateTime";
}

export interface JtTimeFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "varchar";
  dataType: "time";
}

export interface JtStringFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "text" | "varchar";
  dataType: "string";
  multiline?: boolean;
  enum?: string[];
}

export interface JtJsonFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "text" | "varchar";
  dataType: "json";
}

export type JtMediaDbFieldType = JtGalleryFieldType | JtMediaFieldType;

export interface JtGalleryFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "mediaHandle";
  dataType: "gallery";
  accept: string;
  refuse?: string;
}

export interface JtMediaFieldType extends JtLocalizableFieldTypeBase {
  storedAs: "mediaHandle";
  dataType: "media";
  accept: string;
  refuse?: string;
}

// ----- MEDIA POLICIES -----

/**
 * These properties define the rules that are applied to medias.
 */
export interface JtMediaPolicy {
  /**
   * The internal name of the policy.
   * @example `"myPolicyName"`
   */
  policyName: string;
  /**
   * Max media limit uploaded in a document.
   * @example `10`
   */
  mediaLimitPerDocument?: number;
  /**
   * Max media limit uploaded in a part.
   * @example `10`
   */
  mediaLimitPerPart?: number;
  /**
   * Rules about non-image medias (like PDF files).
   */
  attachedDocument?: JtAttachedDocumentPolicy;
  /**
   * Rules about images.
   */
  image?: JtImagePolicy;
}

/**
 * These properties define the rules that are applied to
 * document uploaded in document and document part
 */
export interface JtAttachedDocumentPolicy {
  /**
   * Size limit in bytes.
   * @example `2000000`
   */
  siteWeightLimitB?: number;
}

/**
 * These properties define the rules that are applied to
 * images contained in document and document part
 */
export interface JtImagePolicy {
  /**
   * Size limit in bytes.
   * @example `2000000`
   */
  weightLimitB?: number;
  /**
   * Maximum area (width × height, in pixels) of an image.
   * @example `2000000`
   */
  areaLimitPx?: number;
}

/**
 * These properties define the rules applied to image
 * compression across all sites
 */
export interface JtImageCompressionQualityPolicyStep {
  /**
   * The quality will apply for image with area smaller than this value.
   * @example `600000`
   */
  areaLimitPx?: number;
  /**
   * Webp quality loss, in percents.
   * @example `80`
   */
  quality: number;
}

// ----- LOCALIZATION -----

export interface JtSiteSchemaTranslations {
  siteTheme?: string;
  nodeTypes?: { [typeName: string]: JtLabelLocales };
  fieldTypes?: { [fieldName: string]: JtLabelLocales };
}

export interface JtLabelLocales {
  [key: string]: string | JtLabelLocales;
}
