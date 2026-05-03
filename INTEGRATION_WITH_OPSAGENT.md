# AI Ops Agent Integration

This `kdashm` dashboard now features a natively integrated **AI Ops Agent**. The agent can safely execute `kubectl` and shell commands against your Kubernetes clusters (like AKS or Docker Desktop) directly from the browser!

Because the browser sandbox restricts shell executions and prevents securely storing Azure OpenAI keys, the agent logic has been offloaded to a local backend API server running in the `opsagent` repository.

## Step-by-Step Instructions to Run the Integration (Frontend)

To view and interact with the AI Ops Agent within the `kdashm` dashboard, follow these steps:

### Step 1: Ensure the Ops Agent Backend is Running
Before using the agent in the UI, you must start its backend API. 
Open a terminal, navigate to your `opsagent` project directory, and run:
```bash
cd api-server
npm install  # (if not already installed)
node index.js
```
*This ensures the local agent is listening on `http://localhost:3001`.*

### Step 2: Start the kDashM Dashboard
Open a separate terminal in this `kdashm` project directory and start the Next.js development server as usual:
```bash
npm install
npm run dev
```

### Step 3: Access the Agent
1. Open your browser and navigate to `http://localhost:3000` (or whatever port Next.js uses).
2. Look at the left sidebar navigation.
3. Click on **AI Ops Agent** (right below the Overview tab).
4. A dedicated, dark-mode terminal UI will appear. You can start typing commands like *"Check the status of my pods"* or *"Deploy an nginx image"*!

## How it works securely
1. You type a prompt in the `<OpsAgentWidget />` component.
2. The React component sends an HTTP POST request to `http://localhost:3001/api/chat`.
3. The local `opsagent` Node.js server securely communicates with Azure AI Foundry.
4. The local `mcp-server` executes any necessary `kubectl` commands natively on your laptop.
5. The results are streamed directly back to your dashboard!
