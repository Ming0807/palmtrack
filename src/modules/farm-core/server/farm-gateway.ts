import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CreateFarmInput,
  CreatePlotInput,
  DeleteFarmInput,
  DeletePlotInput,
  FarmSummary,
  PlotSummary,
  UpdateFarmInput,
  UpdatePlotInput,
} from "../domain/farm-model";
import { parseDecimal } from "../domain/decimal";

function requireCanonicalDecimal(value: string, precision: number): string {
  const parsed = parseDecimal(value, precision);
  if (parsed === null) {
    throw new Error("database returned a non-canonical decimal value");
  }
  return parsed;
}

export type FarmGateway = {
  ensureFarmerProfile(input?: { fullName?: string; phoneNumber?: string }): Promise<string>;
  listFarms(): Promise<FarmSummary[]>;
  createFarm(input: CreateFarmInput): Promise<string>;
  updateFarm(input: UpdateFarmInput): Promise<void>;
  softDeleteFarm(input: DeleteFarmInput): Promise<void>;
  listPlots(farmId: string): Promise<PlotSummary[]>;
  createPlot(input: CreatePlotInput): Promise<string>;
  updatePlot(input: UpdatePlotInput): Promise<void>;
  softDeletePlot(input: DeletePlotInput): Promise<void>;
};

export function createSupabaseFarmGateway(client: SupabaseClient): FarmGateway {
  return {
    async ensureFarmerProfile(input) {
      const { data, error } = await client.rpc("ensure_farmer_profile", {
        p_full_name: input?.fullName ?? null,
        p_phone_number: input?.phoneNumber ?? null,
      });
      if (error) throw error;
      return data as string;
    },

    async listFarms() {
      const { data, error } = await client.rpc("list_my_farms");
      if (error) throw error;
      return (data ?? []).map((row: {
        id: string;
        farmer_id: string;
        name: string;
        location_label: string | null;
        total_area: string;
        plot_count: number;
        created_at: string;
      }) => ({
        id: row.id,
        farmerId: row.farmer_id,
        name: row.name,
        locationLabel: row.location_label,
        totalArea: requireCanonicalDecimal(row.total_area, 3),
        plotCount: row.plot_count,
        createdAt: row.created_at,
      }));
    },

    async createFarm(input) {
      const { data, error } = await client.rpc("create_farm", {
        p_name: input.name,
        p_location_label: input.locationLabel ?? null,
        p_total_area: input.totalArea,
      });
      if (error) throw error;
      return data as string;
    },

    async updateFarm(input) {
      const { error } = await client.rpc("update_farm", {
        p_farm_id: input.farmId,
        p_name: input.name,
        p_location_label: input.locationLabel ?? null,
        p_total_area: input.totalArea,
      });
      if (error) throw error;
    },

    async softDeleteFarm(input) {
      const { error } = await client.rpc("soft_delete_farm", {
        p_farm_id: input.farmId,
        p_reason: input.reason,
      });
      if (error) throw error;
    },

    async listPlots(farmId) {
      const { data, error } = await client.rpc("list_my_plots", {
        p_farm_id: farmId,
      });
      if (error) throw error;
      return (data ?? []).map((row: {
        id: string;
        farm_id: string;
        code: string;
        name: string;
        area: string;
        created_at: string;
      }) => ({
        id: row.id,
        farmId: row.farm_id,
        code: row.code,
        name: row.name,
        area: requireCanonicalDecimal(row.area, 3),
        createdAt: row.created_at,
      }));
    },

    async createPlot(input) {
      const { data, error } = await client.rpc("create_plot", {
        p_farm_id: input.farmId,
        p_code: input.code,
        p_name: input.name,
        p_area: input.area,
      });
      if (error) throw error;
      return data as string;
    },

    async updatePlot(input) {
      const { error } = await client.rpc("update_plot", {
        p_plot_id: input.plotId,
        p_code: input.code,
        p_name: input.name,
        p_area: input.area,
      });
      if (error) throw error;
    },

    async softDeletePlot(input) {
      const { error } = await client.rpc("soft_delete_plot", {
        p_plot_id: input.plotId,
        p_reason: input.reason,
      });
      if (error) throw error;
    },
  };
}
