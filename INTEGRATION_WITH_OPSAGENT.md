# AI Ops Assistant (Floating Widget)

The kDashM dashboard now features a premium, floating **AI Ops Assistant**—styled like a customer support chat window. This allows you to chat with an AI expert while simultaneously viewing your cluster resources, metrics, and logs.

## 🚀 How to Use the Assistant

### 1. Start the OpsAgent Backend
The assistant in this dashboard requires the `opsagent` API server to be running.
In your `opsagent` directory:
```bash
cd api-server
node index.js
```

### 2. Launch the Dashboard
In this `kdashm` directory:
```bash
npm run dev
```

### 3. Interaction
- **Floating Bubble**: Click the blue terminal icon in the **bottom-right corner** of the screen to open the chat.
- **Sidebar Access**: You can also toggle the assistant by clicking **AI Ops Agent** in the left navigation sidebar.
- **Troubleshooting**: Ask the agent to diagnose errors like `CrashLoopBackOff` or help with deployments. It has direct access to your clusters!

## 🧩 UI Architecture
- **Non-Blocking**: The chat window floats on top of the content area, so you can switch between Pods, Deployments, and Namespaces without closing the AI.
- **Markdown Support**: The assistant now supports structured responses with bold text, code blocks, and proper lists.
- **Context Aware**: The agent knows about your current workspace and the clusters you are managing.
