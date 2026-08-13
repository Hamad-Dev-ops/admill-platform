import { Types } from "mongoose";
import { AppError } from "../../errors/AppError";
import { CompanyRepository } from "../../repositories/company.repository";
import { CompanySettingsRepository } from "../../repositories/companySettings.repository";
import { CounterRepository } from "../../repositories/counter.repository";
import { generateBusinessId } from "../../utils/schema/generateBusinessId";
import { CreateCompanyInput, UpdateCompanyInput, UpdateCompanySettingsInput } from "./company.validator";

export const CompanyService = {
  async createCompany(ownerId: string, input: CreateCompanyInput) {
    const existing = await CompanyRepository.findByOwnerId(ownerId);

    if (existing) {
      throw new AppError(409, "You already have a company registered");
    }

    const sequence = await CounterRepository.incrementAndGet("company");
    const companyCode = generateBusinessId("CMP", sequence);

    const company = await CompanyRepository.create({
      ...input,
      companyCode,
      ownerId: new Types.ObjectId(ownerId),
    });

    await CompanySettingsRepository.create(company._id);

    return company;
  },

  async getMyCompany(ownerId: string) {
    const company = await CompanyRepository.findByOwnerId(ownerId);

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    return company;
  },

  async updateMyCompany(ownerId: string, input: UpdateCompanyInput) {
    const company = await CompanyRepository.updateByOwnerId(ownerId, input);

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    return company;
  },

  async getMySettings(ownerId: string) {
    const company = await CompanyRepository.findByOwnerId(ownerId);

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    const settings = await CompanySettingsRepository.findByCompanyId(company._id);

    if (!settings) {
      throw new AppError(404, "Company settings not found");
    }

    return settings;
  },

  async updateMySettings(ownerId: string, input: UpdateCompanySettingsInput) {
    const company = await CompanyRepository.findByOwnerId(ownerId);

    if (!company) {
      throw new AppError(404, "Company not found");
    }

    const settings = await CompanySettingsRepository.updateByCompanyId(company._id, input);

    if (!settings) {
      throw new AppError(404, "Company settings not found");
    }

    return settings;
  },

  async lookupByCode(companyCode: string) {
    const company = await CompanyRepository.findByCompanyCode(companyCode);

    if (!company) {
      throw new AppError(404, "No company found for this code");
    }

    return {
      companyCode: company.companyCode,
      companyName: company.companyName,
      logo: company.logo,
      city: company.city,
    };
  },

  /**
   * Shared cross-module ownership check: does this user own the company that owns
   * `companyId`? Used by driver/vehicle/document services so "is this owner allowed to
   * touch this specific record" logic lives in one place, not duplicated per module.
   */
  async assertOwnerOwnsCompany(ownerId: string, companyId: Types.ObjectId): Promise<void> {
    const company = await CompanyRepository.findByOwnerId(ownerId);

    if (!company || !company._id.equals(companyId)) {
      throw new AppError(403, "You do not have permission to access this resource");
    }
  },
};
