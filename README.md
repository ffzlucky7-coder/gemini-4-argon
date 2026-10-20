# 🚀 Gemini 4 Argon Autonomous Agent for Antigravity IDE & VS Code

### 👨‍💻 Created by [Lucky Kuntal](https://github.com/ffzlucky7-coder)

[![Author](https://img.shields.io/badge/Author-Lucky%20Kuntal-ff007f.svg?style=flat&logo=github)](https://github.com/ffzlucky7-coder)
[![Release](https://img.shields.io/badge/Release-v1.0.0-00d2ff.svg)](https://github.com/ffzlucky7-coder/gemini-4-argon)
[![Engine](https://img.shields.io/badge/Engine-Google%20Vertex%20AI-4285F4.svg)](https://cloud.google.com/vertex-ai)
[![Model](https://img.shields.io/badge/Model-Gemini%204%20Argon-7f00ff.svg)](https://cloud.google.com/vertex-ai)
[![IDE](https://img.shields.io/badge/IDE-Antigravity%20%7C%20VS%20Code-38bdf8.svg)](https://github.com/ffzlucky7-coder/gemini-4-argon)
[![Design](https://img.shields.io/badge/UI-Apple--Grade%20Glass-818cf8.svg)](#)
[![License](https://img.shields.io/badge/License-MIT-34d399.svg)](LICENSE)

> Developed by **Lucky Kuntal**, this extension integrates **Google's Flagship Gemini 4 Argon Reasoning AI** natively into Antigravity IDE and VS Code as a full-power autonomous software engineer and architect with complete workspace, file, and terminal execution powers.

---

## 🌟 Key Highlights & Capabilities

- 🤖 **Full Autonomous Workspace Power**:
  - `read_file`: Reads any file with line-number precision and range slicing.
  - `write_file`: Creates and overwrites files with automatic directory generation.
  - `edit_file`: Performs surgical search-and-replace code refactoring.
  - `list_dir` & `get_workspace_structure`: Maps the entire project architecture and directory trees.
  - `search_code`: Ultra-fast symbol and keyword searching across the repository.
  - `run_command`: Directly runs test suites (`pytest`, `npm test`, `cargo test`), linters, git commands, and build scripts.
- 🛡️ **Zero-Loss Safety Net**: Automatically creates a `.argon_bak` backup before modifying or overwriting any existing file.
- 🧠 **Dynamic 3-Level Reasoning Mode (Token & Speed Controller)**:
  - **`⚡ Low (Eco)`**: Lightning-fast execution, minimal token usage — ideal for quick edits, documentation, and simple questions.
  - **`⚖️ Medium`**: Balanced reasoning — perfect for daily feature development and bug hunting.
  - **`🧠 High (Deep Reasoning)`**: Full recursive reasoning budget — built for AAA architecture, deep code refactoring, security audits, and complex root-cause debugging.
- 🕒 **Persistent Multi-Session Chat History & Memory**:
  - Automatically saves all conversations across sessions, reloads, and IDE restarts.
  - Slide-out History Drawer lets you resume previous tasks, view timestamps and message counts, or start a fresh session with 1 click.
- 💎 **Apple-Grade Glassmorphic 3D UI**:
  - Refractive frosted glass aesthetics with ambient specular highlights.
  - Bottom-docked reasoning mode taskbar (Cursor / ChatGPT layout).
  - High-contrast typography optimized for both **Dark Mode** and **Light Mode**.
  - 100% crisp vector SVG icons (zero cheap emojis).
- ⚡ **Zero Bloat, High-Performance Engine**: Built entirely with native Node.js APIs (zero heavy `node_modules`). The entire extension is only **37 KB**!
- 🌐 **Universal Portability (Multi-User Ready)**: Anyone can install this extension and configure their own Google Cloud Project ID and credentials in seconds via the in-app **⚙️ Settings** dialog.
- 🔌 **Built-in Live Connection Tester**: 1-click test button verifies Vertex AI connection, token validity, and round-trip latency in real-time.

---

## 🎁 How to Get $300 (₹26,000 INR) Free Credits on Google Cloud

Google Cloud provides **$300 USD (approx. ₹26,000 INR)** in 100% free credits for 90 days to any new Google Cloud account. Follow these steps to claim yours:

1. **Visit the Free Trial Page**:
   - Open [https://cloud.google.com/free](https://cloud.google.com/free) in your web browser.
2. **Sign In**:
   - Click **"Get started for free"** and sign in with your Google account.
3. **Account & Verification**:
   - Select your Country.
   - Enter your name and address.
   - Add a credit/debit card for standard identity verification.
   - *Security Note:* Google will only run a temporary refundable verification check (₹2 in India / $1 USD) and immediately refunds it. **Google will NEVER automatically charge your card after the free trial ends** unless you explicitly choose to upgrade to a paid account.
4. **Welcome Credits Activated**:
   - Once verified, your account instantly receives **$300 USD credit (valid for 90 days)**!

---

## ⚡ Setup: What You Need from Google Cloud

To run Gemini 4 Argon, you only need **two things**:
1. Your **Google Cloud Project ID**
2. **Vertex AI API Enabled** + **One Credentials Method** (ADC, Service Account JSON, or API Key)

### Step 1: Enable Vertex AI API
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. In the top search bar, type `Vertex AI API`.
3. Select **Vertex AI API** from the results and click the blue **Enable** button.

### Step 2: Copy Your Project ID
1. In the Google Cloud Console top navigation bar, click on the project dropdown (next to "Google Cloud").
2. Copy your **Project ID** (e.g. `my-gemini-project-12345`). You will paste this into the extension settings.

---

## 🔑 Credentials Guide: 3 Easy Methods

You only need **ONE** of the following three authentication options:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Choose ANY 1 Auth Method:                         │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ Option A: ADC (Easiest)  │ Option B: Service Acct  │ Option C: API Key │
│ 1 terminal command       │ Best for sharing        │ Simple text key   │
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

### Option A: Application Default Credentials (ADC) — *Recommended for Developers*
If you have the Google Cloud SDK (`gcloud`) installed:
1. Open your terminal (PowerShell, Command Prompt, or Terminal).
2. Run this single command:
   ```bash
   gcloud auth application-default login
   ```
3. A browser tab will open — select your Google account and click **Allow**.
4. **Done!** The extension automatically detects these credentials on your system. Zero file copying needed!

---

### Option B: Service Account JSON Key — *Recommended for Sharing with Friends*
If you want to use the extension without installing the `gcloud` CLI:
1. In Google Cloud Console, open the navigation menu (☰) and navigate to **IAM & Admin** -> **Service Accounts**.
2. Click **+ CREATE SERVICE ACCOUNT** at the top.
3. Enter a name (e.g., `gemini-argon-agent`) and click **Create and Continue**.
4. In the **Role** dropdown, select **Vertex AI** -> **Vertex AI User**. Click **Done**.
5. Click on the created service account from the list -> open the **Keys** tab.
6. Click **Add Key** -> **Create new key** -> select **JSON** -> click **Create**.
7. A `.json` key file will download to your computer.
8. In the extension:
   - Click the **⚙️ Settings** icon in the header.
   - Select Auth Method: **Service Account Key (JSON file)**.
   - Click **Browse...** and select your downloaded JSON key file.
   - Click **Save Settings**!

---

### Option C: Vertex AI API Key
1. In Google Cloud Console, navigate to **APIs & Services** -> **Credentials**.
2. Click **+ CREATE CREDENTIALS** -> **API key**.
3. Copy the generated key.
4. In the extension ⚙️ Settings, select Auth Method: **Vertex AI API Key**, paste your key, and click **Save Settings**.

---

## 🛡️ Budget Alert Guard (Ensure 100% Zero Out-of-Pocket Cost)

To ensure you never accidentally spend more than your free credits:
1. In Google Cloud Console, open the navigation menu (☰) and select **Billing**.
2. Click **Budgets & alerts** in the left sidebar.
3. Click **+ CREATE BUDGET**.
4. Set Target:
   - Scope: Select your Project.
   - Target amount: Set a small target like **$10 USD** (or **₹1,000 INR**).
   - Set threshold alerts at **50%**, **80%**, and **100%**.
   - Check the box: *"Email alerts to billing account administrators"*.
5. Click **Finish**. Google will email you well before you reach any billing threshold.

---

## 📦 Installation Guide

### Method 1: 1-Click Installer (Windows)
Double-click **`INSTALL.bat`** inside this repository folder! It automatically deploys the extension directly into Antigravity IDE and VS Code.

### Method 2: Install via GUI (Antigravity IDE or VS Code)
1. Open Antigravity IDE or VS Code.
2. Press `Ctrl + Shift + P` (or `Cmd + Shift + P` on macOS).
3. Type and select: **`Extensions: Install from VSIX...`**.
4. Select `gemini-4-argon-1.0.0.vsix` from this folder.
5. Reload window (`Developer: Reload Window`).

### Method 3: Command Line Installation
Open your terminal in the directory where `gemini-4-argon-1.0.0.vsix` is located:

```bash
# For Antigravity IDE:
antigravity-ide --install-extension ./gemini-4-argon-1.0.0.vsix

# For standard VS Code:
code --install-extension ./gemini-4-argon-1.0.0.vsix
```

---

## 🎮 How to Use

1. **Open the Agent**:
   - Click the glowing **Gemini 4 Argon** icon in the left Activity Bar.
   - Or press `Ctrl + Shift + P` and search: `Gemini 4 Argon: Open Gemini 4 Argon Agent`.
2. **Select Reasoning Level**:
   - Choose **⚡ Low (Eco)**, **⚖️ Medium**, or **🧠 High (Deep)** right above the input bar based on task complexity.
3. **Execute Autonomous Tasks**:
   - Click Quick Action chips in the welcome card:
     - **Audit Project**: Scans workspace architecture, inspects key modules, finds bugs & technical debt, and suggests actionable fixes.
     - **Audit File**: Inspects the currently active editor file and suggests refactorings.
     - **Run Tests**: Executes test suites in the workspace and explains failures.
     - **Map Tree**: Generates an architectural tree of the workspace.
   - Or assign any complex task:
     - *"Audit `api/main.py` for potential race conditions and performance bottlenecks."*
     - *"Run `npm test` and fix failing assertions in `tests/auth.test.ts`."*
4. **Chat History & Sessions**:
   - Click the **🕒 History** icon in the header to open the Saved Conversations drawer.
   - Switch between conversations or click **+ New Chat** anytime.

---

## 👤 Author & Creator

**Lucky Kuntal**
- **GitHub**: [@ffzlucky7-coder](https://github.com/ffzlucky7-coder)
- **Repository**: [https://github.com/ffzlucky7-coder/gemini-4-argon](https://github.com/ffzlucky7-coder/gemini-4-argon)
- **Created for**: Antigravity IDE & VS Code

---

## 📄 License

MIT License. Free to use, modify, and distribute.

Copyright (c) 2026 **Lucky Kuntal**.
