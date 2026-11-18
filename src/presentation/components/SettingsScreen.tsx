import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Sun,
  Moon,
  Monitor,
  ShieldCheck,
  Languages,
  Sparkles,
  LogOut,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type {
  AccentPalette,
  AppLanguage,
  GitHubUserProfile,
  MotionPreference,
  ThemeMode,
} from '../../domain/types';
import type { Translations } from '../../core/i18n';
import { ANDROID_BLUEPRINT_FILES } from '../../core/androidBlueprint';
import { M3_CHIP_SPRING, getSpring } from '../../core/motionPresets';

interface SettingsScreenProps {
  t: Translations;
  user: GitHubUserProfile | null;
  theme: ThemeMode;
  accent: AccentPalette;
  motionMode: MotionPreference;
  language: AppLanguage;
  onChangeTheme: (theme: ThemeMode) => void;
  onChangeAccent: (accent: AccentPalette) => void;
  onChangeMotion: (motion: MotionPreference) => void;
  onChangeLanguage: (lang: AppLanguage) => void;
  onDisconnect: () => void;
}

const ACCENTS: Array<{ id: AccentPalette; label: string; swatch: string }> = [
  { id: 'warm-amber', label: 'Warm Bronze', swatch: '#8C4A19' },
  { id: 'slate-indigo', label: 'Slate Indigo', swatch: '#37499E' },
  { id: 'sage-teal', label: 'Sage Teal', swatch: '#1A6857' },
  { id: 'terracotta', label: 'Terracotta', swatch: '#A83E2B' },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  t,
  user,
  theme,
  accent,
  motionMode,
  language,
  onChangeTheme,
  onChangeAccent,
  onChangeMotion,
  onChangeLanguage,
  onDisconnect,
}) => {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const reducedMotion = motionMode === 'reduced';
  const chipSpring = getSpring(reducedMotion, M3_CHIP_SPRING);

  const handleCopyCode = async (path: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedPath(path);
      setTimeout(() => setCopiedPath(null), 1500);
    } catch {
      // Ignore clipboard restrictions
    }
  };

  const handleDownloadBlueprint = () => {
    const bundle = ANDROID_BLUEPRINT_FILES.map(
      (f) => `// === ${f.path} ===\n// ${f.description}\n\n${f.content}\n`
    ).join('\n\n');
    const blob = new Blob([bundle], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lauda-admin-android-kotlin-blueprint.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-6 pb-20">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{t.settings}</h1>
        <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>
          Manage GitHub session security, Material 3 dynamic theming, motion, and interface language.
        </p>
      </div>

      {/* GitHub Account */}
      <section
        className="p-6 rounded-3xl border space-y-4"
        style={{
          backgroundColor: 'var(--m3-surface-container-low)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {user ? (
            <div className="flex items-center gap-3.5">
              <img
                src={user.avatarUrl}
                alt={user.login}
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-2xl border object-cover"
                style={{ borderColor: 'var(--m3-outline-variant)' }}
              />
              <div>
                <h2 className="font-display text-base font-semibold">
                  {user.name || user.login}
                </h2>
                <p className="text-xs font-mono" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  @{user.login} · {user.publicRepos} public · {user.privateRepos} private
                </p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="font-display text-base font-semibold">Public Read-Only Mode</h2>
              <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                No GitHub Personal Access Token connected in this session.
              </p>
            </div>
          )}

          <motion.button
            type="button"
            whileTap={reducedMotion ? undefined : { scale: 0.95 }}
            transition={chipSpring}
            onClick={onDisconnect}
            className="h-10 px-4 rounded-xl border text-xs font-medium inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
            style={{
              backgroundColor: 'var(--m3-surface-container)',
              borderColor: 'var(--m3-outline)',
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{user ? t.disconnect : t.connectGithub}</span>
          </motion.button>
        </div>
      </section>

      {/* Theme & Dynamic Color with Bouncy Layout Pills */}
      <section
        className="p-6 rounded-3xl border space-y-6"
        style={{
          backgroundColor: 'var(--m3-surface-container-low)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold">{t.themeLabel}</h2>
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: Monitor },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const active = theme === opt.id;
              return (
                <motion.button
                  key={opt.id}
                  type="button"
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  onClick={() => onChangeTheme(opt.id)}
                  className="relative h-11 px-4 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-2 cursor-pointer overflow-hidden"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: active ? 'var(--m3-primary)' : 'var(--m3-outline-variant)',
                    color: active ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="settings-theme-pill"
                      transition={chipSpring}
                      className="absolute inset-0"
                      style={{ backgroundColor: 'var(--m3-primary-container)' }}
                    />
                  )}
                  <Icon className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">{opt.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-sm font-semibold">{t.accentLabel}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {ACCENTS.map((item) => {
              const active = accent === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  onClick={() => onChangeAccent(item.id)}
                  className="relative h-11 px-3.5 rounded-xl border text-xs font-medium inline-flex items-center gap-2.5 cursor-pointer overflow-hidden"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: active ? 'var(--m3-primary)' : 'var(--m3-outline-variant)',
                    color: active ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="settings-accent-pill"
                      transition={chipSpring}
                      className="absolute inset-0"
                      style={{ backgroundColor: 'var(--m3-primary-container)' }}
                    />
                  )}
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 relative z-10"
                    style={{ backgroundColor: item.swatch }}
                  />
                  <span className="truncate relative z-10">{item.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
            <h2 className="font-display text-sm font-semibold">{t.motionLabel}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {(['full', 'reduced'] as const).map((m) => {
              const active = motionMode === m;
              return (
                <motion.button
                  key={m}
                  type="button"
                  whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                  onClick={() => onChangeMotion(m)}
                  className="relative h-11 px-4 rounded-xl border text-xs font-medium capitalize cursor-pointer overflow-hidden"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: active ? 'var(--m3-primary)' : 'var(--m3-outline-variant)',
                    color: active ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="settings-motion-pill"
                      transition={chipSpring}
                      className="absolute inset-0"
                      style={{ backgroundColor: 'var(--m3-primary-container)' }}
                    />
                  )}
                  <span className="relative z-10">
                    {m === 'full' ? 'Material 3 Expressive Spring' : 'Reduced Motion'}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Multi-Language Support */}
      <section
        className="p-6 rounded-3xl border space-y-4"
        style={{
          backgroundColor: 'var(--m3-surface-container-low)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4" style={{ color: 'var(--m3-primary)' }} />
          <h2 className="font-display text-sm font-semibold">{t.languageLabel}</h2>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {(
            [
              { id: 'en', label: 'English' },
              { id: 'bn', label: 'বাংলা (Bengali)' },
              { id: 'hi', label: 'हिन्दी (Hindi)' },
            ] as const
          ).map((l) => {
            const active = language === l.id;
            return (
              <motion.button
                key={l.id}
                type="button"
                whileTap={reducedMotion ? undefined : { scale: 0.96 }}
                onClick={() => onChangeLanguage(l.id)}
                className="relative h-11 px-3 rounded-xl border text-xs font-medium cursor-pointer truncate overflow-hidden"
                style={{
                  backgroundColor: 'var(--m3-surface)',
                  borderColor: active ? 'var(--m3-primary)' : 'var(--m3-outline-variant)',
                  color: active ? 'var(--m3-on-primary-container)' : 'var(--m3-on-surface)',
                }}
              >
                {active && (
                  <motion.span
                    layoutId="settings-lang-pill"
                    transition={chipSpring}
                    className="absolute inset-0"
                    style={{ backgroundColor: 'var(--m3-primary-container)' }}
                  />
                )}
                <span className="relative z-10">{l.label}</span>
              </motion.button>
            );
          })}
        </div>

        <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
          {t.languageNote}
        </p>
      </section>

      {/* Security & Native Android Kotlin/Compose Blueprint */}
      <section
        className="p-6 rounded-3xl border space-y-4"
        style={{
          backgroundColor: 'var(--m3-surface-container-low)',
          borderColor: 'var(--m3-outline-variant)',
        }}
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--m3-primary)' }} />
          <div className="space-y-1">
            <h2 className="font-display text-sm font-semibold">{t.securityNoteTitle}</h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--m3-on-surface-variant)' }}>
              {t.securityNoteBody}
            </p>
          </div>
        </div>

        <div
          className="pt-4 border-t space-y-3"
          style={{ borderColor: 'var(--m3-outline-variant)' }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold">{t.androidBlueprint}</h3>
              <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                Reference Kotlin + Jetpack Compose + Material 3 Clean Architecture modules for building the Android APK.
              </p>
            </div>
            <motion.button
              type="button"
              whileTap={reducedMotion ? undefined : { scale: 0.96 }}
              transition={chipSpring}
              onClick={handleDownloadBlueprint}
              className="h-10 px-4 rounded-xl border text-xs font-medium inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
              style={{
                backgroundColor: 'var(--m3-surface-container)',
                borderColor: 'var(--m3-outline)',
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Kotlin Modules</span>
            </motion.button>
          </div>

          <div className="space-y-2">
            {ANDROID_BLUEPRINT_FILES.map((file) => {
              const isOpen = expandedFile === file.path;
              return (
                <div
                  key={file.path}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    backgroundColor: 'var(--m3-surface)',
                    borderColor: 'var(--m3-outline-variant)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setExpandedFile(isOpen ? null : file.path)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-semibold truncate">{file.path}</div>
                      <div className="text-[11px] truncate" style={{ color: 'var(--m3-on-surface-variant)' }}>
                        {file.description}
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="w-4 h-4 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div
                      className="border-t p-3 space-y-2"
                      style={{ borderColor: 'var(--m3-outline-variant)' }}
                    >
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(file.path, file.content)}
                          className="h-8 px-3 rounded-lg border text-[11px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
                          style={{ borderColor: 'var(--m3-outline)' }}
                        >
                          {copiedPath === file.path ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="text-[11px] font-mono overflow-x-auto leading-relaxed">
                        {file.content}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};
