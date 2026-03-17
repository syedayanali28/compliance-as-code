"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { NodeButton } from "@/modules/workflow-canvas/lib/node-buttons";
import type { RuntimePolicyCatalog } from "@/modules/workflow-canvas/lib/policy-catalog";

interface NodeOperationsContextType {
  addNode: (type: string, options?: Record<string, unknown>) => string;
  duplicateNode: (id: string) => void;
  activeZoneId?: string;
  setActiveZoneId: (zoneId?: string) => void;
  nodeButtons: NodeButton[];
  policyCatalog: RuntimePolicyCatalog;
}

const NodeOperationsContext = createContext<NodeOperationsContextType | null>(
  null
);

export const useNodeOperations = () => {
  const context = useContext(NodeOperationsContext);
  if (!context) {
    throw new Error(
      "useNodeOperations must be used within a NodeOperationsProvider"
    );
  }
  return context;
};

interface NodeOperationsProviderProps {
  addNode: (type: string, options?: Record<string, unknown>) => string;
  duplicateNode: (id: string) => void;
  activeZoneId?: string;
  setActiveZoneId: (zoneId?: string) => void;
  nodeButtons: NodeButton[];
  policyCatalog: RuntimePolicyCatalog;
  children: ReactNode;
}

export const NodeOperationsProvider = ({
  addNode,
  duplicateNode,
  activeZoneId,
  setActiveZoneId,
  nodeButtons,
  policyCatalog,
  children,
}: NodeOperationsProviderProps) => (
  <NodeOperationsContext.Provider
    value={{
      addNode,
      duplicateNode,
      activeZoneId,
      setActiveZoneId,
      nodeButtons,
      policyCatalog,
    }}
  >
    {children}
  </NodeOperationsContext.Provider>
);

