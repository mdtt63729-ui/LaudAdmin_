import React, { useState } from 'react';
import { X, BrainCircuit, Loader2, ShieldAlert, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import { apiClient } from '../../data/apiClient';
import type { AiArchitectResult, AiAuditResult, JsonDiffEntry } from '../../domain/types';

interface DeepThinkingSheetProps {
  filePath: string;
  originalJson: string;
  editedJson: string;
  diffs: JsonDiffEntry[];
  canEdit: boolean;
  onClose: () => void;
  onApplyPatch: (parsedJson: unknown) => void;
}

export const DeepThinkingSheet: React.FC<DeepThinkingSheetProps> = ({
  filePath,
  originalJson,
  editedJson,
  diffs,
  canEdit,
  onClose,
  onApplyPatch,
}) => {
  const [tab, setTab] = useState<'audit' | 'architect'>('audit');
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [errorState, setErrorState] = useState<{ message: string; paidTier?: boolean } | null>(null);

  const [auditResult, setAuditResult] = useState<AiAuditResult | null>(null);
  const [architectPrompt, setArchitectPrompt] = useState('');
  const [architectResult, setArchitectResult] = useState<AiArchitectResult | null>(null);
  const [patchApplied, setPatchApplied] = useState(false);

  const runAudit = async (useStandardFallback = false) => {
    setErrorState(null);
    setLoading(true);
    try {
      const res = await apiClient.runDeepThink({
        mode: 'audit',
        filePath,
        originalJson,
        editedJson,
        diffSummary: diffs,
        useStandardFallback,
      });
      setActiveModel(res.model);
      setAuditResult(res.result as AiAuditResult);
    } catch (err) {
      const e = err as Error & { code?: string };
      setErrorState({
        message: e.message || 'Analysis failed',
        paidTier: e.code === 'PAID_MODEL_TIER_REQUIRED',
      });
    } finally {
      setLoading(false);
    }
  };

  const runArchitect = async (useStandardFallback = false) => {
    if (!architectPrompt.trim()) return;
    setErrorState(null);
    setPatchApplied(false);
    setLoading(true);
    try {
      const res = await apiClient.runDeepThink({
        mode: 'architect',
        filePath,
        originalJson,
        editedJson,
        prompt: architectPrompt.trim(),
        useStandardFallback,
      });
      setActiveModel(res.model);
      setArchitectResult(res.result as AiArchitectResult);
    } catch (err) {
      const e = err as Error & { code?: string };
      setErrorState({
        message: e.message || 'Architect query failed',
        paidTier: e.code === 'PAID_MODEL_TIER_REQUIRED',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!architectResult?.updatedJson) return;
    try {
      const parsed = JSON.parse(architectResult.updatedJson);
      onApplyPatch(parsed);
      setPatchApplied(true);
    } catch {
      setErrorState({ message: 'Generated patch could not be parsed cleanly.' });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Deep Configuration Analysis"
    >
      <div
        className="w-full max-w-xl h-full flex flex-col border-l shadow-2xl"
        style={{
          backgroundColor: 'var(--m3-surface-container-low)',
          borderColor: 'var(--m3-outline)',
          color: 'var(--m3-on-surface)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--m3-outline-variant)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                backgroundColor: 'var(--m3-primary-container)',
                color: 'var(--m3-on-primary-container)',
              }}
            >
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold">Deep Configuration Thinking</h2>
              <p className="text-xs font-mono" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {activeModel ? `${activeModel} · HIGH thinking` : 'High reasoning depth · Type & compatibility check'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-80 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Segmented Bar */}
        <div className="px-6 pt-4">
          <div
            className="grid grid-cols-2 p-1 rounded-xl border"
            style={{
              backgroundColor: 'var(--m3-surface-container)',
              borderColor: 'var(--m3-outline-variant)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setTab('audit');
                setErrorState(null);
              }}
              className="h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: tab === 'audit' ? 'var(--m3-surface-container-low)' : 'transparent',
                color: tab === 'audit' ? 'var(--m3-on-surface)' : 'var(--m3-on-surface-variant)',
              }}
            >
              Diff & Compatibility Audit
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('architect');
                setErrorState(null);
              }}
              className="h-9 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              style={{
                backgroundColor: tab === 'architect' ? 'var(--m3-surface-container-low)' : 'transparent',
                color: tab === 'architect' ? 'var(--m3-on-surface)' : 'var(--m3-on-surface-variant)',
              }}
            >
              Configuration Architect
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorState && (
            <div className="p-4 rounded-2xl border bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5 font-medium">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorState.message}</span>
              </div>
              {errorState.paidTier && (
                <button
                  type="button"
                  onClick={() => (tab === 'audit' ? runAudit(true) : runArchitect(true))}
                  className="px-3.5 py-2 rounded-xl font-semibold border border-red-500/30 hover:bg-red-500/10 cursor-pointer"
                >
                  Retry with Standard High Thinking (gemini-4-hydrogen)
                </button>
              )}
            </div>
          )}

          {tab === 'audit' ? (
            <div className="space-y-4">
              <div
                className="p-4 rounded-2xl border space-y-3"
                style={{
                  backgroundColor: 'var(--m3-surface-container)',
                  borderColor: 'var(--m3-outline-variant)',
                }}
              >
                <p className="text-xs leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Inspects <span className="font-mono">{filePath}</span> and your {diffs.length} pending change(s) for numeric/boolean type mismatches, broken download or logo URLs, minimumVersionCode bounds, and target-app compatibility risks.
                </p>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => runAudit(false)}
                  className="w-full h-11 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--m3-primary)',
                    color: 'var(--m3-on-primary)',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Running Deep Analysis...</span>
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="w-4 h-4" />
                      <span>Run Configuration Audit</span>
                    </>
                  )}
                </button>
              </div>

              {auditResult && (
                <div className="space-y-4">
                  <div
                    className="p-4 rounded-2xl border space-y-2"
                    style={{
                      backgroundColor: 'var(--m3-surface)',
                      borderColor: 'var(--m3-outline-variant)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-semibold">{auditResult.verdict}</span>
                      <span className="text-xs font-mono uppercase">{auditResult.riskLevel}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      {auditResult.summary}
                    </p>
                  </div>

                  {auditResult.findings.length > 0 && (
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        Findings ({auditResult.findings.length})
                      </h3>
                      {auditResult.findings.map((f, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl border space-y-1"
                          style={{
                            backgroundColor: 'var(--m3-surface)',
                            borderColor: 'var(--m3-outline-variant)',
                          }}
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold">
                            {f.severity.toLowerCase().includes('high') || f.severity.toLowerCase().includes('error') ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )}
                            <span>{f.title}</span>
                          </div>
                          <div className="text-[11px] font-mono" style={{ color: 'var(--m3-primary)' }}>
                            {f.path}
                          </div>
                          <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                            {f.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {auditResult.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        Recommendations
                      </h3>
                      <ul className="space-y-1.5 text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        {auditResult.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span aria-hidden="true">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  Describe complex configuration changes or ask a compatibility question
                </label>
                <textarea
                  rows={4}
                  value={architectPrompt}
                  onChange={(e) => setArchitectPrompt(e.target.value)}
                  placeholder="e.g. Add a compatibility block with minimumVersionCode 250, bump versionCode to 257, and add a maintenance block disabled by default without touching unknown keys."
                  className="w-full p-3.5 rounded-2xl border text-xs leading-relaxed focus:outline-none"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: 'var(--m3-outline)',
                    color: 'var(--m3-on-surface)',
                  }}
                />
                <button
                  type="button"
                  disabled={loading || !architectPrompt.trim()}
                  onClick={() => runArchitect(false)}
                  className="w-full h-11 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  style={{
                    backgroundColor: 'var(--m3-primary)',
                    color: 'var(--m3-on-primary)',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Thinking...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analyze & Propose Patch</span>
                    </>
                  )}
                </button>
              </div>

              {architectResult && (
                <div
                  className="p-4 rounded-2xl border space-y-3"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: 'var(--m3-outline-variant)',
                  }}
                >
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                    {architectResult.explanation}
                  </p>

                  {architectResult.changedPaths.length > 0 && (
                    <div className="text-[11px] font-mono" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      Affected paths: {architectResult.changedPaths.join(', ')}
                    </div>
                  )}

                  {architectResult.hasJsonPatch && architectResult.updatedJson && (
                    <div className="space-y-2.5 pt-1">
                      <pre
                        className="p-3 rounded-xl border text-[11px] font-mono overflow-x-auto max-h-56"
                        style={{
                          backgroundColor: 'var(--m3-surface-container)',
                          borderColor: 'var(--m3-outline-variant)',
                        }}
                      >
                        {architectResult.updatedJson}
                      </pre>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleApply}
                          disabled={patchApplied}
                          className="w-full h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                          style={{
                            backgroundColor: patchApplied ? '#16A34A' : 'var(--m3-primary-container)',
                            color: patchApplied ? '#FFFFFF' : 'var(--m3-on-primary-container)',
                          }}
                        >
                          {patchApplied ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Applied to Visual Editor</span>
                            </>
                          ) : (
                            <span>Apply Patch to Visual Editor</span>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
