export interface BusinessProfile {
  // Company half — canonical fields
  companyName?: string;
  industry?: string;
  website?: string;
  valueProposition?: string;
  productsServices?: string;
  targetCustomers?: string;
  contactEmail?: string;
  contactPhone?: string;
  personaName?: string;
  personaTitle?: string;
  bookingLink?: string;

  // ICP half — canonical fields
  companyDescription?: string;
  icpJobTitles?: string;
  icpCompanySize?: string;
  icpCompanySizeFrom?: string;
  icpCompanySizeTo?: string;
  icpDomainNiche?: string;
  icpLocations?: string;
  icpPainPoints?: string;
  icpDecisionDrivers?: string;
  icpTriggers?: string;
  sampleConversation?: string;
  operatingHours?: string;
  timezone?: string;
  geographicFocus?: string;
  competitors?: string;
  campaignTone?: string;
  toneAndVoice?: string;
  styleGuide?: string;
  dosAndDonts?: string;
  valueStatement?: string;
  caseStories?: string;
  compliantGuarantee?: string;

  // Company basics
  companyLocation?: string;
  companyLogoUrl?: string;

  // Offer (B2B)
  icpSegments?: string;
  costOfInaction?: string;
  discoveryQuestions?: string;
  deliveryProcess?: string;
  proofPoints?: string;
  notAGoodFit?: string;
  commonObjections?: string;
  differentiators?: string;
  guarantee?: string;
  uniqueExperience?: string;
  socialCredentials?: string;
  twelveMonthMetrics?: string;
  averageLifecycle?: string;
  revenueResults?: string;
  averageDealSize?: string;
  salesCycleTime?: string;
  idealBuyerCriteria?: string;

  [extraKey: string]: unknown;
}

export interface BusinessProfileCompleteness {
  filled: number;
  total: number;
  pct: number;
}

export const CANONICAL_REQUIRED_KEYS = [
  'companyName',
  'industry',
  'valueProposition',
  'productsServices',
  'targetCustomers',
  'companyDescription',
  'icpJobTitles',
  'icpDomainNiche',
  'icpLocations',
  'icpPainPoints',
  'icpDecisionDrivers',
  'icpTriggers',
  'icpCompanySizeFrom',
  'icpCompanySizeTo',
] as const;

export const OFFER_KEYS = [
  'uniqueExperience',
  'socialCredentials',
  'twelveMonthMetrics',
  'averageLifecycle',
  'revenueResults',
  'averageDealSize',
  'salesCycleTime',
  'idealBuyerCriteria',
  'commonObjections',
] as const;

export function computeProfileCompleteness(profile: BusinessProfile | null | undefined): BusinessProfileCompleteness {
  const total = 14;
  if (!profile) return { filled: 0, total, pct: 0 };
  
  let filled = 0;
  for (const key of CANONICAL_REQUIRED_KEYS) {
    const val = profile[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      filled += 1;
    }
  }
  
  const pct = Math.round((filled / total) * 100);
  return { filled, total, pct };
}

export function computeOfferCompleteness(profile: BusinessProfile | null | undefined): BusinessProfileCompleteness {
  const total = OFFER_KEYS.length;
  if (!profile) return { filled: 0, total, pct: 0 };

  let filled = 0;
  for (const key of OFFER_KEYS) {
    const val = profile[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      filled += 1;
    }
  }

  const pct = Math.round((filled / total) * 100);
  return { filled, total, pct };
}

export const DEFAULT_BUSINESS_PROFILES: Record<string, BusinessProfile> = {
  co1_seo: {
    companyName: "MR LAD",
    industry: "B2B, Lead Generation, Marketing Technology",
    website: "https://mrlad.ai",
    companyLocation: "LAD, UAE",
    valueProposition: "MR LAD is an AI-powered sales assistant for B2B outbound teams, turning cold outreach into warm leads with multi-channel personalization and intelligent prospect scoring.",
    productsServices: "AI Multi-Channel Sales Agent, Dynamic Proposal Automation, Lead Discovery & ICP Scoring, AI Email & LinkedIn Outreach.",
    targetCustomers: "B2B enterprise sales leaders, SDR teams, growth agencies, and B2B SaaS founders looking to scale qualified pipelines without adding headcount.",
    
    // Ideal Customer
    companyDescription: "Mid-market to enterprise B2B companies looking for automated outbound pipeline generation and high-converting personalized sales collateral.",
    icpJobTitles: "Founders, CXO, VP Sales, VP Marketing, Head of Growth, Managing Director",
    icpDomainNiche: "B2B SaaS, Professional Services, Technology, Marketing Agencies",
    icpLocations: "India, USA, UK, UAE, Singapore",
    icpPainPoints: "High customer acquisition costs, low response rates on generic cold outreach, manual proposal generation delays, inconsistent lead pipeline flow.",
    icpDecisionDrivers: "Speed to pipeline, predictable ROI, high personalization accuracy, automated closing workflows.",
    icpTriggers: "Hiring new SDRs, launching a new B2B product line, entering a new geo, missing quarterly pipeline targets.",
    icpCompanySizeFrom: "10",
    icpCompanySizeTo: "500+",

    // Outreach
    personaName: "Sneha",
    personaTitle: "Head of Growth",
    styleGuide: "Direct, professional, consultative, value-led",
    toneAndVoice: "Friendly, confident, low-jargon, executive-ready",
    dosAndDonts: "Do focus on ROI metrics and verified case proof. Don't use spammy sales buzzwords or aggressive follow-up tactics.",
    valueStatement: "Help B2B sales teams generate 3x more qualified meetings in 30 days with AI-driven discovery and automated proposals.",
    caseStories: "Helped over 150+ B2B agencies double their qualified discovery calls and reduce proposal preparation time from 4 hours to under 30 seconds.",
    compliantGuarantee: "100% money back guarantee if not satisfied within 14 days of activation.",
    competitors: "Apollo.io, Instantly.ai, Lemlist, Smartlead, PandaDoc",

    // Offer (B2B)
    uniqueExperience: "Over 8+ years building high-converting outbound pipelines and AI sales automation workflows for high-growth tech startups.",
    socialCredentials: "Featured in Forbes 30 Under 30, trusted by 500+ successful client deployments globally.",
    twelveMonthMetrics: "Average $450k net-new ARR added per client in the first 12 months of deployment.",
    averageLifecycle: "12 months with 94% retention rate and ongoing pipeline optimization.",
    revenueResults: "Generated over $18.5M in qualified sales pipeline across client accounts in the last 18 months.",
    averageDealSize: "$25,000 - $80,000 annual contract value.",
    salesCycleTime: "3 to 6 weeks from first touch to close.",
    idealBuyerCriteria: "B2B companies with 10-500 employees, minimum $1M ARR, and an active outbound sales focus.",
    commonObjections: "\"We already do cold email in-house\" -> Show how AI multi-channel increases response rates 4x and eliminates manual research.\n\"How fast to see results?\" -> First qualified leads booked within 7-10 days of campaign launch.",
  },

  co2_msp: {
    companyName: "Nexus Managed Cloud Services",
    industry: "Managed IT Services, Cloud Security, Cybersecurity",
    website: "https://nexus-msp.io",
    companyLocation: "Austin, TX, USA",
    valueProposition: "24/7 SOC monitoring, automated cloud compliance, and zero-trust perimeter defense for enterprise IT.",
    productsServices: "Managed IT Support, 24/7 SOC, Cloud Migration, Compliance Audits (SOC2 / HIPAA).",
    targetCustomers: "Mid-market healthcare, fintech, and legal enterprises with 50-500 seats requiring high-assurance cybersecurity.",
    
    companyDescription: "Healthcare and financial service firms managing regulated patient and transaction data.",
    icpJobTitles: "CIO, CTO, VP Information Security, IT Director, Compliance Officer",
    icpDomainNiche: "Healthtech, FinTech, LegalTech, Financial Advisory",
    icpLocations: "United States, Canada",
    icpPainPoints: "Ransomware vulnerabilities, meeting strict HIPAA/SOC2 compliance, internal IT team overwhelm.",
    icpDecisionDrivers: "Guaranteed SLA response under 15 minutes, full compliance audit readiness, 99.99% uptime.",
    icpTriggers: "Upcoming SOC2 audit, recent phishing attempt, migrating from on-prem to Azure.",
    icpCompanySizeFrom: "50",
    icpCompanySizeTo: "500",

    personaName: "David Miller",
    personaTitle: "Principal Security Architect",
    styleGuide: "Authoritative, technical, compliance-focused",
    toneAndVoice: "Professional, reassuring, precise",
    dosAndDonts: "Do highlight audit-ready log retention. Don't gloss over HIPAA compliance obligations.",
    valueStatement: "Eliminate downtime risks with sub-15 minute SLA response and 24/7 dedicated SOC coverage.",
    caseStories: "Prevented 14 ransomware intrusions across 40 healthcare clinics with zero operational downtime.",
    compliantGuarantee: "99.99% guaranteed uptime SLA with financial credit backing.",
    competitors: "Datadog Managed, CDW, Mindcore, ConnectWise",

    uniqueExperience: "12+ years deploying zero-trust frameworks across federally regulated clinical networks.",
    socialCredentials: "SOC2 Type II Certified, Microsoft Gold Security Partner, ISO 27001 accredited.",
    twelveMonthMetrics: "Zero security breaches across 35 managed healthcare systems in 24 months.",
    averageLifecycle: "36-month managed service agreements with 98% renewal rate.",
    revenueResults: "$3.2M saved in prevented ransomware ransoms and compliance violation penalties.",
    averageDealSize: "$45,000 - $120,000 per year.",
    salesCycleTime: "4 to 8 weeks.",
    idealBuyerCriteria: "US-based companies subject to HIPAA, SOC2, or PCI-DSS compliance regulations.",
    commonObjections: "\"We have an internal IT guy\" -> We partner with him to handle 24/7 off-hours monitoring so he can focus on core projects.",
  },

  co3_dev: {
    companyName: "Vortex Software Studio",
    industry: "Custom Software Engineering, Web3, AI Systems",
    website: "https://vortexstudio.dev",
    companyLocation: "London, UK",
    valueProposition: "High-velocity product engineering teams building high-scale cloud platforms and AI applications.",
    productsServices: "Dedicated Full-Stack Squads, AI Model Fine-Tuning, Mobile & Web App Development.",
    targetCustomers: "Funded Series A-C startups and scale-ups needing rapid feature velocity and top 1% engineering talent.",
    
    companyDescription: "Venture-backed technology startups scaling product engineering velocity.",
    icpJobTitles: "CTO, VP Engineering, Founder, Head of Product",
    icpDomainNiche: "B2B SaaS, AI/ML Startups, E-Commerce Infrastructure",
    icpLocations: "UK, Western Europe, North America",
    icpPainPoints: "Engineering hiring freezes, slow sprint velocity, legacy technical debt blocking roadmap.",
    icpDecisionDrivers: "Time-to-market speed, top tier code quality, transparent weekly sprint velocity.",
    icpTriggers: "Closing a Series A round, expanding into enterprise features, refactoring legacy architecture.",
    icpCompanySizeFrom: "20",
    icpCompanySizeTo: "200",

    personaName: "Alex Vance",
    personaTitle: "Lead Engineering Partner",
    styleGuide: "Modern, agile, technical excellence",
    toneAndVoice: "Pragmatic, developer-friendly, results-oriented",
    dosAndDonts: "Do discuss architecture patterns and CI/CD pipelines. Don't make unrealistic deadline promises without scoping.",
    valueStatement: "Deploy senior dedicated engineering squads in 7 business days with zero overhead.",
    caseStories: "Shipped an enterprise fintech platform in 90 days resulting in an $8M Series A fundraise.",
    compliantGuarantee: "2-week risk-free trial sprint. If not satisfied, pay nothing.",
    competitors: "Toptal, Turing, ThoughtWorks, EPAM",

    uniqueExperience: "Built and scaled 40+ products from zero to 1M+ daily active users.",
    socialCredentials: "AWS Advanced Consulting Partner, GitHub Verified Enterprise Partner.",
    twelveMonthMetrics: "Average 3.5x increase in sprint feature output for client engineering squads.",
    averageLifecycle: "18 months average squad engagement.",
    revenueResults: "Enabled clients to raise over $120M in venture funding on our engineered platforms.",
    averageDealSize: "$80,000 - $250,000 project contract.",
    salesCycleTime: "2 to 4 weeks.",
    idealBuyerCriteria: "Seed to Series B startups with committed development budget looking for dedicated squads.",
    commonObjections: "\"We prefer in-house hiring\" -> Our squads bridge the 6-month hiring gap immediately with no long-term equity or HR overhead.",
  }
};
