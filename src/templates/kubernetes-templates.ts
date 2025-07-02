import * as fs from 'fs';
import * as path from 'path';

/**
 * KubernetesTemplates handles Kubernetes and Helm configurations
 */
export class KubernetesTemplates {
  
  static async createKubernetesTemplates(projectRoot: string): Promise<void> {
    const k8sPath = path.join(projectRoot, 'k8s');
    
    if (!fs.existsSync(k8sPath)) {
      fs.mkdirSync(k8sPath, { recursive: true });
    }

    // Create deployment template
    const deploymentPath = path.join(k8sPath, 'deployment.yaml');
    if (!fs.existsSync(deploymentPath)) {
      const deploymentContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: cortexweaver-app
  labels:
    app: cortexweaver
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cortexweaver
  template:
    metadata:
      labels:
        app: cortexweaver
    spec:
      containers:
      - name: cortexweaver
        image: cortexweaver:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: NEO4J_URI
          value: "bolt://neo4j-service:7687"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: cortexweaver-service
spec:
  selector:
    app: cortexweaver
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
`;

      fs.writeFileSync(deploymentPath, deploymentContent);
    }

    // Create Neo4j StatefulSet
    const neo4jPath = path.join(k8sPath, 'neo4j.yaml');
    if (!fs.existsSync(neo4jPath)) {
      const neo4jContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: neo4j-config
data:
  NEO4J_AUTH: "neo4j/cortexweaver"
  NEO4J_dbms_memory_heap_initial__size: "512m"
  NEO4J_dbms_memory_heap_max__size: "1G"
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: neo4j
spec:
  serviceName: neo4j-service
  replicas: 1
  selector:
    matchLabels:
      app: neo4j
  template:
    metadata:
      labels:
        app: neo4j
    spec:
      containers:
      - name: neo4j
        image: neo4j:5.15
        ports:
        - containerPort: 7474
          name: http
        - containerPort: 7687
          name: bolt
        envFrom:
        - configMapRef:
            name: neo4j-config
        volumeMounts:
        - name: neo4j-data
          mountPath: /data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
  volumeClaimTemplates:
  - metadata:
      name: neo4j-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: neo4j-service
spec:
  selector:
    app: neo4j
  ports:
  - name: http
    port: 7474
    targetPort: 7474
  - name: bolt
    port: 7687
    targetPort: 7687
  clusterIP: None
`;

      fs.writeFileSync(neo4jPath, neo4jContent);
    }
  }

  static async createHelmChart(projectRoot: string): Promise<void> {
    const helmPath = path.join(projectRoot, 'helm', 'cortexweaver');
    
    if (!fs.existsSync(helmPath)) {
      fs.mkdirSync(helmPath, { recursive: true });
    }

    // Create Chart.yaml
    const chartPath = path.join(helmPath, 'Chart.yaml');
    if (!fs.existsSync(chartPath)) {
      const chartContent = `apiVersion: v2
name: cortexweaver
description: A Helm chart for CortexWeaver application
type: application
version: 0.1.0
appVersion: "1.0.0"
keywords:
  - cortexweaver
  - ai
  - multi-agent
home: https://github.com/your-org/your-cortexweaver-project
sources:
  - https://github.com/your-org/your-cortexweaver-project
maintainers:
  - name: Your Team
    email: team@example.com
`;

      fs.writeFileSync(chartPath, chartContent);
    }

    // Create values.yaml
    const valuesPath = path.join(helmPath, 'values.yaml');
    if (!fs.existsSync(valuesPath)) {
      const valuesContent = `# Default values for cortexweaver
replicaCount: 3

image:
  repository: cortexweaver
  pullPolicy: IfNotPresent
  tag: "latest"

nameOverride: ""
fullnameOverride: ""

service:
  type: ClusterIP
  port: 80
  targetPort: 3000

ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: cortexweaver.local
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 100
  targetCPUUtilizationPercentage: 80

nodeSelector: {}
tolerations: []
affinity: {}

# Neo4j configuration
neo4j:
  enabled: true
  auth:
    password: "cortexweaver"
  core:
    numberOfServers: 1
  persistence:
    size: 10Gi
`;

      fs.writeFileSync(valuesPath, valuesContent);
    }

    // Create templates directory
    const templatesPath = path.join(helmPath, 'templates');
    if (!fs.existsSync(templatesPath)) {
      fs.mkdirSync(templatesPath, { recursive: true });
    }

    // Create deployment template
    const deploymentTemplatePath = path.join(templatesPath, 'deployment.yaml');
    if (!fs.existsSync(deploymentTemplatePath)) {
      const deploymentTemplateContent = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "cortexweaver.fullname" . }}
  labels:
    {{- include "cortexweaver.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "cortexweaver.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "cortexweaver.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: {{ .Values.service.targetPort }}
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
          readinessProbe:
            httpGet:
              path: /health
              port: http
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
`;

      fs.writeFileSync(deploymentTemplatePath, deploymentTemplateContent);
    }
  }
}
