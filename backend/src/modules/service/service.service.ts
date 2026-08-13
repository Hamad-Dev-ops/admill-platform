import { AppError } from "../../errors/AppError";
import { CounterRepository } from "../../repositories/counter.repository";
import { ServiceRepository } from "../../repositories/service.repository";
import { generateBusinessId } from "../../utils/schema/generateBusinessId";
import { CreateServiceInput } from "./service.validator";

export const ServiceService = {
  async create(input: CreateServiceInput) {
    const existing = await ServiceRepository.findByType(input.serviceType);

    if (existing) {
      throw new AppError(409, "A service catalog entry for this service type already exists");
    }

    const sequence = await CounterRepository.incrementAndGet("service");
    const serviceCode = generateBusinessId("SVC", sequence);

    return ServiceRepository.create({ ...input, serviceCode });
  },

  async listAll() {
    return ServiceRepository.findAll();
  },
};
