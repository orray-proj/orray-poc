import type { Edge, Node } from "@xyflow/react";

export type LayerId = "live" | "building" | "platform";

export type TimelineEventKind = "deployment" | "bug" | "proposal";

export interface TimelineEvent {
  affectedEdgeIds?: string[];
  affectedNodeIds: string[];
  description: string;
  id: string;
  kind: TimelineEventKind;
  severity?: "low" | "medium" | "high";
  timestamp: string;
  title: string;
}

export type NodeKind = "service" | "database" | "queue" | "gateway" | "cache";

export type HealthStatus =
  | "healthy"
  | "degraded"
  | "critical"
  | "warning"
  | "unknown";
export type DeploymentStatus = "running" | "deploying" | "failed" | "pending";

export interface TeamInfo {
  color: string;
  name: string;
}

export interface ServiceFeature {
  connectedNodeIds?: string[];
  description: string;
  id: string;
  name: string;
  status: HealthStatus;
  team: TeamInfo;
}

export interface TracingData {
  errorMessage?: string;
  latencyMs: number;
  spanId: string;
  status: "ok" | "error" | "warning";
  timestamp: string;
  traceId: string;
}

export interface BuildingData {
  description?: string;
  isDraft: boolean;
  proposedBy?: string;
  ticketId?: string;
}

export interface PlatformMetrics {
  cpu: number;
  deploymentStatus: DeploymentStatus;
  health: HealthStatus;
  lastDeploy: string;
  memory: number;
  pods: { ready: number; total: number };
  uptime: string;
  version: string;
}

export interface SystemNodeData {
  building?: BuildingData;
  description: string;
  features?: ServiceFeature[];
  kind: NodeKind;
  label: string;
  platform?: PlatformMetrics;
  team?: TeamInfo;

  tracing?: TracingData;

  [key: string]: unknown;
}

export interface SystemEdgeData {
  building?: {
    isDraft: boolean;
  };
  dataType?: string;
  label?: string;
  platform?: {
    requestsPerSec?: number;
    errorRate?: number;
    p99Latency?: number;
  };
  protocol?: string;
  /** Individual topic names for multi-topic connections (e.g. Kafka). */
  topics?: string[];

  tracing?: {
    active: boolean;
    latencyMs?: number;
    status: "ok" | "error" | "warning" | "inactive";
    throughput?: string;
  };

  [key: string]: unknown;
}

export interface GitBranch {
  color: string;
  mergeTimestamp?: string;
  name: string;
  originTimestamp?: string;
}

export interface GitCommit {
  author: string;
  branch: string;
  eventId?: string;
  message: string;
  serviceIds: string[];
  sha: string;
  timestamp: string;
}

export type SystemNode = Node<SystemNodeData>;
export type SystemEdge = Edge<SystemEdgeData>;
