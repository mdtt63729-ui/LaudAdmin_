import type { AppLanguage } from '../domain/types';

export interface Translations {
  appName: string;
  tagline: string;
  connectGithub: string;
  patLabel: string;
  patPlaceholder: string;
  connectButton: string;
  connecting: string;
  securityNoteTitle: string;
  securityNoteBody: string;
  explorePublicTitle: string;
  explorePublicHint: string;
  exploreButton: string;
  selectRepository: string;
  searchRepositories: string;
  publicLabel: string;
  privateLabel: string;
  readOnlyLabel: string;
  defaultBranch: string;
  noRepositories: string;
  jsonDashboard: string;
  refresh: string;
  refreshing: string;
  createConfig: string;
  noConfigFiles: string;
  createFirstConfig: string;
  back: string;
  save: string;
  noChanges: string;
  visualEditor: string;
  rawView: string;
  deepAudit: string;
  addProperty: string;
  addItem: string;
  rename: string;
  duplicate: string;
  changeType: string;
  delete: string;
  cancel: string;
  confirmDeleteTitle: string;
  confirmDeleteBody: string;
  saveChangesTitle: string;
  commitMessageLabel: string;
  commitChanges: string;
  savingToGithub: string;
  savedToGithub: string;
  remoteChangedTitle: string;
  remoteChangedBody: string;
  reloadLatest: string;
  reviewDiff: string;
  unsavedChangesTitle: string;
  unsavedChangesBody: string;
  reload: string;
  settings: string;
  repositories: string;
  switchRepo: string;
  disconnect: string;
  themeLabel: string;
  accentLabel: string;
  motionLabel: string;
  languageLabel: string;
  languageNote: string;
  androidBlueprint: string;
  createFileTitle: string;
  fileNameLabel: string;
  directoryPathLabel: string;
  templateLabel: string;
  createAndCommit: string;
  offlineBanner: string;
  undo: string;
  redo: string;
  versionHistory: string;
  restoreVersion: string;
  fullscreen: string;
  exitFullscreen: string;
}

const EN: Translations = {
  appName: 'LAUDA Admin',
  tagline: 'GitHub Configuration Administration Platform',
  connectGithub: 'Connect GitHub',
  patLabel: 'Personal Access Token',
  patPlaceholder: 'ghp_ or github_pat_...',
  connectButton: 'Connect Account',
  connecting: 'Verifying token...',
  securityNoteTitle: 'Encrypted Session Vault',
  securityNoteBody:
    'Your Personal Access Token is encrypted in server memory via AES-256-GCM, never written to disk, never logged, and never committed to any repository.',
  explorePublicTitle: 'Inspect a Public Repository',
  explorePublicHint: 'Enter owner/repository (read-only mode without PAT)',
  exploreButton: 'Open Repository',
  selectRepository: 'Select Repository',
  searchRepositories: 'Search repositories by name or owner...',
  publicLabel: 'Public',
  privateLabel: 'Private',
  readOnlyLabel: 'Read-only',
  defaultBranch: 'Branch',
  noRepositories: 'No repositories match your search.',
  jsonDashboard: 'Configuration Files',
  refresh: 'Refresh',
  refreshing: 'Refreshing',
  createConfig: 'Create File',
  noConfigFiles: 'No configuration files found in this branch.',
  createFirstConfig: 'Create First Configuration',
  back: 'Back',
  save: 'Save',
  noChanges: 'No changes',
  visualEditor: 'Visual Tree',
  rawView: 'Raw Preview',
  deepAudit: 'Deep Audit',
  addProperty: 'Add Property',
  addItem: 'Add Item',
  rename: 'Rename',
  duplicate: 'Duplicate',
  changeType: 'Change Type',
  delete: 'Delete',
  cancel: 'Cancel',
  confirmDeleteTitle: 'Delete Property',
  confirmDeleteBody: 'This will remove the selected property and any nested values from the working tree.',
  saveChangesTitle: 'Save Changes',
  commitMessageLabel: 'Commit message',
  commitChanges: 'Commit Changes',
  savingToGithub: 'Committing to GitHub...',
  savedToGithub: 'Saved to GitHub',
  remoteChangedTitle: 'Remote file changed',
  remoteChangedBody: 'Someone modified this file on GitHub after you opened it. Reload the latest version to avoid overwriting remote work.',
  reloadLatest: 'Reload Latest',
  reviewDiff: 'Review Remote',
  unsavedChangesTitle: 'Unsaved Changes',
  unsavedChangesBody: 'Reloading from GitHub will discard your local changes.',
  reload: 'Reload',
  settings: 'Settings',
  repositories: 'Repositories',
  switchRepo: 'Switch Repo',
  disconnect: 'Disconnect',
  themeLabel: 'Appearance',
  accentLabel: 'Dynamic Color Accent',
  motionLabel: 'Animation Preference',
  languageLabel: 'Interface Language',
  languageNote: 'Only interface controls are localized. User configuration keys and values are never modified or translated.',
  androidBlueprint: 'Native Android Kotlin / Compose Blueprint',
  createFileTitle: 'Create Configuration File',
  fileNameLabel: 'File Name',
  directoryPathLabel: 'Repository Directory',
  templateLabel: 'Initial Structure',
  createAndCommit: 'Create & Commit',
  offlineBanner: 'No Internet Connection — Read-only cached view active. Commits require network connectivity.',
  undo: 'Undo',
  redo: 'Redo',
  versionHistory: 'History',
  restoreVersion: 'Restore Version',
  fullscreen: 'Fullscreen',
  exitFullscreen: 'Exit Fullscreen',
};

const BN: Translations = {
  appName: 'LAUDA Admin',
  tagline: 'গিটহাব কনফিগারেশন অ্যাডমিনিস্ট্রেশন প্ল্যাটফর্ম',
  connectGithub: 'গিটহাব সংযুক্ত করুন',
  patLabel: 'পার্সোনাল অ্যাক্সেস টোকেন (PAT)',
  patPlaceholder: 'ghp_ অথবা github_pat_...',
  connectButton: 'অ্যাকাউন্ট সংযুক্ত করুন',
  connecting: 'টোকেন যাচাই করা হচ্ছে...',
  securityNoteTitle: 'এনক্রিপ্টেড সেশন ভল্ট',
  securityNoteBody:
    'আপনার টোকেন AES-256-GCM দ্বারা এনক্রিপ্ট করা থাকে, কখনো ডিস্কে সংরক্ষণ করা হয় না, লগ করা হয় না এবং কোনো রিপোজিটরিতে কমিট করা হয় না।',
  explorePublicTitle: 'পাবলিক রিপোজিটরি দেখুন',
  explorePublicHint: 'owner/repository লিখুন (টোকেন ছাড়া শুধুমাত্র দেখার মোড)',
  exploreButton: 'রিপোজিটরি খুলুন',
  selectRepository: 'রিপোজিটরি নির্বাচন করুন',
  searchRepositories: 'নাম বা মালিকের নাম দিয়ে খুঁজুন...',
  publicLabel: 'পাবলিক',
  privateLabel: 'প্রাইভেট',
  readOnlyLabel: 'রিড-অনলি',
  defaultBranch: 'ব্রাঞ্চ',
  noRepositories: 'কোনো রিপোজিটরি পাওয়া যায়নি।',
  jsonDashboard: 'কনফিগারেশন ফাইলসমূহ',
  refresh: 'রিফ্রেশ',
  refreshing: 'রিফ্রেশ হচ্ছে',
  createConfig: 'নতুন ফাইল',
  noConfigFiles: 'এই ব্রাঞ্চে কোনো কনফিগারেশন ফাইল পাওয়া যায়নি।',
  createFirstConfig: 'প্রথম কনফিগারেশন তৈরি করুন',
  back: 'ফিরে যান',
  save: 'সেভ করুন',
  noChanges: 'কোনো পরিবর্তন নেই',
  visualEditor: 'ভিজ্যুয়াল এডিটর',
  rawView: 'র প্রিভিউ',
  deepAudit: 'ডিপ অডিট',
  addProperty: 'প্রপার্টি যোগ করুন',
  addItem: 'আইটেম যোগ করুন',
  rename: 'নাম পরিবর্তন',
  duplicate: 'ডুপ্লিকেট',
  changeType: 'টাইপ পরিবর্তন',
  delete: 'মুছুন',
  cancel: 'বাতিল',
  confirmDeleteTitle: 'প্রপার্টি মুছে ফেলুন',
  confirmDeleteBody: 'এটি নির্বাচিত প্রপার্টি এবং এর ভেতরের সব মান বর্তমান এডিটর থেকে সরিয়ে দেবে।',
  saveChangesTitle: 'পরিবর্তন সংরক্ষণ করুন',
  commitMessageLabel: 'কমিট বার্তা',
  commitChanges: 'গিটহাবে কমিট করুন',
  savingToGithub: 'গিটহাবে কমিট হচ্ছে...',
  savedToGithub: 'গিটহাবে সংরক্ষিত হয়েছে',
  remoteChangedTitle: 'রিমোট ফাইল পরিবর্তিত হয়েছে',
  remoteChangedBody: 'আপনি ফাইলটি খোলার পর গিটহাবে অন্য কেউ এটি পরিবর্তন করেছেন। ডেটা হারানো এড়াতে সর্বশেষ সংস্করণ রিলোড করুন।',
  reloadLatest: 'সর্বশেষ রিলোড',
  reviewDiff: 'পার্থক্য দেখুন',
  unsavedChangesTitle: 'অসংরক্ষিত পরিবর্তন',
  unsavedChangesBody: 'গিটহাব থেকে রিলোড করলে আপনার স্থানীয় পরিবর্তনগুলো মুছে যাবে।',
  reload: 'রিলোড',
  settings: 'সেটিংস',
  repositories: 'রিপোজিটরি',
  switchRepo: 'রিপো বদলান',
  disconnect: 'বিচ্ছিন্ন করুন',
  themeLabel: 'থিম মোড',
  accentLabel: 'ডাইনামিক অ্যাক্সেন্ট রঙ',
  motionLabel: 'অ্যানিমেশন পছন্দ',
  languageLabel: 'অ্যাপের ভাষা',
  languageNote: 'শুধুমাত্র অ্যাপের ইন্টারফেস অনুবাদ করা হয়। আপনার কনফিগারেশন ডেটা বা ভাষা কখনোই পরিবর্তন করা হয় না।',
  androidBlueprint: 'নেটিভ অ্যান্ড্রয়েড Kotlin / Compose ব্লুপ্রিন্ট',
  createFileTitle: 'নতুন কনফিগারেশন ফাইল তৈরি',
  fileNameLabel: 'ফাইলের নাম',
  directoryPathLabel: 'ডিরেক্টরি পাথ',
  templateLabel: 'প্রাথমিক কাঠামো',
  createAndCommit: 'তৈরি ও কমিট করুন',
  offlineBanner: 'ইন্টারনেট সংযোগ নেই — ক্যাশ করা ডেটা দেখাচ্ছে। কমিট করতে সংযোগ প্রয়োজন।',
  undo: 'আনডু',
  redo: 'রিডু',
  versionHistory: 'ইতিহাস',
  restoreVersion: 'সংস্করণ পুনরুদ্ধার',
  fullscreen: 'পূর্ণ স্ক্রিন',
  exitFullscreen: 'পূর্ণ স্ক্রিন বন্ধ',
};

const HI: Translations = {
  appName: 'LAUDA Admin',
  tagline: 'गिटहब कॉन्फ़िगरेशन एडमिनिस्ट्रेशन प्लेटफ़ॉर्म',
  connectGithub: 'गिटहब कनेक्ट करें',
  patLabel: 'पर्सनल एक्सेस टोकन (PAT)',
  patPlaceholder: 'ghp_ या github_pat_...',
  connectButton: 'खाता कनेक्ट करें',
  connecting: 'टोकन सत्यापित हो रहा है...',
  securityNoteTitle: 'एन्क्रिप्टेड सेशन वॉल्ट',
  securityNoteBody:
    'आपका टोकन AES-256-GCM द्वारा एन्क्रिप्टेड रहता है, कभी डिस्क पर सेव नहीं होता, लॉग नहीं होता और रिपॉज़िटरी में कमिट नहीं होता।',
  explorePublicTitle: 'पब्लिक रिपॉज़िटरी देखें',
  explorePublicHint: 'owner/repository दर्ज करें (PAT के बिना रीड-ओनली मोड)',
  exploreButton: 'रिपॉज़िटरी खोलें',
  selectRepository: 'रिपॉज़िटरी चुनें',
  searchRepositories: 'नाम या ओनर से खोजें...',
  publicLabel: 'पब्लिक',
  privateLabel: 'प्राइवेट',
  readOnlyLabel: 'रीड-ओनली',
  defaultBranch: 'ब्रांच',
  noRepositories: 'कोई रिपॉज़िटरी नहीं मिली।',
  jsonDashboard: 'कॉन्फ़िगरेशन फ़ाइलें',
  refresh: 'रीफ़्रेश',
  refreshing: 'रीफ़्रेश हो रहा है',
  createConfig: 'नई फ़ाइल',
  noConfigFiles: 'इस ब्रांच में कोई कॉन्फ़िगरेशन फ़ाइल नहीं मिली।',
  createFirstConfig: 'पहली कॉन्फ़िगरेशन बनाएं',
  back: 'वापस',
  save: 'सेव करें',
  noChanges: 'कोई बदलाव नहीं',
  visualEditor: 'विज़ुअल एडिटर',
  rawView: 'रॉ प्रीव्यू',
  deepAudit: 'डीप ऑडिट',
  addProperty: 'प्रॉपर्टी जोड़ें',
  addItem: 'आइटम जोड़ें',
  rename: 'नाम बदलें',
  duplicate: 'डुप्लिकेट',
  changeType: 'टाइप बदलें',
  delete: 'हटाएं',
  cancel: 'रद्द करें',
  confirmDeleteTitle: 'प्रॉपर्टी हटाएं',
  confirmDeleteBody: 'यह चयनित प्रॉपर्टी और उसके सभी नेस्टेड मान हटा देगा।',
  saveChangesTitle: 'बदलाव सेव करें',
  commitMessageLabel: 'कमिट संदेश',
  commitChanges: 'गिटहब पर कमिट करें',
  savingToGithub: 'गिटहब पर कमिट हो रहा है...',
  savedToGithub: 'गिटहब पर सेव हो गया',
  remoteChangedTitle: 'रिमोट फ़ाइल बदल गई है',
  remoteChangedBody: 'आपके खोलने के बाद किसी ने गिटहब पर इस फ़ाइल को बदला है। डेटा ओवरराइट से बचने के लिए नवीनतम संस्करण रीलोड करें।',
  reloadLatest: 'नवीनतम रीलोड करें',
  reviewDiff: 'अंतर देखें',
  unsavedChangesTitle: 'बिना सेव किए गए बदलाव',
  unsavedChangesBody: 'रीलोड करने से आपके स्थानीय बदलाव हट जाएंगे।',
  reload: 'रीलोड',
  settings: 'सेटिंग्स',
  repositories: 'रिपॉज़िटरी',
  switchRepo: 'रिपॉ बदलें',
  disconnect: 'डिस्कनेक्ट करें',
  themeLabel: 'थीम मोड',
  accentLabel: 'डायनामिक एक्सेंट रंग',
  motionLabel: 'एनीमेशन प्राथमिकता',
  languageLabel: 'इंटरफ़ेस भाषा',
  languageNote: 'केवल इंटरफ़ेस लेबल अनुवादित होते हैं। आपकी कॉन्फ़िगरेशन कुंजियाँ और मान कभी नहीं बदले जाते।',
  androidBlueprint: 'नेटिव एंड्रॉइड Kotlin / Compose ब्लूप्रिंट',
  createFileTitle: 'नई कॉन्फ़िगरेशन फ़ाइल बनाएं',
  fileNameLabel: 'फ़ाइल नाम',
  directoryPathLabel: 'डायरेक्टरी पाथ',
  templateLabel: 'प्रारंभिक संरचना',
  createAndCommit: 'बनाएं और कमिट करें',
  offlineBanner: 'इंटरनेट कनेक्शन नहीं — कैश्ड डेटा सक्रिय है। कमिट के लिए नेटवर्क आवश्यक है।',
  undo: 'पूर्ववत करें',
  redo: 'दोहराएं',
  versionHistory: 'इतिहास',
  restoreVersion: 'संस्करण पुनर्स्थापित करें',
  fullscreen: 'फ़ुलस्क्रीन',
  exitFullscreen: 'फ़ुलस्क्रीन बंद करें',
};

const DICTIONARIES: Record<AppLanguage, Translations> = { en: EN, bn: BN, hi: HI };

export function getTranslations(lang: AppLanguage): Translations {
  return DICTIONARIES[lang] || EN;
}
