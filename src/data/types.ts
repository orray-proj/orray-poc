import type { Node, Edge } from "@xyflow/react";

export type LayerId = "tracing" | "building" | "platform";

export type NodeKind = "service" | "database" | "queue" | "gateway" | "cache";

export type HealthStatus = "healthy" | "degraded" | "critical" | "unknown";
export type DeploymentStatus = "running" | "deploying" | "failed" | "pending";

export interface TeamInfo {
  name: string;
  color: string;
}

export interface ServiceFeature {
  id: string;
  name: string;
  description: string;
  team: TeamInfo;
  status: HealthStatus;
}

export interface TracingData {
  traceId: string;
  latencyMs: number;
  status: "ok" | "error" | "warning";
  errorMessage?: string;
  spanId: string;
  timestamp: string;
}

export interface BuildingData {
  isDraft: boolean;
  proposedBy?: string;
  ticketId?: string;
  description?: string;
}

export interface PlatformMetrics {
  cpu: number;
  memory: number;
  pods: { ready: number; total: number };
  health: HealthStatus;
  deploymentStatus: DeploymentStatus;
  version: string;
  lastDeploy: string;
  uptime: string;
}

export interface SystemNodeData {
  label: string;
  kind: NodeKind;
  description: string;
  team?: TeamInfo;
  features?: ServiceFeature[];

  tracing?: TracingData;
  building?: BuildingData;
  platform?: PlatformMetrics;

  [key: string]: unknown;
}

export interface SystemEdgeData {
  label?: string;
  protocol?: string;
  dataType?: string;

  tracing?: {
    active: boolean;
    latencyMs?: number;
    status: "ok" | "error" | "warning" | "inactive";
    throughput?: string;
  };
  building?: {
    isDraft: boolean;
  };
  platform?: {
    requestsPerSec?: number;
    errorRate?: number;
    p99Latency?: number;
  };

  [key: string]: unknown;
}

export type SystemNode = Node<SystemNodeData>;
export type SystemEdge = Edge<SystemEdgeData>;
