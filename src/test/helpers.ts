import { ModelStatus } from "../modules/adapters/baseAdapter.js";

export type TestModel = {
  id: number;
  provider: string;
  modelId: string;
  status: ModelStatus;
  lastVerified: string | null;
  metadata: string | null;
  deprecationDate: string | null;
  sunsetDate: string | null;
};
