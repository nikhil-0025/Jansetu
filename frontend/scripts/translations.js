// JanSetu Bilingual Translation Dictionary (English / हिंदी)
const translations = {
  en: {
    // Brand & Common
    portalTitle: 'JanSetu',
    portalHindi: 'जनसेतु',
    tagline: 'Har Parivaar, Har Haq, Ek Setu.',
    ribbonGov: 'भारत सरकार | Government of India — National Welfare Portal',
    ribbonSub: 'Unified Public Documentation & Welfare Integrity',
    
    // Top Navigation
    navHome: 'Home',
    navSchemes: 'All Schemes',
    navApplications: 'My Applications',
    navDocuments: 'My Documents',
    navFamily: 'Family Members',
    navSeparation: 'Household Separation',
    navCorrections: 'Profile Corrections',
    navOfficer: 'Officer Portal',
    navCitizen: 'Citizen Portal',
    navOfficerPortal: 'Officer Verification Portal',
    navLogout: 'Sign Out',
    
    // Main Page Hero
    heroBadge: 'National Public Documentation & Welfare Platform',
    heroTitle: 'Unified Public Documentation & Welfare Verification',
    heroDesc: 'Connecting citizens, family relationships, household accounts, supporting documents, welfare schemes, and government verification workflows with explainable duplicate detection and seamless household separation.',
    heroLaunchCitizen: '1-Click Launch: Citizen Portal (FAM-1001)',
    heroLaunchOfficer: '1-Click Launch: Officer Portal (OFFICER-01)',
    heroPreloadedNote: '✨ Preloaded with Rahul & Amit Sharma household records (Varanasi, UP), active PMAY & PM-KISAN schemes, sample documents, and full audit logs.',
    
    // Main Page Quick Credentials Card
    credTitle: 'Instant Demonstration Credentials',
    credSub: 'Select any role below to launch right into the working demonstration without typing credentials:',
    credCitizenTitle: 'Citizen Family Account',
    credCitizenInfo: 'Family ID: <strong>FAM-1001</strong> • Pass: <strong>citizen123</strong>',
    credCitizenMembers: 'Rahul Sharma (Head), Amit (Brother), Sunita, Aarav',
    credSignIn: 'Sign In',
    credOfficerTitle: 'Government Verification Officer',
    credOfficerInfo: 'Officer ID: <strong>OFFICER-01</strong> • Pass: <strong>officer123</strong>',
    credOfficerRole: 'Block Development & Verification Officer',
    credResetBtn: 'Reset Demo Environment to Clean Pristine Seed State',
    
    // 6 Core Scenarios
    coverageBadge: 'Comprehensive Test Coverage',
    coverageTitle: '6 Core Scenarios Ready For Demonstration',
    coverageDesc: 'Every single public welfare and document workflow is fully implemented end-to-end.',
    scenarioABadge: 'Scenario A (Core Feature)',
    scenarioATitle: 'Household Separation & Family Bond',
    scenarioADesc: 'Amit Sharma requests separation from FAM-1001. Officer reviews and approves: Amit receives new Family ID <strong>FAM-2001</strong>, but his Citizen ID (<strong>CIT-1002</strong>) and biological sibling relationship with Rahul remain completely preserved!',
    scenarioBBadge: 'Scenario B (Core Feature)',
    scenarioBTitle: 'Duplicate Household Benefit Detection',
    scenarioBDesc: 'Household FAM-1001 already received a PMAY Housing grant for Dwelling D-104 in 2023. When an applicant re-applies for PMAY, the explainable engine immediately flags the repeat claim and routes it for authorized officer review.',
    scenarioCBadge: 'Scenario C',
    scenarioCTitle: 'Individual vs Household Schemes',
    scenarioCDesc: 'When siblings apply for PM-KISAN, the system evaluates each brother individually. Rahul (1.2 Ha land) qualifies, while Amit (0 Ha) is evaluated independently on his own credentials without false duplicate fraud flags!',
    scenarioDBadge: 'Scenario D',
    scenarioDTitle: 'Document Vault & Verification',
    scenarioDDesc: 'Citizens upload Ration Cards, Income Certificates, and Land Khatauni records in PDF/PNG format. Officers verify or reject them with mandatory remarks, and the citizen receives real-time status updates.',
    scenarioEBadge: 'Scenario E',
    scenarioETitle: 'Application Tracking & Disbursement',
    scenarioEDesc: 'Complete lifecycle tracking: Draft &rarr; Submitted &rarr; Pending Verification &rarr; Approved / Disbursed with unique tracking IDs (APP-2026-XXX) and immutable audit log snapshots.',
    scenarioFBadge: 'Scenario F',
    scenarioFTitle: 'Profile & Name Corrections',
    scenarioFDesc: 'Citizens lodge name/DOB change requests with supporting evidence. The portal\'s official record updates only upon officer verification, while preserving change history and keeping Citizen IDs stable.',
    
    // Design Distinctions
    distinctionsTitle: 'Core Design Distinctions of JanSetu',
    pillar1Title: 'Family ID vs Citizen ID',
    pillar1Desc: '<strong>Family ID (e.g. FAM-1001)</strong> belongs to the shared household unit. <strong>Citizen ID (e.g. CIT-1001, CIT-1002)</strong> is permanent and stays with the individual across separations.',
    pillar2Title: 'Persistent Family Relationships',
    pillar2Desc: 'Household membership and biological relationships are maintained as independent data models. Brothers remain brothers in the registry even after living under separate roofs.',
    pillar3Title: 'Explainable Duplicate Detection',
    pillar3Desc: 'Never blindly rejects! Transparently explains which rule triggered, which dwelling was matched, and suggests actionable guidance for the human verification officer.',
    pillar4Title: 'JanSetu AI Saathi',
    pillar4Desc: 'Conversational bilingual assistant providing simple English and Hindi guidance on welfare eligibility, documents, and household separation.',
    
    // Footer
    footerTitle: 'JanSetu (जनसेतु) — Har Parivaar, Har Haq, Ek Setu.',
    footerDesc: 'Unified Digital Platform for Accessible Public Documentation & Citizen Welfare',
    footerNote: 'Demonstration platform initialized with synthetic sample data. No real Aadhaar or confidential citizen data collected.',
    
    // Dashboard Specific
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
    // Brand & Common
    portalTitle: 'जनसेतु',
    portalHindi: 'JanSetu',
    tagline: 'हर परिवार, हर हक, एक सेतु।',
    ribbonGov: 'भारत सरकार | Government of India — राष्ट्रीय कल्याणकारी पोर्टल',
    ribbonSub: 'एकीकृत लोक दस्तावेज़ीकरण एवं कल्याणकारी सत्यनिष्ठा',
    
    // Top Navigation
    navHome: 'मुख्य पृष्ठ',
    navSchemes: 'सभी सरकारी योजनाएं',
    navApplications: 'मेरे आवेदन',
    navDocuments: 'मेरे दस्तावेज',
    navFamily: 'परिवार के सदस्य',
    navSeparation: 'परिवार पृथक्करण',
    navCorrections: 'प्रोफाइल सुधार',
    navOfficer: 'अधिकारी पोर्टल',
    navCitizen: 'नागरिक पोर्टल',
    navOfficerPortal: 'अधिकारी सत्यापन पोर्टल',
    navLogout: 'लॉग आउट',
    
    // Main Page Hero
    heroBadge: 'राष्ट्रीय लोक दस्तावेज़ीकरण एवं जनकल्याण मंच',
    heroTitle: 'एकीकृत लोक दस्तावेज़ीकरण एवं कल्याण सत्यापन',
    heroDesc: 'नागरिकों, पारिवारिक संबंधों, पारिवारिक खातों, प्रमाणिक दस्तावेजों, कल्याणकारी योजनाओं और सरकारी सत्यापन प्रक्रियाओं को पारदर्शी डुप्लीकेट पहचान तथा सुगम परिवार पृथक्करण से जोड़ना।',
    heroLaunchCitizen: '1-क्लिक प्रारंभ: नागरिक पोर्टल (FAM-1001)',
    heroLaunchOfficer: '1-क्लिक प्रारंभ: अधिकारी पोर्टल (OFFICER-01)',
    heroPreloadedNote: '✨ राहुल और अमित शर्मा परिवार रिकॉर्ड (वाराणसी, उप्र), सक्रिय पीएमएवाई व पीएम-किसान योजनाएं, नमूना दस्तावेज एवं संपूर्ण ऑडिट लॉग के साथ पूर्व-लोड।',
    
    // Main Page Quick Credentials Card
    credTitle: 'त्वरित प्रदर्शन क्रेडेंशियल्स',
    credSub: 'क्रेडेंशियल टाइप किए बिना लाइव प्रदर्शन शुरू करने हेतु नीचे दी गई कोई भी भूमिका चुनें:',
    credCitizenTitle: 'नागरिक परिवार खाता',
    credCitizenInfo: 'फैमिली आईडी: <strong>FAM-1001</strong> • पासवर्ड: <strong>citizen123</strong>',
    credCitizenMembers: 'राहुल शर्मा (मुखिया), अमित (भाई), सुनीता, आरव',
    credSignIn: 'साइन इन',
    credOfficerTitle: 'सरकारी सत्यापन अधिकारी',
    credOfficerInfo: 'अधिकारी आईडी: <strong>OFFICER-01</strong> • पासवर्ड: <strong>officer123</strong>',
    credOfficerRole: 'प्रखंड विकास एवं सत्यापन अधिकारी',
    credResetBtn: 'डेमो वातावरण को शुद्ध प्रारंभिक स्थिति में रीसेट करें',
    
    // 6 Core Scenarios
    coverageBadge: 'व्यापक परीक्षण कवरेज',
    coverageTitle: '6 मुख्य परिदृश्य प्रदर्शन हेतु तैयार',
    coverageDesc: 'प्रत्येक लोक कल्याण एवं दस्तावेज़ कार्यप्रवाह शुरू से अंत तक पूर्णतः क्रियान्वित है।',
    scenarioABadge: 'परिदृश्य क (मुख्य विशेषता)',
    scenarioATitle: 'परिवार पृथक्करण एवं पारिवारिक संबंध',
    scenarioADesc: 'अमित शर्मा FAM-1001 से पृथक्करण का अनुरोध करता है। अधिकारी समीक्षा कर स्वीकृति देता है: अमित को नई फैमिली आईडी <strong>FAM-2001</strong> मिलती है, परंतु उसकी सिटीजन आईडी (<strong>CIT-1002</strong>) और राहुल के साथ भाई का जैविक संबंध पूरी तरह सुरक्षित रहता है!',
    scenarioBBadge: 'परिदृश्य ख (मुख्य विशेषता)',
    scenarioBTitle: 'डुप्लीकेट परिवार लाभ पहचान',
    scenarioBDesc: 'परिवार FAM-1001 को 2023 में आवास D-104 हेतु पीएमएवाई आवास अनुदान मिल चुका है। जब आवेदक पुनः पीएमएवाई हेतु आवेदन करता है, तो पारदर्शी प्रणाली तुरंत दोहरे दावे को चिन्हित कर सक्षम अधिकारी समीक्षा हेतु भेजती है।',
    scenarioCBadge: 'परिदृश्य ग',
    scenarioCTitle: 'व्यक्तिगत बनाम पारिवारिक योजनाएं',
    scenarioCDesc: 'जब भाई पीएम-किसान हेतु आवेदन करते हैं, प्रणाली प्रत्येक भाई का व्यक्तिगत मूल्यांकन करती है। राहुल (1.2 हे. भूमि) पात्र है, जबकि अमित (0 हे.) का स्वतंत्र मूल्यांकन होता है बिना किसी अनुचित फर्जीवाड़े के संकेत के!',
    scenarioDBadge: 'परिदृश्य घ',
    scenarioDTitle: 'दस्तावेज वॉल्ट एवं सत्यापन',
    scenarioDDesc: 'नागरिक राशन कार्ड, आय प्रमाण पत्र व खतौनी रिकॉर्ड पीडीएफ/पीएनजी प्रारूप में अपलोड करते हैं। अधिकारी अनिवार्य टिप्पणी के साथ सत्यापित या अस्वीकृत करते हैं और नागरिक को त्वरित अपडेट प्राप्त होते हैं।',
    scenarioEBadge: 'परिदृश्य ङ',
    scenarioETitle: 'आवेदन ट्रैकिंग एवं संवितरण',
    scenarioEDesc: 'संपूर्ण जीवनचक्र ट्रैकिंग: ड्राफ्ट &rarr; जमा &rarr; सत्यापन लंबित &rarr; स्वीकृत / संवितरित, विशिष्ट ट्रैकिंग आईडी (APP-2026-XXX) एवं अपरिवर्तनीय ऑडिट लॉग स्नैपशॉट के साथ।',
    scenarioFBadge: 'परिदृश्य च',
    scenarioFTitle: 'प्रोफाइल एवं नाम सुधार',
    scenarioFDesc: 'नागरिक प्रमाण सहित नाम/जन्मतिथि परिवर्तन अनुरोध दर्ज करते हैं। अधिकारी सत्यापन के बाद ही आधिकारिक रिकॉर्ड अद्यतित होता है, जिसमें इतिहास सुरक्षित रहता है और सिटीजन आईडी स्थिर रहती है।',
    
    // Design Distinctions
    distinctionsTitle: 'जनसेतु की प्रमुख संरचनात्मक विशेषताएं',
    pillar1Title: 'फैमिली आईडी बनाम सिटीजन आईडी',
    pillar1Desc: '<strong>फैमिली आईडी (उदा. FAM-1001)</strong> संयुक्त पारिवारिक इकाई की होती है। <strong>सिटीजन आईडी (उदा. CIT-1001, CIT-1002)</strong> स्थायी होती है और परिवार अलग होने पर भी व्यक्ति के साथ रहती है।',
    pillar2Title: 'स्थायी पारिवारिक संबंध',
    pillar2Desc: 'पारिवारिक सदस्यता और जैविक संबंध स्वतंत्र डेटा मॉडल के रूप में संरक्षित रहते हैं। अलग रहने के बाद भी पंजी में भाई हमेशा भाई ही दर्ज रहते हैं।',
    pillar3Title: 'स्पष्ट व्याख्यात्मक डुप्लीकेट पहचान',
    pillar3Desc: 'कभी अंधाधुंध अस्वीकार नहीं करता! पारदर्शी ढंग से बताता है कि कौन सा नियम लागू हुआ, किस आवास का मिलान हुआ, और सत्यापन अधिकारी को आवश्यक मार्गदर्शन देता है।',
    pillar4Title: 'जनसेतु एआई साथी',
    pillar4Desc: 'द्विभाषी संवादात्मक सहायक जो कल्याणकारी पात्रता, दस्तावेजों और परिवार पृथक्करण पर सरल हिंदी व अंग्रेजी में मार्गदर्शन प्रदान करता है।',
    
    // Footer
    footerTitle: 'जनसेतु (JanSetu) — हर परिवार, हर हक, एक सेतु।',
    footerDesc: 'सुलभ लोक दस्तावेज़ीकरण एवं नागरिक कल्याण हेतु एकीकृत डिजिटल मंच',
    footerNote: 'प्रदर्शन हेतु कृत्रिम नमूना डेटा के साथ मंच प्रारंभ किया गया है। कोई वास्तविक आधार या गोपनीय नागरिक डेटा एकत्र नहीं किया जाता है।',
    
    // Dashboard Specific
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
  if (!translations[lang]) lang = 'en';
  currentLanguage = lang;
  localStorage.setItem('jansetu_lang', lang);

  // Translate text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang] && translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });

  // Translate rich HTML content
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (translations[lang] && translations[lang][key]) {
      el.innerHTML = translations[lang][key];
    }
  });

  // Translate placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[lang] && translations[lang][key]) {
      el.placeholder = translations[lang][key];
    }
  });

  // Translate titles
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (translations[lang] && translations[lang][key]) {
      el.title = translations[lang][key];
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

  // Re-initialize Lucide icons if any were in translated elements
  if (window.lucide && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

// Auto-initialize on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setLanguage(currentLanguage);
  });
} else {
  setLanguage(currentLanguage);
}
