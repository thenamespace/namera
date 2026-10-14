// Keep Namespace UIKit behind this facade. Dashboard code gets one stable
// import path for upstream primitives, Namera components, icons, and tokens.
export * from "@thenamespace/uikit";
export { Field, FieldError, FieldGroup, FieldLabel } from "./components/field.js";
export * from "./components/icon-picker/index.js";
export * from "./components/metadata-display.js";
export * from "./components/status-display.js";
