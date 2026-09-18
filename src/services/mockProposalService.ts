import { MOCK_COMPANIES_DATA, type CompanyMockPackage } from "./mockData";
import type { Company, CompanySummary } from "../types/company";
import type { CompanyVariable, CompoundTable } from "../types/variable";
import type { TemplateStats } from "../types/template";
import type { PricingRules, PricingRulesState, Evaluation, SampleCheckEntry } from "../types/pricing";
import type { InboundLeadSimulation } from "../types/proposal";
import type { ProposalReceipt } from "../types/receipt";

class MockProposalService {
  private data: Record<string, CompanyMockPackage> = { ...MOCK_COMPANIES_DATA };

  public getCompanySummaries(): CompanySummary[] {
    return Object.values(this.data).map((pkg) => ({
      company_id: pkg.company.company_id,
      company_name: pkg.company.company_name,
      location: pkg.company.location,
      industry: pkg.company.industry,
      email: pkg.company.email,
      website: pkg.company.website,
      phone: pkg.company.phone,
      pricing_spec: pkg.company.pricing_spec,
      briefing_locked: pkg.company.briefing_locked,
      quotation_filename: pkg.company.document_metadata?.filename || null,
      updated_at: pkg.company.updated_at,
      created_at: pkg.company.created_at,
    }));
  }

  public getCompany(companyId: string): Company {
    const pkg = this.data[companyId] || this.data["co1_seo"];
    return pkg.company;
  }

  public getVariables(companyId: string): { variables: CompanyVariable[]; compound_tables: CompoundTable[] } {
    const pkg = this.data[companyId] || this.data["co1_seo"];
    return {
      variables: pkg.variables,
      compound_tables: pkg.compoundTables,
    };
  }

  public getTemplateStats(companyId: string): TemplateStats | null {
    const pkg = this.data[companyId] || this.data["co1_seo"];
    return pkg.templateStats;
  }

  public getPricingRules(companyId: string): PricingRulesState {
    const pkg = this.data[companyId] || this.data["co1_seo"];
    return {
      rules: pkg.pricingRules,
      compiled_at: new Date().toISOString(),
      validation_errors: [],
      sample_check: this.buildSampleCheck(pkg),
      evaluation: this.evaluatePricing(pkg.pricingRules),
    };
  }

  public getLeadSimulation(companyId: string): InboundLeadSimulation {
    const pkg = this.data[companyId] || this.data["co1_seo"];
    return pkg.leadSimulation;
  }

  public getReceipt(companyId: string): ProposalReceipt {
    const pkg = this.data[companyId] || this.data["co1_seo"];
    return pkg.receipt;
  }

  public updateVariable(companyId: string, variableId: string, patch: Partial<CompanyVariable>): CompanyVariable[] {
    const pkg = this.data[companyId] || this.data["co1_seo"];
    pkg.variables = pkg.variables.map((v) => (v.id === variableId ? { ...v, ...patch } : v));
    return pkg.variables;
  }

  public updatePricingTable(companyId: string, tableId: string, updatedRows: any[]): PricingRulesState {
    const pkg = this.data[companyId] || this.data["co1_seo"];
    pkg.pricingRules.tables = pkg.pricingRules.tables.map((t) =>
      t.id === tableId ? { ...t, rows: updatedRows } : t
    );
    return this.getPricingRules(companyId);
  }

  public evaluatePricing(rules: PricingRules): Evaluation {
    const values: Record<string, any> = {};
    const present: Record<string, boolean> = {};

    // Seed sample inputs
    Object.entries(rules.sample_inputs || {}).forEach(([k, v]) => {
      values[k] = v;
      present[k] = true;
    });

    // Evaluate rules
    rules.variables.forEach((v) => {
      if (v.kind === "constant") {
        values[v.name] = v.value;
      } else if (v.kind === "condition") {
        const passed = v.all.every((c) => {
          const val = values[c.var];
          if (c.op === "eq") return val === c.value;
          if (c.op === "gt") return Number(val) > Number(c.value);
          return false;
        });
        values[v.name] = passed;
      } else if (v.kind === "lookup") {
        const table = rules.tables.find((t) => t.id === v.table);
        if (table) {
          const matchRow = table.rows.find((row) => {
            return v.where.every((w) => {
              const compVal = w.value_var ? values[w.value_var] : w.value;
              const cellVal = row[w.column];
              if (w.op === "gte") return cellVal === null || Number(cellVal) >= Number(compVal);
              if (w.op === "lte") return cellVal === null || Number(cellVal) <= Number(compVal);
              if (w.op === "eq") return String(cellVal).toLowerCase() === String(compVal).toLowerCase();
              return true;
            });
          });
          values[v.name] = matchRow ? matchRow[v.take] : null;
        }
      } else if (v.kind === "formula") {
        if (v.op === "mul") {
          const total = v.args.reduce<number>((acc, arg) => {
            const num = typeof arg === "number" ? arg : Number(values[arg] ?? 1);
            return acc * (isNaN(num) ? 1 : num);
          }, 1);
          values[v.name] = total;
        } else if (v.op === "sub") {
          const a = Number(values[v.args[0]] ?? 0);
          const b = Number(values[v.args[1]] ?? 0);
          values[v.name] = a - b;
        } else if (v.op === "add") {
          const total = v.args.reduce<number>((acc, arg) => {
            const num = typeof arg === "number" ? arg : Number(values[arg] ?? 0);
            return acc + (isNaN(num) ? 0 : num);
          }, 0);
          values[v.name] = total;
        } else if (v.op === "max") {
          const nums = v.args.map((a) => (typeof a === "number" ? a : Number(values[a] ?? 0)));
          values[v.name] = Math.max(...nums);
        }
      }
      present[v.name] = true;
    });

    return {
      values,
      present,
      needs_review: [],
      order: rules.variables.map((v) => v.name),
    };
  }

  private buildSampleCheck(pkg: CompanyMockPackage): SampleCheckEntry[] {
    const checks: SampleCheckEntry[] = [];
    const evaluation = this.evaluatePricing(pkg.pricingRules);

    pkg.pricingRules.variables
      .filter((v) => v.in_document)
      .forEach((v) => {
        const val = evaluation.values[v.name];
        let computedStr = String(val ?? "");
        if (v.unit === "money" && typeof val === "number") {
          computedStr = `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (v.unit === "percent" && typeof val === "number") {
          computedStr = `${(val * 100).toFixed(2)}%`;
        }

        const matchVar = pkg.variables.find((x) => x.variable_name === v.name);
        const expected = matchVar?.descriptor?.sample_value || computedStr;

        checks.push({
          name: v.name,
          computed: computedStr,
          expected: expected,
          ok: true,
        });
      });

    return checks;
  }
}

export const mockProposalService = new MockProposalService();

