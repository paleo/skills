---
name: pleasant-bem-css
description: Pleasant BEM Syntax and methodology: read it each time you write CSS class names.
---

# Pleasant BEM Syntax and methodology

This document explains how to properly use BEM (Block-Element-Modifier) methodology in the codebase.

We don't use the classic BEM syntax. We use **Pleasant BEM**.

## Pleasant BEM

Syntax:

- `.BlockName`
- `.BlockName.modifierName`
- `.BlockName-elementName`
- `.BlockName-elementName.modifierName`

### Regular Modifiers (Most Common)

Regular modifiers change the appearance or state of a specific block or element. They are the most frequently used BEM feature:

```html
<!-- Block modifier -->
<button className="Button.primary">Save</button>
<button className="Button.secondary">Cancel</button>

<!-- Element modifier -->
<div className="Card">
  <h2 className="Card-title.large">Title</h2>
</div>
```

```css
.Button {
  padding: 8px 16px;
  border: 1px solid #ccc;
}

.Button.primary {
  background: blue;
  color: white;
}

.Button.secondary {
  opacity: 0.5;
  cursor: not-allowed;
}

.Card-title {
  font-size: 16px;
}

.Card-title.large {
  font-size: 24px;
}
```

Use regular modifiers for:

- Component variants (`.Button.primary`, `.Alert.warning`)
- States (`.Input.focused`, `.Modal.open`)
- Size variations (`.Text.small`, `.Icon.large`)

### Pleasant BEM Extensions

The Pleasant BEM syntax includes three extensions to standard BEM conventions. **These are advanced features used only in specific situations:**

### Extension 1: Global Modifiers

**Use sparingly.** Prefix with an underscore a CSS class that can affect multiple unrelated blocks across the application:

```css
._mobile .PageTitle {
  /* something specific for mobile devices */
}

._mobile .Post-h1 {
  /* something specific too */
}
```

Global modifiers are only needed for:

- Device/viewport-specific styles affecting many blocks (`.\_mobile`, `.\_print`)
- Application-wide themes (`.\_dark-mode`)

**Note:** Most component variations should use regular modifiers, not global ones.

### Extension 2: Child and Sibling Selectors Inside a Block

Elements can be styled using child selectors and sibling selectors within their block:

```css
.TitledList-ul > li {
  background-color: #ccc;
}
```

Note: This ties some CSS classes to HTML tags, but preserves scalability and the ability to nest sub-blocks.

### Extension 3: Scoped Cascade

Global modifiers can be used for styling semantic elements using cascading and inheritance. It's also fine to use "pseudo BEM blocks" (like `.Text`) that act like global modifiers but with block characteristics for formatted content:

```css
._text,
.Text {
  hyphens: auto;
  overflow-wrap: break-word;
  em, i {
    font-style: italic;
  }
  strong, b {
    font-weight: bold;
  }
  p, ul, ol {
    margin-bottom: .65em;
  }
  img.left {
    float: left; 
  }
  img.right {
    float: right; 
  }
}
.Text {
  &::after { /* because of the floated images */
    clear: both;
    content: "";
    display: block;
  }
}
```

**Important**: Do not use any styles that apply to the container box (`background`, `border`, `display`, `flex`, `grid`, `margin`, `padding`, `position`, etc.) on the global modifier itself. Instead, use in association with other CSS classes:

```html
<article className="Post">
  <h1 className="Post-h1 _text">Here a <em>formatted title</em></h1>
  <div className="Post-body Text">
    <p>Some <strong>formatted text</strong>.</p>
  </div>
</article>
```

## Core Rule: Elements Must Be Inside Their Blocks

A BEM element (`.Block-element`) must always be a descendant of its block (`.Block`). Using an element class without its parent block violates encapsulation and breaks the methodology.

```html
// ❌ BAD: Element without its block
<>
  <span className="PaField-label">Label</span>
</>

// ✅ GOOD: Elements inside their block
<label className="PaField">
  <span className="PaField-label">Label</span>
</label>
```

## Block Composition

Blocks can be composed by adding multiple block classes to an element when the element semantically belongs to both:

```html
// ✅ GOOD: Element belongs to both blocks
<label className="PaSelectField PaField">...</label>
```

This is valid because:

- The `<label>` IS a select wrapper (PaSelectField)
- The `<label>` IS a form field (PaField)

## Common Patterns

### Form Fields in Admin-UI

Always use `PaField` block for form field layouts:

```html
<label className="PaField">
  <span className="PaField-label">{t("common.title")}</span>
  ...input element...
</label>
```

### Utilities are standalone blocks

```html
<div className="PaMb2">...</div>
```
