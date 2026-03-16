import type { ReactNode } from "react";
import { GatewayProviderClient } from "./client";
import { getActiveProviderState, getAvailableProviderStates } from "./state";

interface GatewayProviderProps {
  children: ReactNode;
}

export const GatewayProvider = async ({ children }: GatewayProviderProps) => {
  const activeProvider = getActiveProviderState();
  const textModels = await activeProvider.getTextModels();
  const providers = getAvailableProviderStates().map((provider) => provider.id);

  return (
    <GatewayProviderClient activeProvider={activeProvider.id} models={textModels} providers={providers}>
      {children}
    </GatewayProviderClient>
  );
};

