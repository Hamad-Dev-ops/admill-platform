import { Types } from "mongoose";
import { AppError } from "../../errors/AppError";
import { CounterRepository } from "../../repositories/counter.repository";
import { CustomerRepository } from "../../repositories/customer.repository";
import { generateBusinessId } from "../../utils/schema/generateBusinessId";
import { RegisterCustomerInput, UpdateCustomerInput } from "./customer.validator";

export const CustomerService = {
  async register(userId: string, input: RegisterCustomerInput) {
    const existing = await CustomerRepository.findByUserId(userId);

    if (existing) {
      throw new AppError(409, "You already have a customer profile");
    }

    const sequence = await CounterRepository.incrementAndGet("customer");
    const customerCode = generateBusinessId("CUS", sequence);

    return CustomerRepository.create({
      customerCode,
      userId: new Types.ObjectId(userId),
      nationalId: input.nationalId,
      address: input.address,
    });
  },

  // Decision #4/§3.3: any endpoint returning a customer profile populates identity
  // from User rather than exposing/duplicating it on Customer.
  async getMyProfile(userId: string) {
    const customer = await CustomerRepository.findByUserId(userId);

    if (!customer) {
      throw new AppError(404, "Customer profile not found");
    }

    const populated = await CustomerRepository.findByIdWithIdentity(customer._id);

    if (!populated) {
      throw new AppError(404, "Customer profile not found");
    }

    return populated;
  },

  async updateMyProfile(userId: string, input: UpdateCustomerInput) {
    const customer = await CustomerRepository.findByUserId(userId);

    if (!customer) {
      throw new AppError(404, "Customer profile not found");
    }

    const updated = await CustomerRepository.updateById(customer._id, input);

    if (!updated) {
      throw new AppError(404, "Customer profile not found");
    }

    const populated = await CustomerRepository.findByIdWithIdentity(customer._id);

    if (!populated) {
      throw new AppError(404, "Customer profile not found");
    }

    return populated;
  },
};
