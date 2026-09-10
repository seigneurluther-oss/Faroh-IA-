/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#17212B',
    tint: '#F26A4F',

    // Core surfaces
    background: '#F7F5F0',
    foreground: '#17212B',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#17212B',

    // Primary action color (buttons, links, active states)
    primary: '#F26A4F',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#EEF1F3',
    secondaryForeground: '#17212B',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E7ECEE',
    mutedForeground: '#72808A',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#DCEFE9',
    accentForeground: '#167C68',

    // Destructive actions (delete, error states)
    destructive: '#D95C5C',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#E1E7E8',
    input: '#D6DFE1',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
