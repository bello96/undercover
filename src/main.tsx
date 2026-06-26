import { install } from "@twind/core";
import presetAutoprefix from "@twind/preset-autoprefix";
import presetTailwind from "@twind/preset-tailwind";
import { createRoot } from "react-dom/client";
import App from "./App";

install({
  presets: [presetAutoprefix(), presetTailwind()],
  theme: {
    extend: {
      colors: {
        // Brand & Accent —— 保留 Linear 标志性 lavender-blue 品牌主色
        primary: "#5e6ad2",
        "primary-hover": "#4f5bc7", // 亮色模式：hover 加深（暗色模式是变亮）
        "primary-focus": "#4a56bd",
        "on-primary": "#ffffff",
        // Text —— 亮色模式：近黑文字（非纯黑，呼应 Linear 克制）
        ink: "#16181d",
        "ink-muted": "#42464e",
        "ink-subtle": "#6b7078",
        "ink-tertiary": "#9aa0a8",
        // Surface ladder —— 亮色模式：灰白页面底 → 纯白卡片浮起 → 浅灰内嵌
        canvas: "#f6f7f9",
        "surface-1": "#ffffff",
        "surface-2": "#eef0f2",
        "surface-3": "#e6e9ed",
        "surface-4": "#dee1e6",
        // Borders —— 亮色模式：浅灰描边
        hairline: "#e3e5ea",
        "hairline-strong": "#d0d4da",
        "hairline-tertiary": "#c0c5cd",
        // Brand
        "brand-secure": "#565b86",
        // Semantic（亮底友好：足够深以保证可读对比）
        "semantic-success": "#157f37",
        "semantic-error": "#d92d20",
        "semantic-overlay": "#000000", // 模态遮罩底色，配 bg-opacity 压暗背景
        // Inverse（亮色主题下的反色块：暗底白字，少量反色 CTA 用）
        "inverse-canvas": "#16181d",
        "inverse-surface-1": "#23252b",
        "inverse-surface-2": "#2c2f36",
        "inverse-ink": "#ffffff",
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
        // 亮色模式：用柔和投影做卡片浮起（暗色模式用的是 1px 描边）
        // Level 1: card lift
        card: "0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.10)",
        // Level 2: featured card
        "card-strong": "0 4px 12px rgba(16, 24, 40, 0.12), 0 2px 6px rgba(16, 24, 40, 0.06)",
        // Focus ring: 2px primary-focus outline
        focus: "0 0 0 2px rgba(94, 105, 209, 0.40)",
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(<App />);
