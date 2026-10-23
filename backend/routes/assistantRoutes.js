const express = require('express');
const router = express.Router();
const dataStore = require('../models/dataStore');

// Knowledge base for JanSetu AI Saathi
const knowledgeBase = [
  {
    keywords: ['pmay', 'housing', 'awas', 'आवास', 'मकान', 'घर'],
    en: 'Pradhan Mantri Awas Yojana - Gramin (PMAY-G) provides ₹1,20,000 for constructing a pucca dwelling for households currently living in kutcha/dilapidated homes. Required documents include: Ration Card, Income Certificate, and Residence Proof. Note: This is a household-level benefit, strictly limited to one benefit per dwelling unit.',
    hi: 'प्रधानमंत्री आवास योजना - ग्रामीण (PMAY-G) कच्चे या जीर्ण-शीर्ण मकानों में रहने वाले परिवारों को पक्का मकान बनाने हेतु ₹1,20,000 की वित्तीय सहायता प्रदान करती है। आवश्यक दस्तावेज: राशन कार्ड, आय प्रमाण पत्र और निवास प्रमाण। नोट: यह पारिवारिक लाभ है, प्रति आवास इकाई केवल एक बार देय है।'
  },
  {
    keywords: ['kisan', 'farmer', 'land', 'किसान', 'खेती', 'भूमि', 'pm-kisan'],
    en: 'PM-KISAN provides direct income support of ₹6,000 per year in three installments (₹2,000 each) directly into Aadhaar-linked bank accounts of landholding farmers. Required documents: Land Ownership Record (Khatauni) and Income Certificate. This is evaluated as an Individual-level benefit based on land ownership.',
    hi: 'पीएम-किसान योजना के तहत भूधारक किसानों को ₹6,000 प्रति वर्ष (₹2,000 की तीन किस्तों में) सीधे आधार-लिंक्ड बैंक खाते में दिए जाते हैं। आवश्यक दस्तावेज: खतौनी (भूमि अभिलेख) और आय प्रमाण पत्र। यह व्यक्तिगत स्तर पर भूमि स्वामित्व के आधार पर मूल्यांकित होता है।'
  },
  {
    keywords: ['ayushman', 'health', 'hospital', 'doctor', 'आयुष्मान', 'स्वास्थ्य', 'इलाज', 'pm-jay'],
    en: 'Ayushman Bharat PM-JAY offers cashless health cover of up to ₹5,00,000 per family per year for secondary and tertiary hospitalization across empaneled hospitals. Eligible households include those listed under SECC/BPL category. Required documents: Ration Card and Income Certificate.',
    hi: 'आयुष्मान भारत PM-JAY योजना के अंतर्गत पात्र परिवारों को प्रति वर्ष ₹5 लाख तक का कैशलेस स्वास्थ्य बीमा मिलता है। इसके लिए राशन कार्ड और सत्यापित आय प्रमाण पत्र आवश्यक हैं।'
  },
  {
    keywords: ['separation', 'split', 'separate', 'विभाजन', 'बंटवारा', 'अलग', 'परिवार अलग'],
    en: 'Household Separation (Parivaar Vibhajan) allows members forming a separate kitchen or residing at a new independent address to register a distinct household. Steps: 1. Go to Family Management, 2. Click "Request Household Separation", 3. Select moving members and new address, 4. Upload separation agreement. Upon officer verification, a new Family ID (e.g. FAM-2001) will be issued. Citizen IDs and family relationships (like brother or father) remain intact!',
    hi: 'परिवार पृथक्करण (Household Separation) के माध्यम से अलग चूल्हा या नए पते पर रहने वाले सदस्य नया परिवार पंजीकृत करा सकते हैं। चरण: 1. परिवार प्रबंधन में जाएं, 2. "परिवार पृथक्करण अनुरोध" चुनें, 3. अलग होने वाले सदस्यों व नए पते का चयन करें, 4. शपथ पत्र अपलोड करें। अधिकारी के सत्यापन के बाद नई फैमिली आईडी जारी होगी, जबकि सिटीजन आईडी और पारिवारिक रिश्ते हमेशा सुरक्षित रहेंगे।'
  },
  {
    keywords: ['id', 'difference', 'family id', 'citizen id', 'आईडी', 'अंतर'],
    en: 'In JanSetu: 1. Family ID (e.g. FAM-1001) represents the household/dwelling account shared by currently residing members. 2. Citizen ID (e.g. CIT-1001, CIT-1002) is a permanent individual identifier that never changes even if you move to a new household. Sibling and parental relationships remain tied to your Citizen ID forever.',
    hi: 'जनसेतु में: 1. फैमिली आईडी (जैसे FAM-1001) उस संयुक्त आवास/परिवार की होती है जिसमें सदस्य वर्तमान में रहते हैं। 2. सिटीजन आईडी (जैसे CIT-1001, CIT-1002) प्रत्येक व्यक्ति की स्थायी पहचान है, जो परिवार अलग होने पर भी कभी नहीं बदलती। भाई-बहन या माता-पिता के रिश्ते हमेशा सुरक्षित रहते हैं।'
  },
  {
    keywords: ['duplicate', 'flag', 'fraud', 'डुप्लीकेट', 'दोहरा लाभ'],
    en: 'Duplicate Benefit Detection warns when two applications or benefits overlap for the same household or physical dwelling structure. A duplicate flag is not proof of fraud; it simply routes the application to an authorized government officer for manual review and physical verification.',
    hi: 'डुप्लीकेट लाभ जांच तब चेतावनी देती है जब एक ही परिवार या एक ही मकान (Dwelling) पर एक से अधिक आवेदन पाए जाते हैं। यह धोखाधड़ी का प्रमाण नहीं है, बल्कि अधिकारी द्वारा मानवीय सत्यापन हेतु भेजा जाता है।'
  },
  {
    keywords: ['document', 'upload', 'verify', 'दस्तावेज', 'प्रमाण पत्र'],
    en: 'You can upload supporting documents in the "My Documents" section in PDF, JPG, or PNG format (up to 5MB). Once uploaded, your documents are queued for verification by the Block Verification Officer.',
    hi: 'आप "मेरे दस्तावेज" अनुभाग में PDF, JPG या PNG प्रारूप (अधिकतम 5MB) में दस्तावेज अपलोड कर सकते हैं। अपलोड के बाद ब्लॉक सत्यापन अधिकारी द्वारा जांच की जाती है।'
  }
];

// POST /api/assistant/chat
router.post('/chat', (req, res) => {
  const { message, lang } = req.body;
  const isHindi = lang === 'hi' || /[\u0900-\u097F]/.test(message || '');

  if (!message || message.trim() === '') {
    return res.json({
      success: true,
      mode: 'Rule-Based Demo Assistant (JanSetu AI Saathi)',
      reply: isHindi 
        ? 'नमस्ते! मैं जनसेतु सहायक हूँ। आप मुझसे सरकारी योजनाओं, पात्रता, परिवार पृथक्करण या आवश्यक दस्तावेजों के बारे में पूछ सकते हैं।' 
        : 'Hello! I am JanSetu Saathi. Ask me about government welfare schemes, eligibility rules, household separation, or required documents.'
    });
  }

  const query = message.toLowerCase();
  let matched = null;

  for (const entry of knowledgeBase) {
    if (entry.keywords.some(kw => query.includes(kw.toLowerCase()))) {
      matched = entry;
      break;
    }
  }

  let reply = '';
  if (matched) {
    reply = isHindi ? matched.hi : matched.en;
  } else {
    reply = isHindi
      ? `माफ़ कीजिये, मैं आपके प्रश्न को पूरी तरह समझ नहीं सका। आप मुझसे PMAY आवास योजना, पीएम-किसान, आयुष्मान भारत, परिवार पृथक्करण (Household Separation) या फैमिली आईडी व सिटीजन आईडी के अंतर के बारे में पूछ सकते हैं। (डेमो मोड)`
      : `I am a rule-based demo assistant. I can guide you on PMAY Housing, PM-KISAN, Ayushman Bharat, Household Separation, or the difference between Family ID and Citizen ID. Please try asking about these topics.`;
  }

  res.json({
    success: true,
    mode: 'Rule-Based Demo Assistant (JanSetu AI Saathi)',
    disclaimer: 'This is a demonstration AI assistant. Official decisions are rendered exclusively by authorized government verification officers.',
    reply
  });
});

module.exports = router;
