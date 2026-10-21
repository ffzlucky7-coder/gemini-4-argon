# 🎨 Apple-Grade Glassmorphic UI/UX Design System Prompt

**Product**: Gemini 4 Argon Autonomous Coding Agent Extension  
**Creator & Architect**: [Lucky Kuntal](https://github.com/ffzlucky7-coder)  
**Target Platform**: Antigravity IDE & Visual Studio Code Webview  
**Design Paradigm**: Ultra-Premium Apple Frosted Glass (visionOS / macOS Sonoma / Cursor IDE Ergonomics)  

---

## 🎯 Master UI Design Prompt (For AI Models & Frontend Designers)

> **Prompt Role**: You are a Principal Design Engineer and Apple Human Interface Guidelines (HIG) specialist. Design and code an ultra-premium, crystal-clear, 3D glassmorphic webview user interface for an autonomous AI coding extension named **"Gemini 4 Argon"** by **Lucky Kuntal**.
> 
> The interface must feature refractive blurred surfaces, ambient specular highlights, buttery-smooth spring micro-interactions (`cubic-bezier(0.34, 1.56, 0.64, 1)`), pixel-perfect SVG iconography (strictly zero cheap emojis), a bottom-docked reasoning taskbar, and seamless dual-theme adaptability (**Deep Space Dark Glass** and **Apple Ceramic Light Glass**).

---

## 💎 Design Tokens & Visual Specifications

### 1. Color Palette & Glass Physics Tokens

#### Dark Mode (`[data-theme="dark"]` / Default)
```css
--glass-bg: rgba(15, 23, 42, 0.82);
--glass-surface: rgba(255, 255, 255, 0.05);
--glass-surface-hover: rgba(255, 255, 255, 0.10);
--glass-surface-active: rgba(255, 255, 255, 0.16);
--glass-border: rgba(255, 255, 255, 0.12);
--glass-border-specular: rgba(255, 255, 255, 0.35);
--glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.45);
--glass-shadow-sm: 0 4px 16px 0 rgba(0, 0, 0, 0.25);

--bg-solid: #0b0f19;
--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-muted: #64748b;
--text-accent: #38bdf8;
--code-inline-bg: rgba(255, 255, 255, 0.08);
--code-inline-border: rgba(255, 255, 255, 0.14);
```

#### Light Mode (`[data-theme="light"]`)
```css
--glass-bg: rgba(255, 255, 255, 0.92);
--glass-surface: rgba(15, 23, 42, 0.04);
--glass-surface-hover: rgba(15, 23, 42, 0.08);
--glass-surface-active: rgba(15, 23, 42, 0.12);
--glass-border: rgba(15, 23, 42, 0.12);
--glass-border-specular: rgba(255, 255, 255, 0.95);
--glass-shadow: 0 8px 28px 0 rgba(15, 23, 42, 0.10);
--glass-shadow-sm: 0 2px 10px 0 rgba(15, 23, 42, 0.07);

--bg-solid: #f8fafc;
--text-primary: #0f172a;
--text-secondary: #475569;
--text-muted: #64748b;
--text-accent: #0284c7;
--code-inline-bg: rgba(15, 23, 42, 0.06);
--code-inline-border: rgba(15, 23, 42, 0.12);
```

#### Brand Identity Accents
```css
--brand-cyan: #00d2ff;
--brand-blue: #3a7bd5;
--brand-purple: #7f00ff;
--brand-glow: rgba(0, 210, 255, 0.35);
--brand-gradient: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 50%, #7f00ff 100%);
```

---

## 📐 Layout Architecture & Component Hierarchy

### Component 1: Frosted Glass Header
- **Position**: Sticky top (`z-index: 20`), `backdrop-filter: blur(20px) saturate(180%)`.
- **Left Side - Brand Group**:
  - Glowing Avatar icon (SVG star with pulsing radial glow `#00d2ff`).
  - Title: **Gemini 4 Argon** (linear gradient text fill from cyan to violet).
  - Chip: `VERTEX AI` (pill badge, uppercase, subtle outline).
  - Subline: `by Lucky Kuntal` in muted secondary text.
- **Right Side - Action Toolbar**:
  - `themeToggleBtn`: Seamless SVG Moon 🌙 / Sun ☀️ toggle switch.
  - `historyToggleBtn`: Clock icon with badge counter for saved sessions.
  - `newChatBtn`: Minimal Plus icon (`+`).
  - `guideBtn`: Open book icon (`📖`).
  - `settingsBtn`: Gear icon (`⚙️`).
- **Interaction**: Button spring scale `transform: translateY(-2px) scale(1.04)` on hover, `scale(0.92)` on active.

### Component 2: Bottom-Docked Reasoning Mode Taskbar (Cursor Layout)
- **Position**: Docked directly above the chat input box (not cluttering the header).
- **Control**: Segmented Pill Switcher with 3 reasoning levels:
  1. `⚡ Low (Eco)`: Fast execution, minimal tokens for quick edits.
  2. `⚖️ Medium`: Balanced depth for daily features.
  3. `🧠 High (Deep)`: Full recursive reasoning for architecture & audits.
- **Active State**: Inset specular reflection, vibrant brand gradient background, crisp white text, and a glowing neon shadow.

### Component 3: Chat Stream & Markdown Hierarchy
- **User Message**:
  - Right-aligned rounded bubble with subtle frosted background (`rgba(56, 189, 248, 0.15)` in dark mode, `#0284c7` tint in light mode).
  - High-contrast primary text, crisp font rendering.
- **Model Output**:
  - Left-aligned markdown stream.
  - Monospace inline code words (`path/file.py`, `func()`) formatted with subtle translucent background (`--code-inline-bg`), NOT heavy oversized blue tags.
  - Code Blocks: Dark obsidian container with language label, 1-click **Copy Code** button, and syntax highlighted monospace typography (`SF Mono`, `JetBrains Mono`).
- **Autonomous Tool Pills**:
  - Subtle compact status pill (`⚡ Running: read_file...` -> `✓ read_file completed`).
  - Clean drop-in replacement for raw JSON parameter dumps.

### Component 4: Floating Input Capsule
- **Container**: Floating frosted glass capsule with 1px specular highlight along top edge.
- **Input Area**: Auto-expanding textarea (max 120px) with comfortable line height and placeholder text:
  *"Ask Gemini 4 Argon or assign an autonomous task... (Enter to send)"*.
- **Send Action**: Right-docked circular / pill send button with SVG arrow icon.
  - Hover: Subtle scale-up + cyan ambient glow.
  - Active: Spring press effect.

### Component 5: Live Status Bar & Abort Action
- **Position**: Directly between the Reasoning Taskbar and the Input Capsule.
- **Visual**: Glass capsule containing:
  - Pulsing neon dot (cyan pulse animation).
  - Status text (e.g. `Reasoning (HIGH)...` or `Executing: npm test...`).
  - Right-aligned **Stop** button (`abortBtn`) with soft red glass badge (`#ef4444`).

### Component 6: Slide-out Saved Conversations Drawer
- **Drawer**: Absolute slide-out from left (`width: 280px`), heavy frosted glass backdrop blur (`28px`).
- **Header**: `Saved Conversations` with session count badge + `+ New Chat` button.
- **Session Item Card**:
  - Conversation Title (auto-generated from first prompt).
  - Timestamp (e.g. `Just now`, `2h ago`).
  - Message count badge + Reasoning mode tag.
  - 1-Click Delete trash icon on hover.
- **Backdrop**: Smooth dark blur overlay closing drawer on tap.

### Component 7: Google Cloud Settings Modal
- **Layout**: Centered modal with glass backdrop blur (`12px`).
- **Form Controls**:
  - Project ID field with description.
  - Location picker (`global`, `us-central1`, etc.).
  - Auth Method selector (`ADC`, `Service Account JSON`, `API Key`).
  - ADC auto-detection badge with `word-break: break-all` path display (zero horizontal scrollbar).
- **Actions**:
  - `Test Connection` button with live round-trip latency indicator.
  - `Save Settings` primary 3D button.

### Component 8: Quick Setup Guide Modal
- **Steps**:
  - **Step 1**: Claim $300 Free Google Cloud Credits.
  - **Step 2**: Enable Vertex AI API.
  - **Step 3**: Configure Local ADC / Service Account.
- **Footer Deep Link**:
  - Prominent banner: **"Need Complete Step-by-Step Instructions?"**
  - Action Button: **"🌐 View Full Setup Guide on GitHub"** pointing to `https://github.com/ffzlucky7-coder/gemini-4-argon#readme`.

---

## ⚡ Animation & Micro-Interaction Specs

```css
/* Spring Physics Curve */
--spring-curve: cubic-bezier(0.34, 1.56, 0.64, 1);
--smooth-ease: cubic-bezier(0.16, 1, 0.3, 1);

/* Modal Open Animation */
@keyframes modalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes dialogScaleUp {
  from { opacity: 0; transform: scale(0.93) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Pulsing Status Dot */
@keyframes statusDotPulse {
  0%, 100% { transform: scale(1); opacity: 1; box-shadow: 0 0 6px var(--brand-cyan); }
  50% { transform: scale(1.3); opacity: 0.7; box-shadow: 0 0 14px var(--brand-cyan); }
}

/* Button Spring Micro-interaction */
.glass-icon-btn {
  transition: transform 0.2s var(--spring-curve), background 0.15s ease, border-color 0.15s ease, box-shadow 0.2s ease;
}
.glass-icon-btn:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 4px 12px rgba(56, 189, 248, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.glass-icon-btn:active {
  transform: translateY(1px) scale(0.92);
}
```

---

## 📜 Verification Checklist for UI Delivery

- [x] Subpixel typography anti-aliasing enabled on `body` (`optimizeLegibility`).
- [x] Zero cheap emojis (100% SVG vector icons for all tools and controls).
- [x] Reasoning mode taskbar docked above input bar (Cursor / Claude style).
- [x] Theme Toggle switch with persistent localStorage memory (Dark & Light).
- [x] Settings dialog completely free of horizontal scrollbar bugs.
- [x] Multi-session chat history drawer with session switching.
- [x] Creator credit proudly displayed: **Lucky Kuntal** ([@ffzlucky7-coder](https://github.com/ffzlucky7-coder)).
