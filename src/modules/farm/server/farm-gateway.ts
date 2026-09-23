import { z } from "zod";

export type FarmReceipt = {
  id: string;
  name: string;
  areaRai: number;
  createdAt: string;
};

export type FarmInput = {
  name: string;
  areaRai: number;
};

export interface FarmGateway {
  createFarm(input: FarmInput): Promise<FarmReceipt>;
  listFarms(): Promise<FarmReceipt[]>;
  deleteFarm(id: string, reason: string): Promise<{ id: string }>;
}

export class FarmGatewayError extends Error {
  constructor(readonly code: "CONFLICT" | "UNAVAILABLE") {
    super("farm gateway failed");
    this.name = "FarmGatewayError";
  }
}

export const farmRowSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(120),
  area_rai: z.number().positive(),
  created_at: z.iso.datetime({ offset: true }),
});

export function mapFarmRow(row: z.infer<typeof farmRowSchema>): FarmReceipt {
  return {
    id: row.id,
    name: row.name,
    areaRai: row.area_rai,
    createdAt: row.created_at,
  };
}

export function rpcError(error: { code?: string } | null): never {
  throw new FarmGatewayError(
    error?.code === "23505" || error?.code === "40001" ? "CONFLICT" : "UNAVAILABLE",
  );
}
