# Kubernetes Dashboard (Local)

A modern, glassmorphism-styled Kubernetes dashboard for visualizing and managing your local clusters (Minikube, Kind, Docker Desktop, etc.). Built with Next.js, React, and Tailwind CSS.



## Features

*   **Real-time Cluster Monitoring**: View live status of Pods, deployments, services, nodes, and more.
*   **Interactive Resource Visualizer**: A drag-and-drop node-link graph to visualize relationships between resources (Pods, Services, Ingresses).
*   **Advanced Analytics**:
    *   **Container Restarts**: Identify unstable pods.
    *   **Network Activity**: Monitor API server request rates.
    *   **Resource Efficiency**: CPU/Memory utilization and pod density per node.
    *   **HPA Autoscaling**: Visualize Horizontal Pod Autoscalers, current replicas, and metric targets.
*   **Helm Chart Manager**:
    *   Browse and install charts from the embedded App Catalog.
    *   Manage existing Helm releases (install, uninstall, view history).
    *   View release revisions and status.
*   **RBAC Visualization**: Clear distinction between Cluster-wide (ClusterRole/Binding) and Namespace-scoped (Role/Binding) permissions.
*   **Namespace Filtering**: Filter resources and metrics by namespace.
*   **Smart Search**: Filter resources by name, label, or status.
*   **Direct Actions**:
    *   Restart Deployments/StatefulSets.
    *   Delete Pods.
    *   Scale Replicas (via HPA).

## Tech Stack

-   **Frontend**: [Next.js](https://nextjs.org/), [React 19](https://react.dev/)
-   **Styling**: Custom CSS (Glassmorphism), [Lucide React](https://lucide.dev/) (Icons)
-   **Animation**: [Framer Motion](https://www.framer.com/motion/)
-   **Charts**: [Recharts](https://recharts.org/)
-   **Kubernetes Integration**: [@kubernetes/client-node](https://github.com/kubernetes-client/javascript)
-   **Data Fetching**: [SWR](https://swr.vercel.app/)

## Prerequisites

-   **Node.js** (v18 or later recommended)
-   **Kubernetes Cluster**: A running local cluster (e.g., Minikube, Kind, Docker Desktop).
-   **kubectl**: Configured to point to your local cluster.
-   **Helm**: Installed and available in your path (for Helm management features).

## Installation

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd k8s_dashboard
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

## Metrics Server Setup (Local Clusters)

To enable metrics (CPU/Memory usage) on local clusters like Docker Desktop, you may need to install the Metrics Server with insecure TLS enabled:

1.  **Apply the manifest**:
    ```bash
    kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
    ```

2.  **Patch for local development**:
    ```bash
    kubectl patch deployment metrics-server -n kube-system --type='json' -p='[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
    ```

## Usage

1.  **Start the development server**:
    ```bash
    npm run dev
    ```

2.  **Open the dashboard**:
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

    The dashboard will automatically connect to your active Kubernetes context (as defined in `~/.kube/config`).

## Configuration

*   **Kubeconfig**: The app uses the default kubeconfig location (`~/.kube/config`). Ensure your context is set correctly before starting.
*   **Port**: runs on port `3000` by default.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
