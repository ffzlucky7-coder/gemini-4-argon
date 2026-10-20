# 🤝 Contributing to Gemini 4 Argon

First of all, thank you for considering contributing to **Gemini 4 Argon**! It is contributions from developers like you that help open-source tools grow and reach the top of the developer ecosystem.

This project is created and maintained by **[Lucky Kuntal](https://github.com/ffzlucky7-coder)**.

---

## 🔒 Governance & Contribution Approval Process

To protect project stability, code quality, and user privacy, this repository follows standard open-source governance:

1. **Owner Authority**: Only the project maintainer (**Lucky Kuntal / @ffzlucky7-coder**) has write access to the `main` branch.
2. **Pull Requests Required**: No code can be committed directly to `main` by external contributors. All contributions must go through a **Fork -> Feature Branch -> Pull Request (PR)** workflow.
3. **Mandatory Code Review & Approval**: Every Pull Request must be reviewed, tested, and explicitly approved by Lucky Kuntal before being merged into the codebase.

---

## 🚀 How to Contribute

### 1. Report a Bug or Request a Feature
- Check existing [GitHub Issues](https://github.com/ffzlucky7-coder/gemini-4-argon/issues) to avoid duplicates.
- If not already reported, open a new issue using our **Bug Report** or **Feature Request** template.

### 2. Fork the Repository
1. Navigate to [https://github.com/ffzlucky7-coder/gemini-4-argon](https://github.com/ffzlucky7-coder/gemini-4-argon).
2. Click the **Fork** button in the top-right corner to create your personal copy of the repository.
3. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/gemini-4-argon.git
   cd gemini-4-argon
   ```

### 3. Create a Feature Branch
Always create a descriptive branch for your work:
```bash
git checkout -b feat/my-awesome-improvement
```

### 4. Development & Coding Guidelines
- **Zero External npm Dependencies**: Keep the extension ultra-fast, lightweight, and secure. Use only built-in Node.js modules (`fs`, `path`, `child_process`, `crypto`, `readline`, `fetch`).
- **Zero Hardcoded Secrets or Paths**: Never commit personal Google Cloud Project IDs, API keys, or absolute file paths from your local machine.
- **Syntax Verification**: Run `node -c` on any modified JavaScript file before committing:
  ```bash
  node -c lucknexa.gemini-4-argon-1.0.0/extension.js
  node -c lucknexa.gemini-4-argon-1.0.0/providerAdapter.js
  node -c lucknexa.gemini-4-argon-1.0.0/mcp/server.js
  ```
- **Apple-Grade Glass Design Integrity**: Preserve the frosted glass aesthetic, high contrast typography, and vector SVG iconography. Never add cheap text emojis into the interface.

### 5. Submit a Pull Request
1. Commit your changes with a clear conventional commit message:
   ```bash
   git commit -m "feat: add support for XYZ capability"
   ```
2. Push the branch to your GitHub fork:
   ```bash
   git push origin feat/my-awesome-improvement
   ```
3. Open your fork on GitHub and click **"Compare & pull request"**.
4. Fill in the Pull Request checklist and submit it.
5. Lucky Kuntal will review your PR, provide constructive feedback, and merge it once verified!

---

## 📜 Code of Conduct

Please treat everyone in the community with respect and kindness. By participating in this project, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).

---

Thank you for helping make **Gemini 4 Argon** the leading autonomous coding agent!
