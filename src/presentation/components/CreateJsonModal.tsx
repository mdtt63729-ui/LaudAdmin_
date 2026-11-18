import React, { useState } from 'react';
import { X, Loader2, Check, Sparkles, AlertCircle } from 'lucide-react';
import { CONFIG_TEMPLATES } from '../../core/jsonEngine';
import type { Translations } from '../../core/i18n';
import { apiClient } from '../../data/apiClient';
import type { AiArchitectResult } from '../../domain/types';

interface CreateJsonModalProps {
  t: Translations;
  owner: string;
  repo: string;
  branch: string;
  canPush: boolean;
  onClose: () => void;
  onCreated: (createdPath: string) => void;
}

export const CreateJsonModal: React.FC<CreateJsonModalProps> = ({
  t,
  owner,
  repo,
  branch,
  canPush,
  onClose,
  onCreated,
}) => {
  const [fileName, setFileName] = useState('');
  const [directory, setDirectory] = useState('config/');
  const [selectedTemplateId, setSelectedTemplateId] = useState(CONFIG_TEMPLATES[0].id);
  const [customJsonText, setCustomJsonText] = useState(() =>
    JSON.stringify(CONFIG_TEMPLATES[0].data, null, 2)
  );
  const [commitMessage, setCommitMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdSuccess, setCreatedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional Deep Architect prompt to generate complex initial config
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<{ message: string; paidTier?: boolean } | null>(null);

  const normalizedName = fileName.trim().replace(/\.json$/i, '');
  const cleanDir = directory.trim().replace(/^\/+/, '');
  const finalDir = cleanDir ? (cleanDir.endsWith('/') ? cleanDir : `${cleanDir}/`) : '';
  const targetPath = normalizedName ? `${finalDir}${normalizedName}.json` : '';

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    const tpl = CONFIG_TEMPLATES.find((item) => item.id === id);
    if (tpl) {
      setCustomJsonText(JSON.stringify(tpl.data, null, 2));
    }
  };

  const handleGenerateWithThinking = async (useStandardFallback = false) => {
    if (!aiPrompt.trim()) return;
    setAiError(null);
    setAiGenerating(true);
    try {
      const res = await apiClient.runDeepThink({
        mode: 'architect',
        filePath: targetPath || 'config/new_config.json',
        originalJson: customJsonText,
        editedJson: customJsonText,
        prompt: aiPrompt.trim(),
        useStandardFallback,
      });
      const data = res.result as AiArchitectResult;
      if (data.hasJsonPatch && data.updatedJson) {
        const parsed = JSON.parse(data.updatedJson);
        setCustomJsonText(JSON.stringify(parsed, null, 2));
        setSelectedTemplateId('custom');
      }
    } catch (err) {
      const e = err as Error & { code?: string };
      setAiError({
        message: e.message || 'Failed to generate configuration',
        paidTier: e.code === 'PAID_MODEL_TIER_REQUIRED',
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPush) {
      setError('Connect a GitHub Personal Access Token with write access to create files.');
      return;
    }
    if (!normalizedName || /[\\?%*:|"<>]/.test(normalizedName)) {
      setError('Enter a valid file name without special path characters.');
      return;
    }

    let parsedObj: unknown;
    try {
      parsedObj = JSON.parse(customJsonText);
    } catch {
      setError('Initial structure is not valid syntax. Fix syntax errors before committing.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const formatted = JSON.stringify(parsedObj, null, 2) + '\n';
      await apiClient.commitFile({
        owner,
        repo,
        branch,
        path: targetPath,
        content: formatted,
        message: commitMessage.trim() || `Create ${normalizedName} configuration`,
        isCreate: true,
      });
      setCreatedSuccess(true);
      setTimeout(() => {
        onCreated(targetPath);
      }, 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Commit failed');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-file-heading"
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-3xl border shadow-2xl overflow-hidden"
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
          <div>
            <h2 id="create-file-heading" className="font-display text-lg font-semibold">
              {t.createFileTitle}
            </h2>
            <p className="text-xs font-mono" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {owner}/{repo} · {branch}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-80 cursor-pointer"
            style={{ color: 'var(--m3-on-surface-variant)' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {t.fileNameLabel}
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="kind_master"
                required
                className="w-full h-11 px-3.5 rounded-xl border text-sm font-mono focus:outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface)',
                  borderColor: 'var(--m3-outline)',
                  color: 'var(--m3-on-surface)',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
                {t.directoryPathLabel}
              </label>
              <input
                type="text"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="config/"
                className="w-full h-11 px-3.5 rounded-xl border text-sm font-mono focus:outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface)',
                  borderColor: 'var(--m3-outline)',
                  color: 'var(--m3-on-surface)',
                }}
              />
            </div>
          </div>

          {targetPath && (
            <div
              className="px-3.5 py-2 rounded-xl text-xs font-mono border"
              style={{
                backgroundColor: 'var(--m3-surface-container)',
                borderColor: 'var(--m3-outline-variant)',
                color: 'var(--m3-on-surface-variant)',
              }}
            >
              Target path: <span style={{ color: 'var(--m3-on-surface)' }}>{targetPath}</span>
            </div>
          )}

          {/* Templates */}
          <div className="space-y-2">
            <span className="block text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {t.templateLabel}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {CONFIG_TEMPLATES.map((tpl) => {
                const active = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => handleTemplateSelect(tpl.id)}
                    className="p-3 rounded-xl border text-left transition-colors cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--m3-primary-container)' : 'var(--m3-surface)',
                      borderColor: active ? 'var(--m3-primary)' : 'var(--m3-outline-variant)',
                      color: active ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                    }}
                  >
                    <div className="text-xs font-semibold">{tpl.label}</div>
                    <div className="text-[11px] opacity-80 mt-0.5 line-clamp-2">{tpl.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional High-Thinking Architect */}
          <div
            className="p-4 rounded-2xl border space-y-2.5"
            style={{
              backgroundColor: 'var(--m3-surface-container)',
              borderColor: 'var(--m3-outline-variant)',
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
              <span>Design Structure with Deep Thinking</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Create update config for v3.1.0 with forceUpdate below build 280 and maintenance block"
                className="flex-1 h-10 px-3 rounded-xl border text-xs focus:outline-none"
                style={{
                  backgroundColor: 'var(--m3-surface-container-low)',
                  borderColor: 'var(--m3-outline)',
                  color: 'var(--m3-on-surface)',
                }}
              />
              <button
                type="button"
                disabled={aiGenerating || !aiPrompt.trim()}
                onClick={() => handleGenerateWithThinking(false)}
                className="h-10 px-3.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: 'var(--m3-primary)',
                  color: 'var(--m3-on-primary)',
                }}
              >
                {aiGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Draft</span>
              </button>
            </div>
            {aiError && (
              <div className="text-xs text-red-600 dark:text-red-400 flex items-center justify-between gap-2">
                <span>{aiError.message}</span>
                {aiError.paidTier && (
                  <button
                    type="button"
                    onClick={() => handleGenerateWithThinking(true)}
                    className="underline font-medium shrink-0 cursor-pointer"
                  >
                    Use Standard Thinking
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
              Initial Content Preview
            </label>
            <textarea
              value={customJsonText}
              onChange={(e) => {
                setCustomJsonText(e.target.value);
                setSelectedTemplateId('custom');
              }}
              rows={8}
              spellCheck={false}
              className="w-full p-3.5 rounded-xl border text-xs font-mono focus:outline-none"
              style={{
                backgroundColor: 'var(--m3-surface)',
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {t.commitMessageLabel}
            </label>
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder={
                normalizedName ? `Create ${normalizedName} configuration` : 'Create configuration file'
              }
              className="w-full h-11 px-3.5 rounded-xl border text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--m3-surface)',
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3 rounded-xl text-xs font-medium bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-xl border text-sm font-medium cursor-pointer"
              style={{
                borderColor: 'var(--m3-outline)',
                color: 'var(--m3-on-surface)',
              }}
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting || createdSuccess || !canPush}
              className="h-11 px-6 rounded-xl text-sm font-medium inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
              style={{
                backgroundColor: createdSuccess ? '#16A34A' : 'var(--m3-primary)',
                color: createdSuccess ? '#FFFFFF' : 'var(--m3-on-primary)',
              }}
            >
              {createdSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t.savedToGithub}</span>
                </>
              ) : submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t.savingToGithub}</span>
                </>
              ) : (
                <span>{t.createAndCommit}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
