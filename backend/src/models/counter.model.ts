import { model, Schema } from "mongoose";
import { ICounter } from "../interfaces/counter.interface";

// No mongooseOptions/softDeleteDefinition here on purpose — see ICounter's comment:
// this is atomic-sequence infrastructure, never returned via the API, not a business entity.
const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 0 },
});

export const CounterModel = model<ICounter>("Counter", counterSchema);
