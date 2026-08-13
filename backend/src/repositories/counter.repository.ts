import { CounterModel } from "../models/counter.model";

export const CounterRepository = {
  async incrementAndGet(sequenceName: string): Promise<number> {
    const counter = await CounterModel.findByIdAndUpdate(
      sequenceName,
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" }
    );

    // upsert + returnDocument:"after" guarantees a document is always returned here;
    // the `!` reflects that runtime guarantee, which the return type can't express.
    return counter!.value;
  },
};
