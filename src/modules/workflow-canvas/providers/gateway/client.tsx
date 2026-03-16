"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import {
  providers,
  type TersaModel,
  type TersaProvider,
} from "@/modules/workflow-canvas/lib/providers";
import type { WorkflowTextModelEntry } from "./state";

export type PriceBracket = "lowest" | "low" | "high" | "highest";

type TersaTextModel = TersaModel & {
  providers: (TersaProvider & {
    model: string;
    getCost: ({ input, output }: { input: number; output: number }) => number;
  })[];
};

interface GatewayProviderClientProps {
  children: ReactNode;
  models: WorkflowTextModelEntry[];
  activeProvider: string;
  providers: string[];
}

interface GatewayContextType {
  models: Record<string, TersaTextModel>;
  activeProvider: string;
  providers: string[];
}

const GatewayContext = createContext<GatewayContextType | undefined>(undefined);

export const useGateway = () => {
  const context = useContext(GatewayContext);

  if (!context) {
    throw new Error("useGateway must be used within a GatewayProviderClient");
  }

  return context;
};

/**
 * Determines price indicator based on statistical distribution of model costs
 * @param totalCost - The total cost (input + output) for the model
 * @param allCosts - Array of all model costs for comparison
 * @returns PriceBracket or undefined if relatively on par
 */
const getPriceIndicator = (
  totalCost: number,
  allCosts: number[]
): "lowest" | "low" | "high" | "highest" | undefined => {
  if (allCosts.length < 2) {
    return;
  }

  // Sort costs to calculate percentiles
  const sortedCosts = [...allCosts].sort((a, b) => a - b);
  const length = sortedCosts.length;

  // Calculate percentile thresholds
  const p20 = sortedCosts[Math.floor(length * 0.2)];
  const p40 = sortedCosts[Math.floor(length * 0.4)];
  const p60 = sortedCosts[Math.floor(length * 0.6)];
  const p80 = sortedCosts[Math.floor(length * 0.8)];

  // Determine price bracket based on percentiles
  if (totalCost <= p20) {
    return "lowest";
  }
  if (totalCost <= p40) {
    return "low";
  }
  if (totalCost >= p80) {
    return "highest";
  }
  if (totalCost >= p60) {
    return "high";
  }

  // If between p40 and p60 (middle 20%), it's relatively on par
  return undefined;
};

const buildTextModels = (models: WorkflowTextModelEntry[]) => {
  const textModels: Record<string, TersaTextModel> = {};

  const allCosts = models.map((model) => {
    const inputPrice = model.pricing?.input
      ? Number.parseFloat(model.pricing.input)
      : 0;
    const outputPrice = model.pricing?.output
      ? Number.parseFloat(model.pricing.output)
      : 0;
    return inputPrice + outputPrice;
  });

  for (const model of models) {
    const [chef] = model.id.split("/");
    const inputPrice = model.pricing?.input
      ? Number.parseFloat(model.pricing.input)
      : 0;
    const outputPrice = model.pricing?.output
      ? Number.parseFloat(model.pricing.output)
      : 0;

    let realChef = providers.unknown;
    let realProvider = providers.unknown;

    if (model.provider in providers) {
      realProvider =
        providers[model.provider as keyof typeof providers];
      realChef = realProvider;
    } else if (chef in providers) {
      realChef = providers[chef as keyof typeof providers];
    }

    const totalCost = inputPrice + outputPrice;

    textModels[model.id] = {
      label: model.name,
      chef: realChef,
      providers: [
        {
          ...realProvider,
          model: model.id,
          getCost: ({ input, output }: { input: number; output: number }) =>
            inputPrice * input + outputPrice * output,
        },
      ],
      priceIndicator: getPriceIndicator(totalCost, allCosts),
      default: model.default,
      disabled: model.disabled,
    };
  }

  return textModels;
};

export const GatewayProviderClient = ({
  children,
  models,
  activeProvider,
  providers: availableProviders,
}: GatewayProviderClientProps) => {
  const textModels = buildTextModels(models);
  const contextValue = useMemo(
    () => ({
      models: textModels,
      activeProvider,
      providers: availableProviders,
    }),
    [activeProvider, availableProviders, textModels]
  );

  return (
    <GatewayContext.Provider value={contextValue}>
      {children}
    </GatewayContext.Provider>
  );
};

