// JanSetu Bilingual Translation Dictionary (English / हिंदी)
const translations = {
  en: {
    portalTitle: 'JanSetu',
    portalHindi: 'जनसेतु',
    tagline: 'Har Parivaar, Har Haq, Ek Setu.',
    navHome: 'Home',
    navSchemes: 'All Schemes',
    navApplications: 'My Applications',
    navDocuments: 'My Documents',
    navFamily: 'Family Members',
    navSeparation: 'Household Separation',
    navCorrections: 'Profile Corrections',
    navOfficer: 'Officer Portal',
    navLogout: 'Sign Out',
    welcomeBack: 'Welcome back,',
    familyIdLabel: 'Family ID (Household):',
    citizenIdLabel: 'Citizen ID (Individual):',
    dwellingLabel: 'Dwelling Ref:',
    statusVerified: 'Verified Household',
    statusPending: 'Pending Verification',
    quickAccessTitle: 'Quick Access Services',
    eligibleSchemes: 'Eligible Schemes For Your Household',
    recentApplications: 'Recent Applications & Benefits',
    pendingDocs: 'Pending Document Verifications',
    btnApply: 'Apply Now',
    btnDetails: 'View Details',
    btnCheckElig: 'Check Eligibility',
    btnSeparation: 'Request Household Separation',
    btnUploadDoc: 'Upload New Document',
    btnResetDemo: 'Reset Demo State',
    btnAssistant: 'JanSetu AI Saathi',
    searchPlaceholder: 'Search welfare schemes, documents, or applications...',
    officerDashboardTitle: 'JanSetu Government Verification Portal',
    officerDesignation: 'Block Verification & Welfare Officer'
  },
  hi: {
    portalTitle: 'जनसेतु',
    portalHindi: 'JanSetu',
    tagline: 'हर परिवार, हर हक, एक सेतु।',
    navHome: 'मुख्य पृष्ठ',
    navSchemes: 'सभी सरकारी योजनाएं',
    navApplications: 'मेरे आवेदन',
    navDocuments: 'मेरे दस्तावेज',
    navFamily: 'परिवार के सदस्य',
    navSeparation: 'परिवार पृथक्करण',
    navCorrections: 'प्रोफाइल सुधार',
    navOfficer: 'अधिकारी पोर्टल',
    navLogout: 'लॉग आउट',
    welcomeBack: 'स्वागत है,',
    familyIdLabel: 'फैमिली आईडी (परिवार):',
    citizenIdLabel: 'सिटीजन आईडी (व्यक्तिगत):',
    dwellingLabel: 'आवास संदर्भ:',
    statusVerified: 'सत्यापित परिवार',
    statusPending: 'सत्यापन प्रक्रियाधीन',
    quickAccessTitle: 'त्वरित सेवाएं',
    eligibleSchemes: 'आपके परिवार हेतु पात्र योजनाएं',
    recentApplications: 'हालिया आवेदन एवं लाभ स्थिति',
    pendingDocs: 'सत्यापन हेतु लंबित दस्तावेज',
    btnApply: 'आवेदन करें',
    btnDetails: 'विवरण देखें',
    btnCheckElig: 'पात्रता जांचें',
    btnSeparation: 'परिवार पृथक्करण अनुरोध',
    btnUploadDoc: 'नया दस्तावेज अपलोड करें',
    btnResetDemo: 'डेमो डेटा रीसेट करें',
    btnAssistant: 'जनसेतु एआई साथी',
    searchPlaceholder: 'योजनाएं, दस्तावेज या आवेदन खोजें...',
    officerDashboardTitle: 'जनसेतु सरकारी सत्यापन पोर्टल',
    officerDesignation: 'प्रखंड सत्यापन एवं कल्याण अधिकारी'
  }
};

let currentLanguage = localStorage.getItem('jansetu_lang') || 'en';

function setLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('jansetu_lang', lang);

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[lang] && translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });

  // Update active state on toggle buttons
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.getAttribute('data-lang') === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setLanguage(currentLanguage);
});
