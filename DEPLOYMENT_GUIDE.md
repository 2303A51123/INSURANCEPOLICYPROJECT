# Deployment & Operations Guide
## Insurance Policy and Claims Management System
### Student: PUVATI VAMSHI VARDHAN RAO (Enrolment No: 2303A51123)

---

## 1. Local Environment Execution

### Prerequisites
- Node.js version 18.0.0 or higher
- Git

### Step-by-Step Instructions

1. **Navigate to the Project Directory**:
   ```bash
   cd insurance-policy-claims-system
   ```

2. **Run Automated Test Suite**:
   ```bash
   npm test
   ```
   *Expected Output: 13 Passed, 0 Failed.*

3. **Start the Application Server**:
   ```bash
   npm start
   ```
   *The server starts listening at `http://localhost:3000`.*

4. **Access the System in Web Browser**:
   Open Google Chrome, Firefox, or Microsoft Edge and navigate to:
   ```
   http://localhost:3000
   ```

5. **Test Role Switching**:
   - In the top header bar, use the **Role** dropdown to switch between:
     - `Admin (Full Control)`
     - `Policy Agent`
     - `Policy Holder (Customer)`
     - `Claims Officer`

---

## 2. Render Deployment

The root `render.yaml` defines a free Node.js web service. To deploy it:

1. Sign in to the [Render Dashboard](https://dashboard.render.com/).
2. Select **New > Blueprint** and connect this GitHub repository.
3. Select the `main` branch and approve the Blueprint named
   `insurance-policy-project-2303a51123`.
4. Wait for the first deploy to finish, then open the service's `onrender.com`
   URL. Render checks `/api/health` to verify the service is ready.

The free service may spin down while idle. The app stores its JSON data on the
service filesystem, which is not persistent across all redeploys or instance
restarts; use persistent storage or a database before relying on it for real
records. The included seed data is anonymized demonstration data.

---

## 3. Docker Containerization Execution

### Prerequisites
- Docker Engine / Docker Desktop installed and running

### Step-by-Step Instructions

1. **Build the Production Docker Image**:
   ```bash
   docker build -t insurance-policy-claims-app:v1.0 .
   ```

2. **Verify Image Creation**:
   ```bash
   docker images | grep insurance-policy-claims-app
   ```

3. **Run the Standalone Container**:
   ```bash
   docker run -d \
     -p 3000:3000 \
     --name insurance-container \
     insurance-policy-claims-app:v1.0
   ```

4. **Verify Container Health & Logs**:
   ```bash
   # Check container status (should show 'healthy')
   docker ps

   # Check application logs
   docker logs -f insurance-container

   # Test healthcheck endpoint
   curl http://localhost:3000/api/health
   ```

5. **Stop and Remove Container**:
   ```bash
   docker stop insurance-container
   docker rm insurance-container
   ```

---

## 4. Multi-Container Orchestration with Docker Compose

1. **Launch Full Multi-Container Stack (App + Redis + Named Volumes)**:
   ```bash
   docker-compose up -d --build
   ```

2. **Check Running Containers & Network**:
   ```bash
   docker-compose ps
   docker network ls
   ```

3. **Test Persistence**:
   - Open `http://localhost:3000`, file a new claim or pay a premium.
   - Restart the container stack:
     ```bash
     docker-compose restart
     ```
   - Refresh the page: All changes persist via named volume `insurance-data`!

4. **Teardown**:
   ```bash
   docker-compose down
   ```

---

## 5. Kubernetes Cluster Deployment (Minikube / Cloud K8s)

### Prerequisites
- Kubernetes cluster (Minikube, Kind, k3s, EKS, AKS, or GKE)
- `kubectl` CLI configured

### Step-by-Step Instructions

> `k8s/secret.yaml` contains placeholder values only. Replace them with unique,
> strong values before deployment, and never commit real credentials.

1. **Start Minikube (if using local cluster)**:
   ```bash
   minikube start
   ```

2. **Load Docker Image into Minikube**:
   ```bash
   minikube image load insurance-policy-claims-app:v1.0
   ```

3. **Deploy All Kubernetes Manifests**:
   ```bash
   # Using Kustomize (single declarative command):
   kubectl apply -k k8s/

   # OR apply individually:
   kubectl apply -f k8s/namespace.yaml
   kubectl apply -f k8s/configmap.yaml
   kubectl apply -f k8s/secret.yaml
   kubectl apply -f k8s/pvc.yaml
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   kubectl apply -f k8s/hpa.yaml
   kubectl apply -f k8s/ingress.yaml
   ```

4. **Verify Cluster Resources**:
   ```bash
   # Check namespace
   kubectl get namespaces

   # Check running pods (should show 2 replicas running)
   kubectl get pods -n insurance-system -o wide

   # Check services and NodePort
   kubectl get services -n insurance-system

   # Check Persistent Volume Claim status (Bound)
   kubectl get pvc -n insurance-system

   # Check Horizontal Pod Autoscaler
   kubectl get hpa -n insurance-system
   ```

5. **Access Application via NodePort**:
   ```bash
   # On Minikube:
   minikube service insurance-service -n insurance-system

   # Direct browser URL:
   http://<minikube-ip>:30080
   ```

6. **Cleanup Kubernetes Resources**:
   ```bash
   kubectl delete -k k8s/
   ```
