import { install } from "@twind/core";
import presetAutoprefix from "@twind/preset-autoprefix";
import presetTailwind from "@twind/preset-tailwind";
import { createRoot } from "react-dom/client";

install({
  presets: [presetAutoprefix(), presetTailwind()],
  theme: {
    extend: {
      colors: {
        // Brand & Accent
        primary: "#5e6ad2",
        "primary-hover": "#828fff",
        "primary-focus": "#5e69d1",
        "on-primary": "#ffffff",
        // Text
        ink: "#f7f8f8",
        "ink-muted": "#d0d6e0",
        "ink-subtle": "#8a8f98",
        "ink-tertiary": "#62666d",
        // Surface ladder
        canvas: "#010102",
        "surface-1": "#0f1011",
        "surface-2": "#141516",
        "surface-3": "#18191a",
        "surface-4": "#191a1b",
        // Borders
        hairline: "#23252a",
        "hairline-strong": "#34343a",
        "hairline-tertiary": "#3e3e44",
        // Semantic
        success: "#27a644",
        // Inverse (for rare inverse CTAs)
        "inverse-canvas": "#ffffff",
        "inverse-ink": "#000000",
      },
      fontFamily: {
        // Linear Display fallback stack (custom typeface not publicly distributed)
        display: [
          '"SF Pro Display"',
          "Inter",
          "-apple-system",
          "system-ui",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        // Linear Text fallback stack
        text: [
          '"SF Pro Text"',
          "Inter",
          "-apple-system",
          "system-ui",
          '"Segoe UI"',
          "Roboto",
          "sans-serif",
        ],
        // Linear Mono fallback stack
        mono: ['"SF Mono"', "ui-monospace", "Menlo", '"JetBrains Mono"', "monospace"],
      },
      fontSize: {
        // Display scale (from DESIGN.md typography section)
        "display-xl": ["80px", { lineHeight: "1.05", letterSpacing: "-3.0px" }],
        "display-lg": ["56px", { lineHeight: "1.10", letterSpacing: "-1.8px" }],
        "display-md": ["40px", { lineHeight: "1.15", letterSpacing: "-1.0px" }],
        headline: ["28px", { lineHeight: "1.20", letterSpacing: "-0.6px" }],
        "card-title": ["22px", { lineHeight: "1.25", letterSpacing: "-0.4px" }],
        subhead: ["20px", { lineHeight: "1.40", letterSpacing: "-0.2px" }],
        "body-lg": ["18px", { lineHeight: "1.50", letterSpacing: "-0.1px" }],
        body: ["16px", { lineHeight: "1.50", letterSpacing: "-0.05px" }],
        "body-sm": ["14px", { lineHeight: "1.50", letterSpacing: "0" }],
        caption: ["12px", { lineHeight: "1.40", letterSpacing: "0" }],
        button: ["14px", { lineHeight: "1.20", letterSpacing: "0" }],
        eyebrow: ["13px", { lineHeight: "1.30", letterSpacing: "0.4px" }],
        mono: ["13px", { lineHeight: "1.50", letterSpacing: "0" }],
      },
      borderRadius: {
        // From DESIGN.md rounded section
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        xxl: "24px",
        pill: "9999px",
        full: "9999px",
      },
      boxShadow: {
        // Linear uses surface ladder + hairline borders, minimal drop shadows on dark
        // Level 1: card lift
        card: "0 0 0 1px #23252a",
        // Level 2: featured card
        "card-strong": "0 0 0 1px #34343a",
        // Focus ring: 2px primary-focus outline at 50% opacity
        focus: "0 0 0 2px rgba(94, 105, 209, 0.5)",
      },
    },
  },
});

// App.tsx 在后续单元实现，此处用占位渲染保证可编译可启动
createRoot(document.getElementById("root")!).render(
  <div className="p-8 text-ink">谁是卧底 · boot</div>,
);
