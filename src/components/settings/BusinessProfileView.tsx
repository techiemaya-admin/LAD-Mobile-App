import React, { useState, useEffect } from "react";
import {
  Target,
  Building2,
  MapPin,
  Upload,
  Sparkles,
  Save,
  CheckCircle2,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  type BusinessProfile,
  computeProfileCompleteness,
  computeOfferCompleteness,
  DEFAULT_BUSINESS_PROFILES,
} from "../../types/businessProfile";
import { AiAutoFillModal } from "./AiAutoFillModal";

interface BusinessProfileViewProps {
  companyId: string;
  onSaveNotification?: (message: string) => void;
}

export const BusinessProfileView: React.FC<BusinessProfileViewProps> = ({
  companyId,
  onSaveNotification,
}) => {
  const initialProfile = DEFAULT_BUSINESS_PROFILES[companyId] || DEFAULT_BUSINESS_PROFILES["co1_seo"];
  const [profile, setProfile] = useState<BusinessProfile>(initialProfile);
  const [locationInput, setLocationInput] = useState<string>(initialProfile.companyLocation || "LAD, UAE");
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [locationSaved, setLocationSaved] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Sync profile when companyId changes
  useEffect(() => {
    const next = DEFAULT_BUSINESS_PROFILES[companyId] || DEFAULT_BUSINESS_PROFILES["co1_seo"];
    setProfile(next);
    setLocationInput(next.companyLocation || "LAD, UAE");
    setSavedAt(null);
    setLocationSaved(false);
  }, [companyId]);

  const completeness = computeProfileCompleteness(profile);
  const offerCompleteness = computeOfferCompleteness(profile);

  const updateField = (key: keyof BusinessProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSavedAt(null);
  };

  const handleSaveLocation = () => {
    setProfile((prev) => ({ ...prev, companyLocation: locationInput }));
    setLocationSaved(true);
    setTimeout(() => setLocationSaved(false), 2500);
    onSaveNotification?.("Company location updated successfully.");
  };

  const handleGlobalSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSavedAt(Date.now());
      onSaveNotification?.(`Business Profile for ${profile.companyName || "Company"} saved.`);
    }, 600);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
      setProfile((prev) => ({ ...prev, companyLogoUrl: url }));
      onSaveNotification?.("Company logo uploaded successfully.");
    }
  };

  const handleApplyAiData = (data: Record<string, string>) => {
    setProfile((prev) => ({ ...prev, ...data }));
    setLocationInput(data.companyLocation || locationInput);
    setSavedAt(Date.now());
    onSaveNotification?.("AI Auto-fill applied 14 business signals successfully!");
  };

  const inputClasses =
    "w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-blue-900/40 bg-white dark:bg-[#14233a] text-xs text-slate-900 dark:text-[#E0E0E0] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#0B1957] dark:focus:ring-[#2B7CFF] transition-colors";

  const textareaClasses =
    "w-full p-3 rounded-xl border border-slate-200 dark:border-blue-900/40 bg-white dark:bg-[#14233a] text-xs text-slate-900 dark:text-[#E0E0E0] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#0B1957] dark:focus:ring-[#2B7CFF] resize-none leading-relaxed transition-colors";

  const labelClasses = "text-xs font-semibold text-slate-900 dark:text-slate-200";
  const hintClasses = "text-[11.5px] text-slate-500 dark:text-slate-400";
  const optionalBadgeClasses =
    "text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#14233a] px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-blue-900/30";

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Header Banner Card */}
      <div className="bg-white dark:bg-[#1A2A43] rounded-2xl border border-slate-200/80 dark:border-blue-950/50 p-6 shadow-xs transition-colors">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="size-11 rounded-2xl grid place-items-center bg-blue-50 dark:bg-[#0B1957] border border-blue-200 dark:border-[#2B7CFF]/40 text-[#0B1957] dark:text-[#2B7CFF] shrink-0 shadow-xs">
              <Target className="size-5.5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-slate-900 dark:text-slate-100 text-lg font-bold tracking-tight">
                  Business Profile
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-[#2B7CFF]/15 text-[#0B1957] dark:text-[#2B7CFF] rounded-md border border-blue-200 dark:border-[#2B7CFF]/30">
                  Active Blueprint
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs font-normal mt-1 max-w-2xl leading-relaxed">
                The 11 factor data power AI discovery, lead scoring, and messaging personalization. The AI read this daily, and anything here whenever your position/topic changes.
              </p>
            </div>
          </div>

          {/* Profile Completeness Badge */}
          <div className="md:text-right shrink-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              Profile completeness
            </div>
            <div
              className={`text-base font-bold font-mono tracking-tight mt-0.5 ${
                completeness.pct >= 70
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-[#0B1957] dark:text-[#2B7CFF]"
              }`}
            >
              {completeness.pct}% ({completeness.filled}/{completeness.total})
            </div>
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-[#14233a] overflow-hidden border border-slate-200/60 dark:border-blue-900/30">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${completeness.pct}%`,
              background:
                completeness.pct >= 70
                  ? "linear-gradient(90deg, #10b981, #059669)"
                  : "linear-gradient(90deg, #0B1957, #2B7CFF)",
            }}
          />
        </div>
      </div>

      {/* 2. Company Index Card */}
      <div className="bg-white dark:bg-[#1A2A43] rounded-2xl border border-slate-200/80 dark:border-blue-950/50 p-6 shadow-xs space-y-5 transition-colors">
        <div>
          <h3 className="text-slate-900 dark:text-slate-100 text-base font-bold flex items-center gap-2">
            <Building2 className="size-4.5 text-[#0B1957] dark:text-[#2B7CFF]" />
            Company Index
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Key information identifying your company
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Company Logo Sub-block */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50/80 dark:bg-[#14233a]/60 border border-slate-200 dark:border-blue-900/30">
            <div className="size-14 rounded-full overflow-hidden bg-white dark:bg-[#0B1957] border-2 border-slate-200 dark:border-[#2B7CFF]/40 grid place-items-center shrink-0 shadow-xs">
              {logoPreview || profile.companyLogoUrl ? (
                <img
                  src={logoPreview || profile.companyLogoUrl}
                  alt="Company logo"
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-[#0B1957] dark:text-[#2B7CFF] font-black text-base">Mrl</span>
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-200 block mb-1">
                Company logo
              </span>
              <label className="inline-flex items-center gap-1.5 px-3 h-8.5 rounded-xl border border-slate-200 dark:border-blue-900/40 bg-white dark:bg-[#1A2A43] text-xs font-semibold text-[#0B1957] dark:text-[#2B7CFF] hover:bg-slate-100 dark:hover:bg-[#2B7CFF]/15 transition cursor-pointer">
                <Upload className="size-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
              </label>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                PNG or JPG, up to 2MB.
              </span>
            </div>
          </div>

          {/* Company Location Sub-block */}
          <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-[#14233a]/60 border border-slate-200 dark:border-blue-900/30 flex flex-col justify-between h-full">
            <div>
              <label className="text-xs font-bold text-slate-900 dark:text-slate-200 inline-flex items-center gap-1.5">
                <MapPin className="size-3.5 text-[#0B1957] dark:text-[#2B7CFF]" /> Company location
              </label>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Where your business is based.
              </span>
            </div>
            <div className="pt-2.5 flex gap-2">
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                placeholder="LAD, UAE"
                className="flex-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-blue-900/40 bg-white dark:bg-[#14233a] text-xs text-slate-900 dark:text-[#E0E0E0] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-[#0B1957] dark:focus:ring-[#2B7CFF]"
              />
              <Button
                size="sm"
                onClick={handleSaveLocation}
                className="h-9 px-4 rounded-xl text-xs font-semibold bg-[#0B1957] dark:bg-[#2B7CFF] hover:bg-[#0B1957]/90 dark:hover:bg-[#2563eb] text-white shadow-xs"
              >
                {locationSaved ? "Saved" : "Save"}
              </Button>
            </div>
          </div>
        </div>

        {/* Auto-fill with AI Banner */}
        <div className="rounded-xl border border-blue-200 dark:border-[#2B7CFF]/30 bg-blue-50/70 dark:bg-[#0B1957]/50 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="size-8.5 rounded-lg bg-blue-100 dark:bg-[#2B7CFF]/20 border border-blue-200 dark:border-[#2B7CFF]/50 grid place-items-center text-[#0B1957] dark:text-[#2B7CFF] shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Auto-fill with AI</h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Automatically fill fields by analyzing your website or LinkedIn profile
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setIsAiModalOpen(true)}
            className="h-8.5 px-4 text-xs font-semibold text-[#0B1957] dark:text-[#2B7CFF] bg-white dark:bg-[#1A2A43] border border-blue-200 dark:border-[#2B7CFF]/50 hover:bg-blue-50 dark:hover:bg-[#2B7CFF]/20 rounded-xl whitespace-nowrap shadow-2xs"
          >
            <Sparkles className="size-3 mr-1.5 text-[#0B1957] dark:text-[#2B7CFF]" />
            <span>Fill</span>
          </Button>
        </div>
      </div>

      {/* 3. Company Section Card */}
      <div className="bg-white dark:bg-[#1A2A43] rounded-2xl border border-slate-200/80 dark:border-blue-950/50 p-6 shadow-xs space-y-4 transition-colors">
        <div>
          <h3 className="text-slate-900 dark:text-slate-100 text-base font-bold">Company</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Analyze what the company does for messaging and conversation
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Company Name */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Company name</label>
            <input
              type="text"
              value={profile.companyName || ""}
              onChange={(e) => updateField("companyName", e.target.value)}
              placeholder="MR LAD"
              className={inputClasses}
            />
          </div>

          {/* Industry */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5`}>Industry</label>
            <span className={`${hintClasses} mb-1`}>
              Comma-separate if you serve multiple.
            </span>
            <input
              type="text"
              value={profile.industry || ""}
              onChange={(e) => updateField("industry", e.target.value)}
              placeholder="B2B, Lead Generation, Marketing Technology"
              className={inputClasses}
            />
          </div>

          {/* Value Proposition */}
          <div className="sm:col-span-2 flex flex-col">
            <label className={`${labelClasses} mb-1`}>Value proposition</label>
            <textarea
              rows={3}
              value={profile.valueProposition || ""}
              onChange={(e) => updateField("valueProposition", e.target.value)}
              placeholder="MR LAD is an AI sales assistant for B2B outbound teams..."
              className={textareaClasses}
            />
          </div>

          {/* Products & Services */}
          <div className="sm:col-span-2 flex flex-col">
            <label className={`${labelClasses} mb-0.5`}>Products & services</label>
            <span className={`${hintClasses} mb-1`}>
              What the prospect actually buys.
            </span>
            <textarea
              rows={2}
              value={profile.productsServices || ""}
              onChange={(e) => updateField("productsServices", e.target.value)}
              placeholder="AI Multi-Channel Sales Agent, Dynamic Proposals..."
              className={textareaClasses}
            />
          </div>

          {/* Target Customers */}
          <div className="sm:col-span-2 flex flex-col">
            <label className={`${labelClasses} mb-0.5`}>Target customers</label>
            <span className={`${hintClasses} mb-1`}>
              Plain language — the chat dives deeper.
            </span>
            <textarea
              rows={2}
              value={profile.targetCustomers || ""}
              onChange={(e) => updateField("targetCustomers", e.target.value)}
              placeholder="B2B sales leaders, SDR teams, growth agencies..."
              className={textareaClasses}
            />
          </div>
        </div>
      </div>

      {/* 4. Ideal Customer Section Card */}
      <div className="bg-white dark:bg-[#1A2A43] rounded-2xl border border-slate-200/80 dark:border-blue-950/50 p-6 shadow-xs space-y-4 transition-colors">
        <div>
          <h3 className="text-slate-900 dark:text-slate-100 text-base font-bold">Ideal Customer</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Analyze what the ideal customer looks like
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Company Description */}
          <div className="sm:col-span-2 flex flex-col">
            <label className={`${labelClasses} mb-1`}>Company description</label>
            <textarea
              rows={2}
              value={profile.companyDescription || ""}
              onChange={(e) => updateField("companyDescription", e.target.value)}
              placeholder="Mid-market to enterprise B2B companies looking for outbound pipeline generation..."
              className={textareaClasses}
            />
          </div>

          {/* Job Titles */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5`}>Job titles</label>
            <span className={`${hintClasses} mb-1`}>
              Comma-separate, partial matches OK.
            </span>
            <input
              type="text"
              value={profile.icpJobTitles || ""}
              onChange={(e) => updateField("icpJobTitles", e.target.value)}
              placeholder="Founders, CXO, VP Sales, VP Marketing, Head of Growth"
              className={inputClasses}
            />
          </div>

          {/* Domain / Niche */}
          <div className="flex flex-col justify-end">
            <label className={`${labelClasses} mb-1`}>Domain / niche</label>
            <input
              type="text"
              value={profile.icpDomainNiche || ""}
              onChange={(e) => updateField("icpDomainNiche", e.target.value)}
              placeholder="B2B SaaS, Professional Services, Technology"
              className={inputClasses}
            />
          </div>

          {/* Locations */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5`}>Location</label>
            <span className={`${hintClasses} mb-1`}>
              Where your buyers are based.
            </span>
            <input
              type="text"
              value={profile.icpLocations || ""}
              onChange={(e) => updateField("icpLocations", e.target.value)}
              placeholder="India, USA, UK, UAE, Singapore"
              className={inputClasses}
            />
          </div>

          {/* Pain Points */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5`}>Pain points</label>
            <span className={`${hintClasses} mb-1`}>
              What you solve, in their language.
            </span>
            <textarea
              rows={2}
              value={profile.icpPainPoints || ""}
              onChange={(e) => updateField("icpPainPoints", e.target.value)}
              placeholder="High CAC, low cold outreach response rates, SDR burnout..."
              className={textareaClasses}
            />
          </div>

          {/* Decision Drivers */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Decision drivers</label>
            <input
              type="text"
              value={profile.icpDecisionDrivers || ""}
              onChange={(e) => updateField("icpDecisionDrivers", e.target.value)}
              placeholder="ROI, speed to pipeline, predictable lead flow"
              className={inputClasses}
            />
          </div>

          {/* Triggers */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Triggers</label>
            <input
              type="text"
              value={profile.icpTriggers || ""}
              onChange={(e) => updateField("icpTriggers", e.target.value)}
              placeholder="New funding, sales hiring, quarterly pipeline gaps"
              className={inputClasses}
            />
          </div>

          {/* Company Size From & To */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Company size from</label>
            <input
              type="text"
              value={profile.icpCompanySizeFrom || "10"}
              onChange={(e) => updateField("icpCompanySizeFrom", e.target.value)}
              placeholder="10"
              className={inputClasses}
            />
          </div>

          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Company size to</label>
            <input
              type="text"
              value={profile.icpCompanySizeTo || "500+"}
              onChange={(e) => updateField("icpCompanySizeTo", e.target.value)}
              placeholder="500+"
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* 5. Outreach Section Card (with OPTIONAL badges) */}
      <div className="bg-white dark:bg-[#1A2A43] rounded-2xl border border-slate-200/80 dark:border-blue-950/50 p-6 shadow-xs space-y-4 transition-colors">
        <div>
          <h3 className="text-slate-900 dark:text-slate-100 text-base font-bold">Outreach</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
            Personalized & 1:1 outbound for conversation
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Persona Name */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5 inline-flex items-center gap-1.5`}>
              Persona name
              <span className={optionalBadgeClasses}>OPTIONAL</span>
            </label>
            <span className={`${hintClasses} mb-1`}>
              The name the LinkedIn agent messages prospects as.
            </span>
            <input
              type="text"
              value={profile.personaName || ""}
              onChange={(e) => updateField("personaName", e.target.value)}
              placeholder="Sneha"
              className={inputClasses}
            />
          </div>

          {/* Style Guide */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5 inline-flex items-center gap-1.5`}>
              Style guide
              <span className={optionalBadgeClasses}>OPTIONAL</span>
            </label>
            <span className={`${hintClasses} mb-1`}>
              Guiding philosophy for messaging.
            </span>
            <input
              type="text"
              value={profile.styleGuide || ""}
              onChange={(e) => updateField("styleGuide", e.target.value)}
              placeholder="Direct, professional, consultative, value-led"
              className={inputClasses}
            />
          </div>

          {/* Tone & Voice */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5 inline-flex items-center gap-1.5`}>
              Tone & voice
              <span className={optionalBadgeClasses}>OPTIONAL</span>
            </label>
            <span className={`${hintClasses} mb-1`}>Campaign tone</span>
            <input
              type="text"
              value={profile.toneAndVoice || ""}
              onChange={(e) => updateField("toneAndVoice", e.target.value)}
              placeholder="Friendly, confident, low-jargon, executive-ready"
              className={inputClasses}
            />
          </div>

          {/* Do's & Don'ts */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5 inline-flex items-center gap-1.5`}>
              Do&apos;s & Don&apos;ts
              <span className={optionalBadgeClasses}>OPTIONAL</span>
            </label>
            <span className={`${hintClasses} mb-1`}>
              Rules to avoid common pitfalls.
            </span>
            <input
              type="text"
              value={profile.dosAndDonts || ""}
              onChange={(e) => updateField("dosAndDonts", e.target.value)}
              placeholder="Do focus on ROI. Don't use spammy sales buzzwords."
              className={inputClasses}
            />
          </div>

          {/* Value Statement */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5 inline-flex items-center gap-1.5`}>
              Value statement
              <span className={optionalBadgeClasses}>OPTIONAL</span>
            </label>
            <span className={`${hintClasses} mb-1`}>Core 1-line transformation promise.</span>
            <input
              type="text"
              value={profile.valueStatement || ""}
              onChange={(e) => updateField("valueStatement", e.target.value)}
              placeholder="Help B2B sales teams generate 3x more qualified meetings."
              className={inputClasses}
            />
          </div>

          {/* Case Stories / Proof */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5 inline-flex items-center gap-1.5`}>
              Case stories / Proof
              <span className={optionalBadgeClasses}>OPTIONAL</span>
            </label>
            <span className={`${hintClasses} mb-1`}>Real proof results that build trust.</span>
            <input
              type="text"
              value={profile.caseStories || ""}
              onChange={(e) => updateField("caseStories", e.target.value)}
              placeholder="Helped 150+ B2B agencies double discovery calls in 60 days."
              className={inputClasses}
            />
          </div>

          {/* Compliant Guarantee */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5 inline-flex items-center gap-1.5`}>
              Compliant guarantee
              <span className={optionalBadgeClasses}>OPTIONAL</span>
            </label>
            <span className={`${hintClasses} mb-1`}>Risk reversal for prospect confidence.</span>
            <input
              type="text"
              value={profile.compliantGuarantee || ""}
              onChange={(e) => updateField("compliantGuarantee", e.target.value)}
              placeholder="100% money back guarantee if not satisfied within 14 days."
              className={inputClasses}
            />
          </div>

          {/* Competitors */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5 inline-flex items-center gap-1.5`}>
              Competitors
              <span className={optionalBadgeClasses}>OPTIONAL</span>
            </label>
            <span className={`${hintClasses} mb-1`}>Names help the AI position you.</span>
            <input
              type="text"
              value={profile.competitors || ""}
              onChange={(e) => updateField("competitors", e.target.value)}
              placeholder="Apollo.io, Instantly.ai, Lemlist, Smartlead, PandaDoc"
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* 6. Offer (B2B) Section Card */}
      <div className="bg-white dark:bg-[#1A2A43] rounded-2xl border border-slate-200/80 dark:border-blue-950/50 p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-slate-900 dark:text-slate-100 text-base font-bold">Offer</h3>
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-[#2B7CFF]/15 text-[#0B1957] dark:text-[#2B7CFF] border border-blue-200 dark:border-[#2B7CFF]/30">
              B2B
            </span>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#14233a] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-blue-900/30">
            {offerCompleteness.filled} / {offerCompleteness.total}
          </span>
        </div>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
          Grounding for dynamic proposals, landing pages, and pitch decks. Anything left blank is omitted.
        </p>

        <div className="space-y-4 pt-1">
          {/* Unique Experience */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Unique experience</label>
            <textarea
              rows={2}
              value={profile.uniqueExperience || ""}
              onChange={(e) => updateField("uniqueExperience", e.target.value)}
              placeholder="Over 8+ years building high-converting outbound pipelines for high-growth tech startups."
              className={textareaClasses}
            />
          </div>

          {/* Social / Key Credentials */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Social / Key credentials</label>
            <textarea
              rows={2}
              value={profile.socialCredentials || ""}
              onChange={(e) => updateField("socialCredentials", e.target.value)}
              placeholder="Featured in Forbes 30 Under 30, 500+ successful client deployments."
              className={textareaClasses}
            />
          </div>

          {/* 12-Month Value Metrics */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>12-month value metrics</label>
            <textarea
              rows={2}
              value={profile.twelveMonthMetrics || ""}
              onChange={(e) => updateField("twelveMonthMetrics", e.target.value)}
              placeholder="Average $450k net-new ARR added per client in the first 12 months."
              className={textareaClasses}
            />
          </div>

          {/* Average Engagement Lifecycle */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Average engagement lifecycle</label>
            <input
              type="text"
              value={profile.averageLifecycle || ""}
              onChange={(e) => updateField("averageLifecycle", e.target.value)}
              placeholder="12 months with 94% retention rate."
              className={inputClasses}
            />
          </div>

          {/* Revenue Results */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5`}>Revenue results</label>
            <span className={`${hintClasses} mb-1`}>
              Substantiable outcomes — only figures you could defend if challenged.
            </span>
            <textarea
              rows={2}
              value={profile.revenueResults || ""}
              onChange={(e) => updateField("revenueResults", e.target.value)}
              placeholder="Generated over $18.5M in qualified sales pipeline across client accounts."
              className={textareaClasses}
            />
          </div>

          {/* 2-Column: Deal Size & Sales Cycle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className={`${labelClasses} mb-1`}>Average deal size ($)</label>
              <input
                type="text"
                value={profile.averageDealSize || ""}
                onChange={(e) => updateField("averageDealSize", e.target.value)}
                placeholder="$25,000 - $80,000 annual contract value."
                className={inputClasses}
              />
            </div>

            <div className="flex flex-col">
              <label className={`${labelClasses} mb-1`}>Sales cycle / time</label>
              <input
                type="text"
                value={profile.salesCycleTime || ""}
                onChange={(e) => updateField("salesCycleTime", e.target.value)}
                placeholder="3 to 6 weeks from first touch to close."
                className={inputClasses}
              />
            </div>
          </div>

          {/* Ideal Buyer Criteria */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-1`}>Ideal buyer criteria</label>
            <textarea
              rows={2}
              value={profile.idealBuyerCriteria || ""}
              onChange={(e) => updateField("idealBuyerCriteria", e.target.value)}
              placeholder="Companies with 10-500 employees and minimum $1M ARR."
              className={textareaClasses}
            />
          </div>

          {/* Common Objections Met */}
          <div className="flex flex-col">
            <label className={`${labelClasses} mb-0.5`}>Common objections met</label>
            <span className={`${hintClasses} mb-1`}>
              What you hear most often, and your answer.
            </span>
            <textarea
              rows={3}
              value={profile.commonObjections || ""}
              onChange={(e) => updateField("commonObjections", e.target.value)}
              placeholder={`"We already do cold email in-house" -> Show how AI multi-channel increases response rates 4x.`}
              className={textareaClasses}
            />
          </div>
        </div>
      </div>

      {/* 7. Bottom Save Bar */}
      <div className="bg-white dark:bg-[#1A2A43] rounded-2xl border border-slate-200/80 dark:border-blue-950/50 p-4 shadow-xs flex items-center justify-between transition-colors">
        <div className="text-xs">
          {savedAt ? (
            <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="size-4" />
              Saved changes successfully.
            </span>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              Changes are saved when you click save.
            </span>
          )}
        </div>

        <Button
          onClick={handleGlobalSave}
          disabled={isSaving}
          className="h-10 px-5 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2 shadow-xs bg-[#0B1957] dark:bg-[#2B7CFF] hover:bg-[#0B1957]/90 dark:hover:bg-[#2563eb] transition"
        >
          <Save className="size-4" />
          {isSaving ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* AI Auto-fill Modal */}
      <AiAutoFillModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApply={handleApplyAiData}
        companyName={profile.companyName || "MR LAD"}
      />
    </div>
  );
};
