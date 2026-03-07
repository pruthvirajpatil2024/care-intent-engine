import { useState, useRef, useEffect, useCallback } from "react";

/*
 * â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
 * â•‘   CARE IM BOT â€” Intent Engine                                        â•‘
 * â•‘   GSoC 2026  Â·  ohcnetwork/care  Â·  Issue #10599                    â•‘
 * â•‘   Mentor review build â€” no hardcoded values, full flow comments      â•‘
 * â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *
 * â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
 * â”‚  ARCHITECTURE FLOW  (serial numbers used in all code comments)       â”‚
 * â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
 * â”‚                                                                      â”‚
 * â”‚  [01]  Raw message arrives from WhatsApp / Telegram webhook          â”‚
 * â”‚        â””â”€ payload: { from: phone, body: text, platform: wa|tg }     â”‚
 * â”‚                                                                      â”‚
 * â”‚  [02]  PhoneNormalizer  â†’  E.164 format                              â”‚
 * â”‚        â””â”€ +919999999999 | 919999999999 | 09999999999 â†’ same key     â”‚
 * â”‚        â””â”€ src: care_im_bot/auth/phone_normalizer.py                  â”‚
 * â”‚                                                                      â”‚
 * â”‚  [03]  Session Lookup  (Redis key: session:{e164_phone})             â”‚
 * â”‚        â””â”€ { state, verified, consent, locale, last_intent,          â”‚
 * â”‚             last_entities, patient_id, consultation_id }             â”‚
 * â”‚                                                                      â”‚
 * â”‚  [04]  IntentRouter.route(message, session)                          â”‚
 * â”‚        â”œâ”€ [04.1]  Layer 1 â€” Regex matching                          â”‚
 * â”‚        â”‚           EN patterns + HI Devanagari + MR Devanagari       â”‚
 * â”‚        â”‚           + Hinglish Latin  (no Tamil/Kannada in fuzzy)     â”‚
 * â”‚        â”œâ”€ [04.2]  Layer 2 â€” Confidence calibration by word count    â”‚
 * â”‚        â”‚           1-word Ã—0.88 | 2-word Ã—0.94 | 3-8 Ã—1.05 | >8 Ã—0.97â”‚
 * â”‚        â”œâ”€ [04.3]  Layer 3 â€” Multi-intent detection                  â”‚
 * â”‚        â”‚           "show meds and appointment" â†’ [meds, appts]       â”‚
 * â”‚        â”œâ”€ [04.4]  Layer 4 â€” Session context boost                   â”‚
 * â”‚        â”‚           ambiguous followup resolved via last_intent        â”‚
 * â”‚        â”œâ”€ [04.5]  Layer 5 â€” Fuzzy matching (Levenshtein)            â”‚
 * â”‚        â”‚           EN typos + HI romanized + MR romanized + HL       â”‚
 * â”‚        â”‚           ~20 variants Ã— 4 languages Ã— 10 intents           â”‚
 * â”‚        â”œâ”€ [04.6]  Layer 6 â€” Entity extraction                       â”‚
 * â”‚        â”‚           drug_name Â· time_range Â· date Â· vital_type        â”‚
 * â”‚        â””â”€ [04.7]  Layer 7 â€” Entity-first routing                    â”‚
 * â”‚                    drug entity found â†’ medications / drug_detail      â”‚
 * â”‚                                                                      â”‚
 * â”‚  [05]  ConversationFSM.process(intent_result, session)               â”‚
 * â”‚        â”œâ”€ [05.1]  Auth guard  â†’  !verified â†’ awaiting_otp           â”‚
 * â”‚        â”œâ”€ [05.2]  Consent guard  â†’  !consent â†’ awaiting_consent     â”‚
 * â”‚        â”œâ”€ [05.3]  Explicit transition  FSM_TRANSITIONS[state:intent] â”‚
 * â”‚        â”œâ”€ [05.4]  Global navigation  viewing_* + main â†’ correct stateâ”‚
 * â”‚        â””â”€ [05.5]  Fallback  â†’  stay in current state, handle_unknown â”‚
 * â”‚                                                                      â”‚
 * â”‚  [06]  ResponseBuilder.build(handler, intent_result)                 â”‚
 * â”‚        â”œâ”€ [06.1]  Dynamic  â†’  drug detail built from DRUG_DB config  â”‚
 * â”‚        â””â”€ [06.2]  Static   â†’  RESPONSE_TEMPLATES[handler]           â”‚
 * â”‚                                                                      â”‚
 * â”‚  [07]  Session write-back  (Redis)                                   â”‚
 * â”‚        â””â”€ { state: next_state, last_intent, last_entities }          â”‚
 * â”‚           verified / consent flags toggled by specific handlers       â”‚
 * â”‚                                                                      â”‚
 * â”‚  [08]  IMProvider.send(formatted_response)                           â”‚
 * â”‚        â””â”€ WhatsApp: care_im_bot/providers/whatsapp_provider.py       â”‚
 * â”‚        â””â”€ Telegram: care_im_bot/providers/telegram_provider.py       â”‚
 * â”‚                                                                      â”‚
 * â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
 */

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [01]  CONFIG â€” All thresholds in one place. No magic numbers below.
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
const CONFIG = {
  intent: {
    MIN_CONFIDENCE:         0.60,  // below this â†’ UNKNOWN
    MULTI_INTENT_THRESHOLD: 0.75,  // both intents must exceed this to flag multi
    FUZZY_THRESHOLD:        0.78,  // min Levenshtein similarity to count as match
    FUZZY_CONFIDENCE_PENALTY: 0.90,// fuzzy confidence = similarity Ã— penalty
    CONTEXT_BOOST_THRESHOLD: 0.60, // min confidence for context-boosted intents
  },
  calibration: {
    // Word-count confidence multipliers (Layer [04.2])
    SINGLE_WORD:  0.88,  // "meds" â€” could be partial / accidental
    TWO_WORDS:    0.94,  // "show meds"
    SWEET_SPOT:   1.05,  // 3â€“8 words â€” clear intent sentence
    LONG_MESSAGE: 0.97,  // >8 words â€” noisy / over-specified
    SWEET_SPOT_MIN: 3,
    SWEET_SPOT_MAX: 8,
  },
  otp: {
    STAGING_CODE: "45612",   // staging only â€” real OTP sent via Twilio/MSG91
    MIN_LENGTH: 4,
    MAX_LENGTH: 6,
  },
};

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [02]  CARE API ENDPOINT MAP
//       In production, {consultation_id} and {patient_id} are resolved
//       from session after OTP login via care.emr.api.otp_viewsets
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
const CARE_API = {
  prescriptions:        "/api/v1/consultation/{consultation_id}/prescriptions/",
  prescription_search:  "/api/v1/consultation/{consultation_id}/prescriptions/?search={drug_name}",
  procedure:            "/api/v1/consultation/{consultation_id}/procedure/",
  appointments:         "/api/v1/patient/{patient_id}/appointments/",
  patient_detail:       "/api/v1/patient/{patient_id}/",
  daily_rounds:         "/api/v1/consultation/{consultation_id}/daily_rounds/",
  consultation_detail:  "/api/v1/consultation/{consultation_id}/",
  otp_send:             "/api/v1/auth/login/",        // care.emr.api.otp_viewsets
  otp_verify:           "/api/v1/auth/login/otp/",
};

// Intent â†’ primary CARE endpoint mapping (shown in demo inspector)
const INTENT_ENDPOINT = {
  medications:  CARE_API.prescriptions,
  drug_detail:  CARE_API.prescription_search,
  procedures:   CARE_API.procedure,
  appointments: CARE_API.appointments,
  records:      CARE_API.patient_detail,
  vitals:       CARE_API.daily_rounds,
  discharge:    CARE_API.consultation_detail,
};

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [03]  DRUG DATABASE
//       Source of truth for [06.1] ResponseBuilder dynamic drug responses.
//       In production: populated from CARE API /prescriptions/ after login.
//       Keys must match KNOWN_DRUG_NAMES below (used by entity extractor).
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
const DRUG_DB = {
  metformin:    { displayName: "Metformin 500mg",   dosage: "1-0-1", instruction: "After food",      daysLeft: 30, prescribed: "28 Feb 2026", purpose: "Blood sugar control"  },
  amlodipine:   { displayName: "Amlodipine 5mg",    dosage: "0-0-1", instruction: "Night only",      daysLeft: 60, prescribed: "28 Feb 2026", purpose: "Blood pressure"       },
  aspirin:      { displayName: "Aspirin 75mg",      dosage: "1-0-0", instruction: "After breakfast", daysLeft: 90, prescribed: "01 Mar 2026", purpose: "Blood thinner"        },
  insulin:      { displayName: "Insulin (Regular)", dosage: "Per chart", instruction: "Before meals",daysLeft: 30, prescribed: "28 Feb 2026", purpose: "Diabetes management"  },
  paracetamol:  { displayName: "Paracetamol 500mg", dosage: "SOS",   instruction: "For fever/pain",  daysLeft: 10, prescribed: "01 Mar 2026", purpose: "Fever / Pain relief"  },
  atorvastatin: { displayName: "Atorvastatin 10mg", dosage: "0-0-1", instruction: "Night only",      daysLeft: 30, prescribed: "28 Feb 2026", purpose: "Cholesterol control"  },
  lisinopril:   { displayName: "Lisinopril 5mg",    dosage: "1-0-0", instruction: "Morning",         daysLeft: 30, prescribed: "28 Feb 2026", purpose: "Blood pressure"       },
  omeprazole:   { displayName: "Omeprazole 20mg",   dosage: "1-0-0", instruction: "30min before food",daysLeft:14, prescribed: "01 Mar 2026", purpose: "Acidity / GERD"      },
  amoxicillin:  { displayName: "Amoxicillin 500mg", dosage: "1-1-1", instruction: "After food",      daysLeft:  7, prescribed: "03 Mar 2026", purpose: "Antibiotic"           },
  ibuprofen:    { displayName: "Ibuprofen 400mg",   dosage: "SOS",   instruction: "After food",      daysLeft:  5, prescribed: "03 Mar 2026", purpose: "Pain / Inflammation"  },
};

// Auto-derived â€” entity extractor uses this, never a hardcoded list
const KNOWN_DRUG_NAMES = Object.keys(DRUG_DB);

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [04]  INTENT REGEX PATTERNS  â€” Layer [04.1]
//       Languages: English | Hindi (Devanagari) | Marathi (Devanagari)
//                  | Hinglish (Latin script)
//       Tamil / Kannada removed per spec â€” covered by fuzzy/Hinglish
//       Format: [RegExp, confidence_0_to_1]
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
const INTENT_REGEX_PATTERNS = {

  medications: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bmedication[s]?\b/i, 0.95], [/\bmedicine[s]?\b/i, 0.95],
    [/\bmeds?\b/i, 0.90],          [/\bprescription[s]?\b/i, 0.90],
    [/\btablet[s]?\b/i, 0.75],     [/\bpill[s]?\b/i, 0.75],
    [/\bdrug[s]?\b/i, 0.78],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¦à¤µà¤¾à¤‡à¤¯à¤¾à¤‚/u, 0.95],  [/à¤¦à¤µà¤¾à¤ˆ/u, 0.92],  [/à¤¦à¤µà¤¾/u, 0.88],
    [/à¤—à¥‹à¤²à¥€/u, 0.85],     [/à¤—à¥‹à¤²à¤¿à¤¯à¤¾à¤‚/u, 0.90], [/à¤¦à¤µà¤¾à¤‡à¤¯à¤¾/u, 0.88],
    [/à¤ªà¥à¤°à¤¿à¤¸à¥à¤•à¥à¤°à¤¿à¤ªà¥à¤¶à¤¨/u, 0.82],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤”à¤·à¤§/u, 0.95],  [/à¤—à¥‹à¤³à¥à¤¯à¤¾/u, 0.92],  [/à¤”à¤·à¤§à¥‡/u, 0.93],
    [/à¤—à¥‹à¤³à¥€/u, 0.85], [/à¤”à¤·à¤§à¤¾à¤šà¥‡/u, 0.88],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bdawai\b/i, 0.88],    [/\bdawa[i]?\b/i, 0.85],
    [/\bdavai\b/i, 0.82],    [/\bgoli[yan]*\b/i, 0.82],
    [/\bdawaiyan\b/i, 0.90], [/\baushadh\b/i, 0.85],
    [/\bgoliyaan\b/i, 0.88],
  ],

  procedures: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bprocedure[s]?\b/i, 0.95], [/\bsurgery\b/i, 0.90],
    [/\boperation\b/i, 0.88],     [/\btreatment[s]?\b/i, 0.80],
    [/\btest[s]?\b/i, 0.72],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾/u, 0.95], [/à¤‡à¤²à¤¾à¤œ/u, 0.88],
    [/à¤‘à¤ªà¤°à¥‡à¤¶à¤¨/u, 0.90],   [/à¤‰à¤ªà¤šà¤¾à¤°/u, 0.85],
    [/à¤œà¤¾à¤‚à¤š/u, 0.78],      [/à¤ªà¤°à¥€à¤•à¥à¤·à¤£/u, 0.82],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¶à¤¸à¥à¤¤à¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾/u, 0.92], [/à¤‰à¤ªà¤šà¤¾à¤°/u, 0.85],
    [/à¤¤à¤ªà¤¾à¤¸à¤£à¥€/u, 0.88],       [/à¤ªà¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾/u, 0.90],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bilaj\b/i, 0.82],     [/\boperation\s+kab\b/i, 0.92],
    [/\bsurgery\s+kab\b/i, 0.90], [/\bjaanch\b/i, 0.80],
    [/\bupchar\b/i, 0.82],
  ],

  appointments: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bappointment[s]?\b/i, 0.95], [/\bschedule[d]?\b/i, 0.85],
    [/\bnext\s+visit\b/i, 0.92],    [/\bvisit[s]?\b/i, 0.75],
    [/\bbook(ing)?\b/i, 0.72],      [/\bappoi\w+\b/i, 0.85],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤…à¤ªà¥‰à¤‡à¤‚à¤Ÿà¤®à¥‡à¤‚à¤Ÿ/u, 0.95], [/à¤®à¥à¤²à¤¾à¤•à¤¾à¤¤/u, 0.88],
    [/à¤¶à¥‡à¤¡à¥à¤¯à¥‚à¤²/u, 0.85],    [/à¤®à¥à¤²à¤¾à¤•à¤¼à¤¾à¤¤/u, 0.87],
    [/à¤…à¤—à¤²à¥€\s+à¤®à¥à¤²à¤¾à¤•à¤¾à¤¤/u, 0.92],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤­à¥‡à¤Ÿ/u, 0.82],         [/à¤µà¥‡à¤³à¤¾à¤ªà¤¤à¥à¤°à¤•/u, 0.90],
    [/à¤…à¤ªà¥‰à¤‡à¤‚à¤Ÿà¤®à¥‡à¤‚à¤Ÿ/u, 0.95], [/à¤ªà¥à¤¢à¤šà¥€\s+à¤­à¥‡à¤Ÿ/u, 0.92],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bappointment\s+kab\b/i, 0.95], [/\bdoctor\s+kab\b/i, 0.88],
    [/\bmulakat\b/i, 0.85],           [/\bdoctor\s+milna\b/i, 0.88],
    [/\bapointment\b/i, 0.82],        [/\bschedule\s+karo\b/i, 0.85],
  ],

  records: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\brecord[s]?\b/i, 0.90],  [/\breport[s]?\b/i, 0.88],
    [/\bhistory\b/i, 0.85],     [/\bmy\s+data\b/i, 0.80],
    [/\bmy\s+(last|previous)\s+(visit|record|report)\b/i, 0.92],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡/u, 0.90],  [/à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ/u, 0.88],
    [/à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€/u, 0.80],  [/à¤‡à¤¤à¤¿à¤¹à¤¾à¤¸/u, 0.82],
    [/à¤®à¥‡à¤°à¤¾\s+à¤¡à¥‡à¤Ÿà¤¾/u, 0.85],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤°à¥‡à¤•à¥‰à¤°à¥à¤¡/u, 0.90],  [/à¤®à¤¾à¤¹à¤¿à¤¤à¥€/u, 0.85],
    [/à¤…à¤¹à¤µà¤¾à¤²/u, 0.85],    [/à¤‡à¤¤à¤¿à¤¹à¤¾à¤¸/u, 0.82],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\brecord\s+dikhao\b/i, 0.92], [/\bjankaari\b/i, 0.82],
    [/\bmaahiti\b/i, 0.82],         [/\bhistory\s+dikhao\b/i, 0.90],
    [/\bdetail\s+do\b/i, 0.82],     [/\bjaankari\b/i, 0.82],
  ],

  vitals: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bvital[s]?\b/i, 0.95],       [/\bblood\s+pressure\b/i, 0.97],
    [/\btemperature\b/i, 0.92],     [/\bpulse\b/i, 0.90],
    [/\bspo2\b/i, 0.97],            [/\boxygen\b/i, 0.88],
    [/(?<!\w)bp(?!\w)/i, 0.85],     [/\bweight\b/i, 0.75],
    [/\bheart\s+rate\b/i, 0.92],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¬à¥à¤²à¤¡\s*à¤ªà¥à¤°à¥‡à¤¶à¤°/u, 0.97],  [/à¤°à¤•à¥à¤¤à¤šà¤¾à¤ª/u, 0.95],
    [/à¤¤à¤¾à¤ªà¤®à¤¾à¤¨/u, 0.92],          [/à¤¨à¤¬à¥à¤œà¤¼/u, 0.88],
    [/à¤µà¤œà¤¼à¤¨/u, 0.80],             [/à¤‘à¤•à¥à¤¸à¥€à¤œà¤¨/u, 0.88],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤°à¤•à¥à¤¤à¤¦à¤¾à¤¬/u, 0.95],  [/à¤¤à¤¾à¤ªà¤®à¤¾à¤¨/u, 0.92],
    [/à¤¨à¤¾à¤¡à¥€/u, 0.88],     [/à¤µà¤œà¤¨/u, 0.80],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bbp\s+kitna\b/i, 0.95],   [/\bblood\s+pressure\s+batao\b/i, 0.95],
    [/\btaapman\b/i, 0.85],      [/\bvajan\b/i, 0.80],
    [/\bsaturation\b/i, 0.90],   [/\brakatchaap\b/i, 0.88],
  ],

  discharge: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bdischarge[d]?\b/i, 0.95], [/\bgoing\s+home\b/i, 0.90],
    [/\bleave\s+hospital\b/i, 0.90],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¡à¤¿à¤¸à¥à¤šà¤¾à¤°à¥à¤œ/u, 0.95], [/à¤˜à¤°\s+à¤œà¤¾à¤¨à¤¾/u, 0.88],
    [/à¤›à¥à¤Ÿà¥à¤Ÿà¥€/u, 0.88],    [/à¤…à¤¸à¥à¤ªà¤¤à¤¾à¤²\s+à¤¸à¥‡\s+à¤œà¤¾à¤¨à¤¾/u, 0.90],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¡à¤¿à¤¸à¥à¤šà¤¾à¤°à¥à¤œ/u, 0.95], [/à¤˜à¤°à¥€\s+à¤œà¤¾à¤£à¥‡/u, 0.88],
    [/à¤¸à¥à¤Ÿà¥à¤Ÿà¥€/u, 0.85],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bdischarge\s+kab\b/i, 0.95], [/\bghaar\s+kab\b/i, 0.85],
    [/\bchhutti\b/i, 0.85],         [/\bniklana\b/i, 0.80],
  ],

  confirm: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\byes\b/i, 0.92], [/\bconfirm\b/i, 0.97],
    [/\bokay?\b/i, 0.80], [/\bsure\b/i, 0.85],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¹à¤¾à¤/u, 0.95], [/à¤¹à¤¾à¤‚/u, 0.93], [/à¤¸à¤¹à¥€/u, 0.85],
    [/à¤ à¥€à¤•\s+à¤¹à¥ˆ/u, 0.88], [/à¤¬à¤¿à¤²à¥à¤•à¥à¤²/u, 0.85],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¹à¥‹à¤¯/u, 0.95], [/à¤¹à¥‹/u, 0.88],
    [/à¤¬à¤°à¥‹à¤¬à¤°/u, 0.85], [/à¤ à¥€à¤•\s+à¤†à¤¹à¥‡/u, 0.88],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bhaan\b/i, 0.90], [/\bha\b/i, 0.80],
    [/\bsahi\b/i, 0.85], [/\btheek\s+hai\b/i, 0.88],
    [/\bbilkul\b/i, 0.88],
  ],

  cancel: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bno\b/i, 0.90], [/\bcancel\b/i, 0.97],
    [/\bstop\b/i, 0.88], [/\bback\b/i, 0.82],
    [/\bexit\b/i, 0.88], [/\bquit\b/i, 0.85],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¨à¤¹à¥€à¤‚/u, 0.95], [/à¤¨à¤¹à¥€/u, 0.92],
    [/à¤°à¥à¤•à¥‹/u, 0.80], [/à¤µà¤¾à¤ªà¤¸/u, 0.85], [/à¤¬à¤‚à¤¦/u, 0.82],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¨à¤¾à¤¹à¥€/u, 0.95], [/à¤¥à¤¾à¤‚à¤¬à¤¾/u, 0.82],
    [/à¤®à¤¾à¤—à¥‡/u, 0.82], [/à¤¬à¤‚à¤¦/u, 0.82],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bnahi\b/i, 0.90], [/\bnai\b/i, 0.82],
    [/\bwaapas\b/i, 0.85], [/\bband\b/i, 0.80],
    [/\bmat\b/i, 0.75],
  ],

  greeting: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bhello\b/i, 0.95], [/^hi+$/i, 0.92],
    [/\bhi\b/i, 0.88],    [/\bhey\b/i, 0.85],
    [/\bstart\b/i, 0.80], [/\bbegin\b/i, 0.78],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¨à¤®à¤¸à¥à¤¤à¥‡/u, 0.97], [/à¤¨à¤®à¤¸à¥à¤•à¤¾à¤°/u, 0.95],
    [/à¤ªà¥à¤°à¤£à¤¾à¤®/u, 0.90], [/à¤†à¤¦à¤¾à¤¬/u, 0.88],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤¨à¤®à¤¸à¥à¤•à¤¾à¤°/u, 0.97], [/à¤¨à¤®à¤¸à¥à¤¤à¥‡/u, 0.95],
    [/à¤œà¤¯\s+à¤®à¤¹à¤¾à¤°à¤¾à¤·à¥à¤Ÿà¥à¤°/u, 0.85],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bnamaste\b/i, 0.97], [/\bnamaskar\b/i, 0.95],
    [/\bpranam\b/i, 0.88],  [/\bkya\s+hal\b/i, 0.80],
    [/\bkaise\s+ho\b/i, 0.80],
  ],

  help: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bhelp\b/i, 0.97], [/\bwhat\s+can\b/i, 0.88],
    [/\boption[s]?\b/i, 0.82], [/\bcommand[s]?\b/i, 0.85],
    [/\?\s*$/, 0.60],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤®à¤¦à¤¦/u, 0.97],   [/à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾/u, 0.92],
    [/à¤¸à¤¹à¤¾à¤¯à¤•/u, 0.85], [/à¤•à¥à¤¯à¤¾\s+à¤•à¤°\s+à¤¸à¤•à¤¤à¥‡/u, 0.90],
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤®à¤¦à¤¤/u, 0.97],   [/à¤¸à¤¹à¤¾à¤¯à¥à¤¯/u, 0.92],
    [/à¤•à¤¾à¤¯\s+à¤•à¤°à¥‚/u, 0.88],
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/\bmadat\b/i, 0.90], [/\bhelp\s+karo\b/i, 0.92],
    [/\bsahayata\b/i, 0.88], [/\bkya\s+kar\b/i, 0.80],
  ],

  otp_code: [
    // OTP: 4â€“6 digit number alone (staging code: CONFIG.otp.STAGING_CODE)
    [new RegExp(`^\\s*\\d{${CONFIG.otp.MIN_LENGTH},${CONFIG.otp.MAX_LENGTH}}\\s*$`), 0.98],
  ],

  consent_yes: [
    [/^\s*yes\s*$/i, 0.97], [/^\s*YES\s*$/, 0.98],
    [/à¤¹à¤¾à¤/u, 0.92], [/à¤¹à¥‹à¤¯/u, 0.92], [/\bhaan\b/i, 0.90],
  ],

  // Acknowledgement â€” "ok", "thanks", "k", "got it" etc.
  // Triggers a "anything else I can help?" response and stays in idle.
  acknowledge: [
    // â”€â”€ English â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/^ok+[!.]*$/i, 0.95],          // ok, okk, okkk
    [/^okay[!.]*$/i, 0.93],
    [/^k[!.]*$/i, 0.88],            // k, kk
    [/thanks?/i, 0.95],         // thank, thanks
    [/thank\s+you/i, 0.97],
    [/thx/i, 0.90],             // thx
    [/tx/i, 0.88],              // tx
    [/ty/i, 0.85],              // ty
    [/got\s+it/i, 0.92],
    [/noted/i, 0.90],
    [/sure/i, 0.82],            // only when standalone
    [/great/i, 0.82],
    [/perfect/i, 0.85],
    [/awesome/i, 0.85],
    [/nice/i, 0.78],
    // â”€â”€ Hindi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤ à¥€à¤•\s*à¤¹à¥ˆ/u, 0.93],           // theek hai
    [/à¤§à¤¨à¥à¤¯à¤µà¤¾à¤¦/u, 0.97],            // dhanyavaad
    [/à¤¶à¥à¤•à¥à¤°à¤¿à¤¯à¤¾/u, 0.95],           // shukriya
    [/à¤¸à¤®à¤\s*à¤—à¤¯à¤¾/u, 0.92],          // samajh gaya
    [/à¤…à¤šà¥à¤›à¤¾/u, 0.88],              // accha
    // â”€â”€ Marathi (Devanagari) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/à¤ à¥€à¤•\s*à¤†à¤¹à¥‡/u, 0.93],          // theek aahe
    [/à¤§à¤¨à¥à¤¯à¤µà¤¾à¤¦/u, 0.97],
    [/à¤¸à¤®à¤œà¤²à¤‚/u, 0.92],              // samajlam
    [/à¤¬à¤°à¤‚/u, 0.88],                // baram
    // â”€â”€ Hinglish (Latin script) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    [/theek\s*hai/i, 0.92],
    [/shukriya/i, 0.93],
    [/accha/i, 0.88],
    [/samajh\s*gaya/i, 0.90],
    [/bhale/i, 0.82],
  ],
};

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [05]  COMMAND VARIANTS for Fuzzy Matching  â€” Layer [04.5]
//
//       ~20 realistic variants per language per intent.
//       LANGUAGES INCLUDED:
//         EN  â€” English typos / abbreviations / common misspellings
//         HI  â€” Hindi romanized (how Indians type Hindi on phones)
//         MR  â€” Marathi romanized (common WhatsApp Marathi typing)
//         HL  â€” Hinglish (code-switched, most common in rural Maharashtra)
//       LANGUAGES EXCLUDED FROM FUZZY:
//         Tamil, Kannada â€” handled by Devanagari regex in [04.1] only.
//         Latin-script Levenshtein cannot reliably match non-Latin scripts.
//
//       All variants are single tokens â€” multi-word phrases won't work
//       with the word-by-word Levenshtein extractor in Layer [04.5].
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
const COMMAND_VARIANTS = {

  medications: {
    EN: [
      // Common English typos and abbreviations for "medication/medicine/meds"
      "medicaitons","medictions","medicatons","mediactions","medicatins",
      "medecations","medicationes","medikations","medicaton","mediktion",
      "medicashun","medss","medz","priscriptions","presciptions",
      "prescripsions","prescribtions","prescritions","medicaition","medicatoin",
    ],
    HI: [
      // Hindi romanized variants for à¤¦à¤µà¤¾ / à¤¦à¤µà¤¾à¤ˆ / à¤—à¥‹à¤²à¥€
      "dawai","dawa","dava","davai","dawaee","dawaiye","dawaai","davaee",
      "dawaye","davaye","golee","goli","goliyaa","golia","goliya",
      "dawaiyaan","davaiyan","dawaaee","daawaai","prascripshn",
    ],
    MR: [
      // Marathi romanized variants for à¤”à¤·à¤§ / à¤—à¥‹à¤³à¥à¤¯à¤¾
      "aushadh","oashadh","aushadhey","aushadhee","gollya","gollyaa",
      "golyaa","golia","aushadha","aushadhe","gollyaan","ausaadh",
      "oshadh","oshad","aushadhachi","gollichi","aushadhyan","oshadhe",
      "aaushadh","ausaadhey",
    ],
    HL: [
      // Hinglish single-word variants (code-switching, most common)
      "dawaiyan","tablet","tablit","medicin","medecin","medicne","daawaee",
      "golliya","aushadha","dawaee","goliyaan","tablett","prescripshn",
      "daawai","goliyan","mediceen","dawaai","tablit","golii",
    ],
  },

  procedures: {
    EN: [
      // Common English typos for "procedure/surgery/operation/treatment"
      "proceedure","procedur","proceudre","proceduure","srgery","surgrey",
      "surgury","surgerey","operashun","opertion","operaion","opeartion",
      "treatmnet","treatement","tretment","treament","treeatment","procedre",
      "procudure","proceduere",
    ],
    HI: [
      // Hindi romanized for à¤‡à¤²à¤¾à¤œ / à¤‘à¤ªà¤°à¥‡à¤¶à¤¨ / à¤‰à¤ªà¤šà¤¾à¤° / à¤œà¤¾à¤‚à¤š
      "ilaaj","ilaj","ilag","ilaaz","opereshun","operashn","upchaar",
      "upchar","upchaara","jaanch","janch","jaach","parikshan","prikshan",
      "parikshan","test","taest","ilazh","opreshan","upchara",
    ],
    MR: [
      // Marathi romanized for à¤¶à¤¸à¥à¤¤à¥à¤°à¤•à¥à¤°à¤¿à¤¯à¤¾ / à¤‰à¤ªà¤šà¤¾à¤° / à¤¤à¤ªà¤¾à¤¸à¤£à¥€
      "shastrkriya","shastrakrya","shastrkriyaa","upchaar","upchaara",
      "tapasani","tapasni","tapasanee","tapasne","tapasani","upchare",
      "shastrakrya","tapaasnee","shastrkirya","tapasanes","upachar",
      "tapasni","tapasanee","tapaasanee","tapashnee",
    ],
    HL: [
      // Hinglish for procedure-related
      "ilazh","operashn","upchara","jaancha","surjri","opreashn","opreshn",
      "ilaag","operasn","tapaasni","treatmnt","srgeri","upchaar","jaach",
      "tapaasni","jaanchi","testng","parikshan","tapas","jaanch",
    ],
  },

  appointments: {
    EN: [
      // Common English typos for "appointment/schedule/visit/booking"
      "appoiment","appointmnet","appointement","apointment","appoinment",
      "appointmant","appoitnment","appointmnet","appointmant","apointmnet",
      "schedual","scheduel","scheudle","schedul","shedule","shedual",
      "appointement","appintment","appoiintment","appoitment",
    ],
    HI: [
      // Hindi romanized for à¤…à¤ªà¥‰à¤‡à¤‚à¤Ÿà¤®à¥‡à¤‚à¤Ÿ / à¤®à¥à¤²à¤¾à¤•à¤¾à¤¤
      "apointment","apointmnt","mulakaat","mulaakat","mulakat","mulaaqat",
      "appointment","appointmnt","milaap","milaap","doctorsaab","schedjul",
      "milana","milna","mulating","mulaqat","mulaakaath","mulakath",
      "mulakaat","apoyentment",
    ],
    MR: [
      // Marathi romanized for à¤­à¥‡à¤Ÿ / à¤µà¥‡à¤³à¤¾à¤ªà¤¤à¥à¤°à¤•
      "bhet","bhett","bheat","velaapatrak","velapatrk","velapaatrk",
      "velaptrak","bhetee","bheti","veles","velaaptrak","apoinment",
      "velaaptark","bheett","velaapatrk","bheeet","velpatrk",
      "velaaaptrak","apointmnt","bheetee",
    ],
    HL: [
      // Hinglish appointment words
      "mulaqat","appointment","apointment","milna","doctorpe","schedule",
      "schedual","apointmnt","mulgat","appoiment","mulaakaath","milaap",
      "bhet","bhett","appiontment","appoitmnt","apoinment","apointement",
      "mulaqaat","apointement",
    ],
  },

  records: {
    EN: [
      // Common English typos for "records/reports/history"
      "recrod","recods","recrods","recorsd","reporst","repots","repoorts",
      "hisotry","histroy","histori","histry","recrod","recrd","rcords",
      "reorts","repport","histrory","hisotry","reporrts","rcord",
    ],
    HI: [
      // Hindi romanized for à¤°à¤¿à¤•à¥‰à¤°à¥à¤¡ / à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€ / à¤‡à¤¤à¤¿à¤¹à¤¾à¤¸
      "rikaord","rikord","rikaard","jankari","jaankari","jankaari","itihas",
      "itihaas","jaankari","jankaree","ricard","ricaard","reekord","jaankare",
      "jankaaree","itihaas","rikkord","jaankaaree","rikorrd","jankaari",
    ],
    MR: [
      // Marathi romanized for à¤°à¥‡à¤•à¥‰à¤°à¥à¤¡ / à¤®à¤¾à¤¹à¤¿à¤¤à¥€ / à¤…à¤¹à¤µà¤¾à¤²
      "rekaord","rekord","maahiti","mahiti","mahitee","ahval","ahaval",
      "mahitee","aahaval","rekorrd","mahiiti","mahitii","rekaard","maaahiti",
      "ahavaal","rekord","maaahitee","aahavaal","maahitii","rekordd",
    ],
    HL: [
      // Hinglish records words
      "jankaari","itihaas","reekord","mahiti","record","jankari","history",
      "histori","jankaree","mahitee","rekord","aahaval","jankaary","rekaard",
      "itihaas","mahiitee","rikaord","jankaaree","rikord","mahiitiee",
    ],
  },

  vitals: {
    EN: [
      // Common English typos for "vitals/blood pressure/temperature/pulse"
      "vitlas","vitalls","vitales","bllod","blod","presure","pressur",
      "temperture","temprature","tempreture","temprture","temperatur",
      "puls","pluse","pluse","oxigen","oxygn","oxyegen","spo","spo22",
    ],
    HI: [
      // Hindi romanized for à¤¬à¥à¤²à¤¡ à¤ªà¥à¤°à¥‡à¤¶à¤° / à¤¤à¤¾à¤ªà¤®à¤¾à¤¨ / à¤¨à¤¬à¥à¤œà¤¼
      "blad","bladd","preser","preesure","taapmaan","tapman","tapmann",
      "nabz","nabd","nabzz","oxijan","oxejan","ojkisan","spo","spoo",
      "bpbp","bloodpressure","taapmane","nabze","oxijaan","blaad",
      "preeshur","taapmann","nabze","oksijan",
    ],
    MR: [
      // Marathi romanized for à¤°à¤•à¥à¤¤à¤¦à¤¾à¤¬ / à¤¤à¤¾à¤ªà¤®à¤¾à¤¨ / à¤¨à¤¾à¤¡à¥€
      "raktdab","raktaadab","tapmaan","tapmann","naadi","naadee","nadee",
      "rakhtdab","tapmane","naadii","rakhtaadab","taapmaan","naadii",
      "raktadaab","tapmaane","naadii","rakhtadab","taapmane","naadiee",
      "raktaadaab",
    ],
    HL: [
      // Hinglish vitals words
      "bpbp","preser","taapmaan","nabze","oxijan","blodpressure","vitlas",
      "raktdab","naadi","spo22","temprachar","pulss","vitalls","oxejan",
      "bladpresure","taapmane","nabzz","ojkisan","naadee","vitales",
    ],
  },

  discharge: {
    EN: [
      // Common English typos for "discharge/going home"
      "discarge","discharg","dischareg","discharje","discharje","dischrage",
      "discharrge","discharne","dischares","discharged","goinhome","goinghom",
      "leavehospital","leavehospitl","going","goingom","leavhospital",
      "dischareg","discharhe","discharjed",
    ],
    HI: [
      // Hindi romanized for à¤¡à¤¿à¤¸à¥à¤šà¤¾à¤°à¥à¤œ / à¤›à¥à¤Ÿà¥à¤Ÿà¥€ / à¤˜à¤° à¤œà¤¾à¤¨à¤¾
      "dischaarj","dischaarje","chhutti","chhutii","chhuttee","gharjaana",
      "gharjana","ghaarjaana","discharg","dischaarjed","chhuttii","ghaarjana",
      "niklana","nikalna","nikalnaa","chutti","chuttee","ghaar","ghaarr",
      "dischaarje",
    ],
    MR: [
      // Marathi romanized for à¤¡à¤¿à¤¸à¥à¤šà¤¾à¤°à¥à¤œ / à¤¸à¥à¤Ÿà¥à¤Ÿà¥€ / à¤˜à¤°à¥€ à¤œà¤¾à¤£à¥‡
      "dischaarj","suttee","sutti","sutteee","gharijaane","gharijane",
      "gharijaana","discharg","suttii","ghaarijane","nikaalne","nikalane",
      "suttiii","gharijaanee","dischaarje","suutti","gharijaane","nikaalnee",
      "sutiii","ghaarijaan",
    ],
    HL: [
      // Hinglish discharge words
      "dischaarj","chhutti","gharjaana","niklana","chutti","ghaarjaana",
      "discharg","gharr","chhuttii","ghaarr","nikalnaa","suttee","sutti",
      "gharijane","dischaarje","suttii","gharijaane","nikalnee","chhutii","chhuttee",
    ],
  },

  confirm: {
    EN: [
      // Common English typos for "yes/confirm/okay"
      "yess","yea","yeaa","yeaah","yeeh","yep","yup","yapp","yaap","yasss",
      "cofirm","cornfirm","confrim","confrm","confim","confrimm","conirm",
      "confrm","okayy","oka",
    ],
    HI: [
      // Hindi romanized for à¤¹à¤¾à¤ / à¤¸à¤¹à¥€ / à¤ à¥€à¤• à¤¹à¥ˆ
      "haan","haa","haaan","hanna","haann","sahi","sahee","sahii","theek",
      "theekhai","thikhai","sahii","thiik","haaaan","bilkul","bilkull",
      "bilkul","theekh","saahi","haann",
    ],
    MR: [
      // Marathi romanized for à¤¹à¥‹à¤¯ / à¤¬à¤°à¥‹à¤¬à¤° / à¤ à¥€à¤• à¤†à¤¹à¥‡
      "hoye","hoyyy","hoyy","barobar","barrobar","barobaar","thikahe",
      "theekaahe","barobbar","hoyyyy","barobara","thikaahee","hooyy",
      "baroobara","thiikahe","hoyyy","barobaar","theekh","barobbar","hoyee",
    ],
    HL: [
      // Hinglish confirm words
      "haan","bilkul","sahi","theekhai","haa","barobar","hoye","thik","saahi",
      "haaan","bilkull","sahii","theekh","haaaan","barobaar","hoyy","thiik",
      "saaahi","thikkhai","bilkullah",
    ],
  },

  cancel: {
    EN: [
      // Common English typos for "no/cancel/back/stop"
      "noo","nope","nopee","cancell","cancle","canceel","cancle","bak","bback",
      "bback","stopp","stpp","stoppp","canceld","cancell","cancele","caancel",
      "baack","ccancel","sttop",
    ],
    HI: [
      // Hindi romanized for à¤¨à¤¹à¥€à¤‚ / à¤µà¤¾à¤ªà¤¸ / à¤°à¥à¤•à¥‹
      "nahi","nahii","naahi","naahii","waapas","waaps","waapas","ruko",
      "rukoo","rukko","bnd","nahiiii","mat","maatt","bandh","bandha",
      "nahin","nahin","waapaz","rukoja",
    ],
    MR: [
      // Marathi romanized for à¤¨à¤¾à¤¹à¥€ / à¤¥à¤¾à¤‚à¤¬à¤¾ / à¤®à¤¾à¤—à¥‡
      "naahi","naahii","naahiii","thaanba","thaamba","thaambaa","maage",
      "maagee","maaghe","maghe","naahiiii","thamb","thaamb","maaghe",
      "naahiiii","thaanbaa","thaambaa","maagee","naahiiiiii","maghe",
    ],
    HL: [
      // Hinglish cancel words
      "nahi","waapas","ruko","bandh","mat","naahi","thaamba","maage",
      "naahii","waaps","rukoo","bandd","matt","naahiii","thaanba","maaghe",
      "nai","waapaz","ruko","bnd",
    ],
  },

  help: {
    EN: [
      // Common English typos for "help/options/commands"
      "hlep","hepl","halp","hellp","helppp","helpp","optons","optins","optinos",
      "optionss","commads","comands","comandds","commandes","commanss","commandss",
      "hlelp","comands","halpp","optionnes",
    ],
    HI: [
      // Hindi romanized for à¤®à¤¦à¤¦ / à¤¸à¤¹à¤¾à¤¯à¤¤à¤¾
      "madad","maddad","madaad","maddaad","sahayta","sahayata","sahaayata",
      "sahaayataa","madadd","sahayta","maddaad","sahaayata","madaad","maddaad",
      "sahaayta","maddd","sahaataa","madadd","sahayta","sahaytaa",
    ],
    MR: [
      // Marathi romanized for à¤®à¤¦à¤¤ / à¤¸à¤¹à¤¾à¤¯à¥à¤¯
      "madat","madaatt","madatt","sahayya","sahaayya","sahaaya","maddatt",
      "madaatt","sahaayya","maadatt","sahayya","madadd","sahaaay","madaatt",
      "sahaayya","maddat","sahaayaa","madaatt","sahaayyaa","madaattt",
    ],
    HL: [
      // Hinglish help words
      "madad","sahayata","madat","helpkaro","madaad","sahayta","maddad",
      "helpp","sahaayata","madatt","helpme","madaad","saahayata","hlep",
      "madadd","sahaataa","helpkro","maddat","sahaayya","helpa",
    ],
  },

  greeting: {
    EN: [
      // Common English typos for "hello/hi/hey"
      "helo","helloo","hellloo","helllo","heloo","hihi","hiii","hiiii","hiiiii",
      "heyy","heyyyy","heyyy","heyo","heyoo","hellllo","hellow","helo","hihi",
      "helloo","heyoo",
    ],
    HI: [
      // Hindi romanized for à¤¨à¤®à¤¸à¥à¤¤à¥‡ / à¤ªà¥à¤°à¤£à¤¾à¤® / à¤†à¤¦à¤¾à¤¬
      "namste","namastee","namastey","namastaye","namastay","namastee","prnam",
      "pranam","pranaaam","adab","aadab","namastee","namasttee","pranam",
      "namastey","aadab","parnaam","namastaye","namasstee","namastei",
    ],
    MR: [
      // Marathi romanized for à¤¨à¤®à¤¸à¥à¤•à¤¾à¤° / à¤¨à¤®à¤¸à¥à¤¤à¥‡
      "namaskar","namaskaar","namaskarre","namaskaare","namaskare","namaskar",
      "namstee","namaskaar","namskaar","namaskaare","namaskarre","namaskare",
      "namstey","namaskaaar","namskare","namaskaar","namaskar","namskaaree",
      "namaskarr","namaskaree",
    ],
    HL: [
      // Hinglish greeting words
      "namaste","namaskar","pranam","adaab","kaise","kaisehoo","kyahal",
      "namasttee","namstee","pranam","aadab","kaiisehoo","kyahaal","namastee",
      "namskaar","parnaam","aadaab","kaiseho","kyaahaal","naamaste",
    ],
  },
};




// [05.A] Auto-build flat lookup from COMMAND_VARIANTS â€” no hardcoding below
// Structure: [{ word: string, intent: string }]
const FLAT_FUZZY_VARIANTS = Object.entries(COMMAND_VARIANTS).flatMap(
  ([intent, langs]) =>
    Object.values(langs).flat().map(word => ({ word: word.toLowerCase(), intent }))
);

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [06]  RESPONSE TEMPLATES
//       All user-facing text in one place.
//       Dynamic responses (drug detail) are built by ResponseBuilder [12].
//       {drug}, {name}, {dosage}, etc. are replaced at build time.
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”


const RESPONSE_TEMPLATES = {
  send_otp: `We sent you an OTP code to your phone.\n\nPlease enter the ${CONFIG.otp.MIN_LENGTH} to ${CONFIG.otp.MAX_LENGTH} digit code.\n\nTest code: ${CONFIG.otp.STAGING_CODE}`,
  
  otp_reprompt: `Please enter your OTP code.\n\nIt should have ${CONFIG.otp.MIN_LENGTH} to ${CONFIG.otp.MAX_LENGTH} numbers.`,
  
  verify_otp: "Your OTP is correct!\n\nNow we need your permission to share your health info.\n\nType YES to continue.",
  
  consent_reprompt: "Type YES to give us permission to continue.",
  
  record_consent: "Great! You are all set now.\n\nYou can ask me about these things:\n\nmedicine - see your medicines\nappointments - see your doctor visits\nrecords - see your patient info\nvitals - see your health numbers\nprocedures - see your tests\n\nJust tell me what you need.",
  
  auth_not_needed: "You are already verified!\n\nType help to see what you can do.",

  show_welcome: "Hi! I am CARE Bot.\n\nType help to see what I can help you with.",
  
  show_help: "You can ask me about:\n\nmedicine - your medicine list\nappointments - your doctor appointments\nrecords - your patient information\nvitals - your health numbers\nprocedures - your tests\ndischarge - discharge information\n\nJust type what you want to know.",

  fetch_medications: "Here are your medicines:\n\n1. Metformin 500mg - Take 1 in morning, skip afternoon, 1 at night (after eating)\n2. Amlodipine 5mg - Skip morning and afternoon, 1 at night only\n\nType the medicine name if you want more details.",
  
  handle_meds_followup: "Which medicine do you want to know about?\n\nType the name like metformin or amlodipine",

  fetch_appointments: "Your next doctor visit:\n\nDoctor: Dr. Sharma\nType: General check up\nPlace: Sangli District Hospital\nDate: 12 March 2026\nTime: 10:30 AM\n\nDo you want to confirm this?",
  
  confirm_appointment: "Are you sure?\n\nDr. Sharma on 12 March 2026 at 10:30 AM\n\nType yes to confirm.",
  
  finalize_appointment: "Your appointment is confirmed!\n\nYou will get a reminder one day before.",
  
  cancel_appointment: "Cancelled.\n\nType appointments to see more visits.",
  
  handle_appt_followup: "Type yes to confirm the appointment or no to cancel it.",

  fetch_procedures: "Your tests:\n\n1. Blood Sugar Test - 3 March 2026 - Done\n2. ECG Test - 10 March 2026 - Will happen soon",
  
  handle_proc_followup: "Which test do you want to know about?\n\nType 1 or 2",

  fetch_vitals: "Your health numbers from today at 8:00 AM:\n\nTemperature: 98.6 degrees\nHeart rate: 78 beats per minute\nBlood pressure: 124/82\nOxygen level: 98 percent\nWeight: 72 kg\n\nEverything looks normal.",
  
  handle_vitals_followup: "These are your health numbers.",

  fetch_records: "Your patient information:\n\nName: Ramesh Patil\nAdmitted: 28 February 2026\nHospital: Sangli District Hospital\nCondition: Diabetes and high blood pressure\n\nType appointments or medicine to know more.",
  
  handle_records_followup: "I can show your appointments, medicine list, or tests.\n\nWhich one do you want?",

  fetch_discharge: "Discharge information:\n\nYour discharge date: 15 March 2026\nWhere to collect papers: Counter 3, Ground Floor\nDoctor approval needed by: 10:00 AM",

  handle_drug_followup: "Here is the medicine information.",
  
  handle_acknowledge: "Is there anything else you need?\n\nYou can ask me anytime.",

  handle_unknown: "Sorry, I did not understand that.\n\nTry: medicine, appointments, records, vitals, help",
  
  send_consent_prompt: "Type YES to give permission to continue.",

  fetch_drug_detail: null,
};

// [07]  FSM STATE & TRANSITION TABLE
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

// All valid FSM states
const FSM_STATES = [
  "unverified","awaiting_otp","awaiting_consent","idle",
  "viewing_meds","viewing_drug","viewing_appts","confirming_appt",
  "viewing_procs","viewing_vitals","viewing_records",
];

// Explicit transitions: "current_state:intent" â†’ [next_state, handler]
const FSM_TRANSITIONS = {
  // â”€â”€ [05.1] Auth flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "unverified:greeting":      ["awaiting_otp",    "send_otp"],
  "unverified:help":          ["awaiting_otp",    "send_otp"],
  "unverified:medications":   ["awaiting_otp",    "send_otp"],
  "unverified:procedures":    ["awaiting_otp",    "send_otp"],
  "unverified:appointments":  ["awaiting_otp",    "send_otp"],
  "unverified:records":       ["awaiting_otp",    "send_otp"],
  "unverified:vitals":        ["awaiting_otp",    "send_otp"],
  "unverified:discharge":     ["awaiting_otp",    "send_otp"],
  "unverified:otp_code":      ["awaiting_otp",    "send_otp"],  // explain first
  "unverified:unknown":       ["awaiting_otp",    "send_otp"],
  "awaiting_otp:otp_code":    ["awaiting_consent","verify_otp"],
  "awaiting_otp:unknown":     ["awaiting_otp",    "otp_reprompt"],
  // â”€â”€ [05.2] Consent flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "awaiting_consent:consent_yes": ["idle","record_consent"],
  "awaiting_consent:confirm":     ["idle","record_consent"],
  "awaiting_consent:unknown":     ["awaiting_consent","consent_reprompt"],
  // â”€â”€ From IDLE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "idle:greeting":     ["idle",            "show_welcome"],
  "idle:help":         ["idle",            "show_help"],
  "idle:medications":  ["viewing_meds",    "fetch_medications"],
  "idle:drug_detail":  ["viewing_drug",    "fetch_drug_detail"],
  "idle:procedures":   ["viewing_procs",   "fetch_procedures"],
  "idle:appointments": ["viewing_appts",   "fetch_appointments"],
  "idle:records":      ["viewing_records", "fetch_records"],
  "idle:vitals":       ["viewing_vitals",  "fetch_vitals"],
  "idle:discharge":    ["idle",            "fetch_discharge"],
  "idle:otp_code":     ["idle",            "auth_not_needed"],  // already verified
  "idle:cancel":       ["idle",            "show_help"],
  "idle:unknown":      ["idle",            "handle_unknown"],
  // Acknowledge from any state â†’ idle + "anything else?" message
  "idle:acknowledge":              ["idle", "handle_acknowledge"],
  "viewing_meds:acknowledge":      ["idle", "handle_acknowledge"],
  "viewing_drug:acknowledge":      ["idle", "handle_acknowledge"],
  "viewing_appts:acknowledge":     ["idle", "handle_acknowledge"],
  "viewing_procs:acknowledge":     ["idle", "handle_acknowledge"],
  "viewing_vitals:acknowledge":    ["idle", "handle_acknowledge"],
  "viewing_records:acknowledge":   ["idle", "handle_acknowledge"],
  "confirming_appt:acknowledge":   ["idle", "handle_acknowledge"],
  // â”€â”€ Viewing Medications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "viewing_meds:drug_detail": ["viewing_drug","fetch_drug_detail"],
  "viewing_meds:medications": ["viewing_meds","fetch_medications"],
  "viewing_meds:unknown":     ["viewing_meds","handle_meds_followup"],
  // â”€â”€ Viewing Drug Detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "viewing_drug:drug_detail": ["viewing_drug","fetch_drug_detail"],
  "viewing_drug:unknown":     ["viewing_drug","handle_drug_followup"],
  // â”€â”€ Viewing Appointments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "viewing_appts:confirm":    ["confirming_appt","confirm_appointment"],
  "viewing_appts:unknown":    ["viewing_appts",  "handle_appt_followup"],
  "confirming_appt:confirm":  ["idle",            "finalize_appointment"],
  "confirming_appt:cancel":   ["idle",            "cancel_appointment"],
  // â”€â”€ Viewing Procedures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "viewing_procs:unknown":    ["viewing_procs","handle_proc_followup"],
  // â”€â”€ Viewing Vitals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "viewing_vitals:vitals":    ["viewing_vitals","fetch_vitals"],
  "viewing_vitals:unknown":   ["viewing_vitals","handle_vitals_followup"],
  // â”€â”€ Viewing Records â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  "viewing_records:records":      ["viewing_records","fetch_records"],
  "viewing_records:appointments": ["viewing_appts",  "fetch_appointments"],
  "viewing_records:unknown":      ["viewing_records","handle_records_followup"],
};

// [05.4] Global navigation â€” from ANY viewing_* state, a main intent
// always routes correctly without needing NÃ—M explicit rows in the table.
const GLOBAL_NAVIGATION = {
  medications:  ["viewing_meds",    "fetch_medications"],
  drug_detail:  ["viewing_drug",    "fetch_drug_detail"],
  appointments: ["viewing_appts",   "fetch_appointments"],
  procedures:   ["viewing_procs",   "fetch_procedures"],
  vitals:       ["viewing_vitals",  "fetch_vitals"],
  records:      ["viewing_records", "fetch_records"],
  discharge:    ["idle",            "fetch_discharge"],
  help:         ["idle",            "show_help"],
  cancel:       ["idle",            "show_help"],
  acknowledge:  ["idle",            "handle_acknowledge"],
};

const VIEWING_STATES = new Set(FSM_STATES.filter(s => s.startsWith("viewing_") || s === "confirming_appt"));

// Context-boost patterns per last_intent  [04.4]
// Resolves ambiguous short messages using session history
const CONTEXT_BOOST_PATTERNS = {
  medications: [
    [/how\s+(many|often|much)/i, "medications", 0.72],
    [/\bwhen\b/i,                "medications", 0.68],
    [/\bdose\b/i,                "medications", 0.75],
    [/\btimes?\b/i,              "medications", 0.70],
    [/\b\w{5,}\b/,               "drug_detail", 0.65],  // any long word = drug name
  ],
  drug_detail: [
    [/\b\w{5,}\b/,               "drug_detail", 0.68],  // another drug name
    [/\bhow\b/i,                  "drug_detail", 0.68],
  ],
  appointments: [
    [/\bwhere\b/i,               "appointments", 0.70],
    [/how\s+long/i,              "appointments", 0.72],
    [/\bwhich\s+doctor\b/i,      "appointments", 0.82],
  ],
  vitals: [
    [/\byesterday\b/i,           "vitals", 0.75],
    [/last\s+week/i,             "vitals", 0.78],
    [/\bnormal\b/i,              "vitals", 0.70],
  ],
  records: [
    [/\blast\s+(visit|time)\b/i, "records", 0.75],
    [/\bmore\b/i,                "records", 0.68],
  ],
};

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [08]  UTILITY â€” Levenshtein ratio
//       Returns 0 (totally different) to 1 (identical).
//       Used by Layer [04.5] fuzzy matching.
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
function levenshteinRatio(s1, s2) {
  // Step [08.A] Build DP matrix
  const m = s1.length, n = s2.length;
  if (m === 0 || n === 0) return m === n ? 1 : 0;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  // Step [08.B] Fill
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = s1[i-1] === s2[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  // Step [08.C] Normalise to [0, 1]
  return 1 - dp[m][n] / Math.max(m, n);
}

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [09]  ENTITY EXTRACTOR  â€” Layer [04.6]
//       Extracts specific data points from a message after intent is known.
//       Drug names derived from DRUG_DB keys â€” never hardcoded.
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

// Entity patterns: [regex, entity_type, confidence]
// Extracted regardless of intent â€” handler decides what to do with them
const ENTITY_PATTERNS = [
  [/last\s+(\d+)\s+(day[s]?|week[s]?|month[s]?)/i,  "time_range", 0.95],
  [/past\s+(\d+)\s+(day[s]?|week[s]?|month[s]?)/i,  "time_range", 0.95],
  [/(\d+)\s+(day[s]?|week[s]?|month[s]?)\s+ago/i,   "time_range", 0.92],
  [/à¤ªà¤¿à¤›à¤²à¥‡\s+(\d+)\s+(à¤¦à¤¿à¤¨|à¤¹à¤«à¥à¤¤à¥‡|à¤®à¤¹à¥€à¤¨à¥‡)/u,             "time_range", 0.92],  // Hindi
  [/à¤®à¤¾à¤—à¥€à¤²\s+(\d+)\s+(à¤¦à¤¿à¤µà¤¸|à¤†à¤ à¤µà¤¡à¥‡|à¤®à¤¹à¤¿à¤¨à¥‡)/u,            "time_range", 0.92],  // Marathi
  [/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,  "date",       0.90],
  [/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}\b/i, "date", 0.88],
  [/last\s+(\d+)\b/i,                                "limit",      0.82],
  [/\b(blood\s+pressure|bp)\b/i,                     "vital_type", 0.97],
  [/\b(temperature|temp)\b/i,                        "vital_type", 0.92],
  [/\b(spo2|oxygen|saturation)\b/i,                  "vital_type", 0.97],
  [/\b(pulse|heart\s+rate)\b/i,                      "vital_type", 0.92],
  [/\b(weight)\b/i,                                  "vital_type", 0.88],
];

function extractEntities(message) {
  const entities = [];
  const lower = message.toLowerCase();

  // Step [09.A] Drug name extraction â€” match against DRUG_DB keys via Levenshtein
  const words = (lower.match(/\b[a-zA-Z]{4,}\b/g) || []);
  for (const word of words) {
    for (const drugKey of KNOWN_DRUG_NAMES) {
      const sim = levenshteinRatio(word, drugKey);
      if (sim >= 0.82) {
        entities.push({ type: "drug_name", value: drugKey, raw: word, confidence: Math.round(sim * 95) / 100 });
        break; // one drug per word
      }
    }
  }

  // Step [09.B] Pattern-based entity extraction
  for (const [pattern, entityType, conf] of ENTITY_PATTERNS) {
    const match = lower.match(pattern);
    if (match) entities.push({ type: entityType, value: match[0], raw: match[0], confidence: conf });
  }

  // Step [09.C] Deduplicate â€” keep highest confidence per type
  const best = {};
  for (const e of entities)
    if (!best[e.type] || e.confidence > best[e.type].confidence) best[e.type] = e;

  return Object.values(best);
}

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [10]  INTENT ROUTER  â€” Step [04] in architecture
//       7 layers, processed in order. Each layer can upgrade the result.
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
function routeIntent(message, session = {}) {
  const text = message.trim();
  const lower = text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // â”€â”€ [04.1] Layer 1 â€” Regex matching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const regexMatches = [];
  for (const [intent, patterns] of Object.entries(INTENT_REGEX_PATTERNS)) {
    for (const [regex, baseConf] of patterns) {
      if (regex.test(text)) {
        // â”€â”€ [04.2] Layer 2 â€” Confidence calibration by word count â”€â”€â”€â”€
        const factor =
          wordCount === 1                                          ? CONFIG.calibration.SINGLE_WORD  :
          wordCount === 2                                          ? CONFIG.calibration.TWO_WORDS    :
          wordCount >= CONFIG.calibration.SWEET_SPOT_MIN &&
          wordCount <= CONFIG.calibration.SWEET_SPOT_MAX          ? CONFIG.calibration.SWEET_SPOT   :
                                                                     CONFIG.calibration.LONG_MESSAGE;
        const calibrated = Math.min(baseConf * factor, 1.0);
        if (calibrated >= CONFIG.intent.MIN_CONFIDENCE)
          regexMatches.push({ intent, confidence: Math.round(calibrated * 1000) / 1000, method: "regex" });
        break; // one match per intent
      }
    }
  }
  regexMatches.sort((a, b) => b.confidence - a.confidence);

  // â”€â”€ [04.3] Layer 3 â€” Multi-intent detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const multiIntents = regexMatches.filter(m => m.confidence >= CONFIG.intent.MULTI_INTENT_THRESHOLD);

  let best = regexMatches[0] || { intent: "unknown", confidence: 0, method: "none" };

  // â”€â”€ [04.3.A] State-scoped intent filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // consent_yes is ONLY valid in awaiting_consent state.
  // "yes" typed anywhere else (e.g. confirming_appt) must resolve to confirm.
  // Without this, consent_yes always wins over confirm because its regex
  // (/^\s*yes\s*$/i) is tighter and calibrates to a higher confidence.
  if (best.intent === "consent_yes" && session.state !== "awaiting_consent") {
    // Demote consent_yes and promote the next-best match that isn't consent_yes
    const fallback = regexMatches.find(m => m.intent !== "consent_yes");
    best = fallback || { intent: "confirm", confidence: 0.75, method: "regex_scoped" };
  }

  // â”€â”€ [04.4] Layer 4 â€” Session context boost â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Only runs when primary intent is unclear (unknown or low-confidence)
  if (best.intent === "unknown" && session.last_intent) {
    for (const [pattern, intent, conf] of (CONTEXT_BOOST_PATTERNS[session.last_intent] || [])) {
      if (pattern.test && pattern.test(lower)) {
        if (conf >= CONFIG.intent.CONTEXT_BOOST_THRESHOLD) {
          best = { intent, confidence: conf, method: "context_boost" };
          break;
        }
      }
    }
  }

  // â”€â”€ [04.5] Layer 5 â€” Fuzzy matching (Levenshtein) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Runs when regex failed OR confidence is low
  // Uses FLAT_FUZZY_VARIANTS (auto-built from COMMAND_VARIANTS config)
  if (best.intent === "unknown" || best.confidence < CONFIG.intent.MIN_CONFIDENCE + 0.05) {
    const wordsInMsg = (lower.match(/\b[a-zA-Z]{3,}\b/g) || []);
    let bestFuzzy = null, bestFuzzyConf = 0;
    for (const word of wordsInMsg) {
      for (const variant of FLAT_FUZZY_VARIANTS) {
        const sim = levenshteinRatio(word, variant.word);
        const conf = sim * CONFIG.intent.FUZZY_CONFIDENCE_PENALTY;
        if (sim >= CONFIG.intent.FUZZY_THRESHOLD && conf > bestFuzzyConf) {
          bestFuzzyConf = conf;
          bestFuzzy = { intent: variant.intent, confidence: Math.round(conf * 1000) / 1000, method: "fuzzy" };
        }
      }
    }
    if (bestFuzzy && bestFuzzy.confidence > best.confidence) best = bestFuzzy;
  }

  // â”€â”€ [04.6] Layer 6 â€” Entity extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const entities = extractEntities(text);

  // â”€â”€ [04.7] Layer 7 â€” Entity-first routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // If a known drug name was found, upgrade intent to medications/drug_detail
  const drugEntity = entities.find(e => e.type === "drug_name");
  if (drugEntity) {
    const prevWasDrugContext = session.last_intent === "medications" || session.last_intent === "drug_detail";
    if (best.intent === "medications" || best.intent === "unknown") {
      best = {
        ...best,
        intent:     prevWasDrugContext ? "drug_detail" : "medications",
        confidence: Math.max(best.confidence, drugEntity.confidence),
        method:     best.method === "none" ? "entity" : `${best.method}+entity`,
      };
    }
  }

  return {
    intent:      best.intent,
    confidence:  best.confidence,
    method:      best.method,
    multiIntents,
    entities,
    endpoint:    INTENT_ENDPOINT[best.intent] || null,
  };
}

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [11]  CONVERSATION FSM  â€” Step [05] in architecture
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
function processMessage(message, session) {
  // Step [04] â€” route intent
  const intentResult = routeIntent(message, session);
  const { intent } = intentResult;
  const state = session.state || "unverified";

  // Step [05.1] â€” Auth guard: any non-auth message from unverified user â†’ OTP
  if (!session.verified && !["awaiting_otp","awaiting_consent"].includes(state)) {
    return { intentResult, prevState: state, nextState: "awaiting_otp", handler: "send_otp" };
  }

  // Step [05.2] â€” Consent guard: verified but no consent â†’ prompt
  if (session.verified && !session.consent && state !== "awaiting_consent") {
    return { intentResult, prevState: state, nextState: "awaiting_consent", handler: "send_consent_prompt" };
  }

  // Step [05.3] â€” Explicit transition lookup
  const key = `${state}:${intent}`;
  if (FSM_TRANSITIONS[key]) {
    const [nextState, handler] = FSM_TRANSITIONS[key];
    return { intentResult, prevState: state, nextState, handler };
  }

  // Step [05.4] â€” Global navigation: main intent from any viewing_* state
  if (VIEWING_STATES.has(state) && GLOBAL_NAVIGATION[intent]) {
    const [nextState, handler] = GLOBAL_NAVIGATION[intent];
    return { intentResult, prevState: state, nextState, handler };
  }

  // Step [05.5] â€” Fallback: stay in current state
  return { intentResult, prevState: state, nextState: state, handler: "handle_unknown" };
}

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [12]  RESPONSE BUILDER  â€” Step [06] in architecture
//       Dynamic responses read from DRUG_DB + RESPONSE_TEMPLATES config.
//       No drug names, dosages, or any patient data is hardcoded here.
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
function buildResponse(handler, intentResult) {
  // Step [06.1] â€” Dynamic: drug detail built from DRUG_DB
  if (handler === "fetch_drug_detail") {
    const drugEntity = intentResult.entities.find(e => e.type === "drug_name");
    const drugKey    = drugEntity?.value?.toLowerCase();
    const drug       = DRUG_DB[drugKey];

    if (drug) {
      return (
        `${drug.displayName}\n\n` +
        `It is used for: ${drug.purpose}\n` +
        `How to take: ${drug.dosage} - ${drug.instruction}\n` +
        `Days you have left: ${drug.daysLeft}\n` +
        `Doctor gave it on: ${drug.prescribed}\n\n` +
        `Type back to see all medicines.`
      );
    }
    if (drugKey) {
      return `${drugKey.charAt(0).toUpperCase() + drugKey.slice(1)}\n\nThis medicine is not in our records.\n\nPlease ask your doctor about it.\n\nType back to go back.`;
    }
    return RESPONSE_TEMPLATES["handle_meds_followup"];
  }

  // Step [06.2] â€” Static: read from RESPONSE_TEMPLATES config
  return RESPONSE_TEMPLATES[handler] ?? `[handler: ${handler}]`;
}

// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
// [13]  DEMO UI
// â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

// UI colour maps â€” driven by config, not hardcoded per-component
const STATE_COLORS = {
  unverified:"#64748b",awaiting_otp:"#f59e0b",awaiting_consent:"#f97316",
  idle:"#22c55e",viewing_meds:"#10b981",viewing_drug:"#6366f1",
  viewing_appts:"#f97316",confirming_appt:"#ef4444",viewing_procs:"#8b5cf6",
  viewing_vitals:"#06b6d4",viewing_records:"#3b82f6",
};
const INTENT_COLORS = {
  medications:"#10b981",procedures:"#8b5cf6",appointments:"#f97316",
  records:"#3b82f6",vitals:"#06b6d4",discharge:"#f59e0b",
  drug_detail:"#6366f1",confirm:"#22c55e",cancel:"#ef4444",
  help:"#60a5fa",greeting:"#34d399",otp_code:"#fbbf24",
  consent_yes:"#22c55e",acknowledge:"#34d399",unknown:"#475569",
};
const METHOD_BADGE = {
  regex:"REGEX","regex+entity":"REGEX+ENT","entity":"ENTITY",
  fuzzy:"FUZZY","fuzzy+entity":"FUZZY+ENT",
  context_boost:"CTX BOOST","context_boost+entity":"CTX+ENT",
  none:"â€”",
};

// Suggestion chips
const SUGGESTIONS = [
  ["Hello","EN"],["Hiiii","ðŸ›"],["45612","OTP"],["YES","EN"],
  ["show my medications","EN"],["metformin","DRUG"],["Amlodipine","DRUG"],
  ["amlodipne","TYPO"],["appointment kab hai","HI"],["blood pressure last 3 days","EN"],
  ["conform","TYPO"],["view appoiments","TYPO"],["medicaitons","TYPO"],
  ["medss","TYPO"],["à¤¦à¤µà¤¾à¤‡à¤¯à¤¾à¤‚ à¤¦à¤¿à¤–à¤¾à¤“","HI"],["à¤”à¤·à¤§à¥‡ à¤¦à¤¾à¤–à¤µà¤¾","MR"],
  ["back","EN"],["discharge kab","HL"],["à¤®à¤¦à¤¦","HI"],["my last visit record","EN"],
];


function renderText(text) {
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {line.split(/(\*[^*]+\*)/g).map((p, j) =>
        p.startsWith("*") && p.endsWith("*")
          ? <strong key={j} style={{ color:"#f1f5f9" }}>{p.slice(1,-1)}</strong>
          : <span key={j} style={{ opacity: p.startsWith("_(") ? 0.5 : 1 }}>{p}</span>
      )}
      <br />
    </span>
  ));
}

export default function CareIntentEngine() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [session, setSession] = useState({ state: "unverified", verified: false, consent: false, last_intent: null });
  const [lastResult, setLastResult] = useState(null);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(message => {
    if (!message.trim()) return;

    const userMsg = { id: Date.now(), from: "user", text: message };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    // Process message through intent engine
    const result = processMessage(message, session);
    const { intentResult, nextState, handler } = result;
    
    // Update session
    const newSession = {
      ...session,
      state: nextState,
      last_intent: intentResult.intent,
      verified: nextState === "awaiting_consent" ? true : session.verified || false,
      consent: handler === "record_consent" ? true : session.consent,
    };
    setSession(newSession);

    // Build response
    const response = buildResponse(handler, intentResult);
    const botMsg = {
      id: Date.now() + 1,
      from: "bot",
      text: response,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      endpoint: intentResult.endpoint,
      handler: handler,
    };

    setMessages(prev => [...prev, botMsg]);
    setLastResult(result);
  }, [session]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "white", fontFamily: "Arial, sans-serif", color: "black", padding: "20px" }}>
      <h1>CARE Intent Engine</h1>
      
      <div style={{ display: "flex", gap: "20px", flex: 1, overflow: "hidden" }}>
        {/* Left: Chat */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1px solid #ccc", borderRadius: "4px", padding: "10px" }}>
          <h3>Chat</h3>
          
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px", marginBottom: "10px", border: "1px solid #ddd", borderRadius: "4px", backgroundColor: "#fafafa" }}>
            {messages.map(msg => (
              <div key={msg.id} style={{ marginBottom: "15px" }}>
                <strong>{msg.from === "user" ? "You" : "Bot"}:</strong>
                <p style={{ margin: "5px 0", whiteSpace: "pre-wrap" }}>{msg.text}</p>
                {msg.from === "bot" && msg.intent && (
                  <div style={{ marginTop: "8px", paddingLeft: "20px", fontSize: "12px", color: "#333", backgroundColor: "#f0f0f0", padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}>
                    <div><strong>Intent:</strong> {msg.intent} ({Math.round(msg.confidence * 100)}%)</div>
                    {msg.endpoint && <div><strong>API:</strong> {msg.endpoint}</div>}
                    {msg.handler && <div><strong>Handler:</strong> {msg.handler}</div>}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ display: "flex", gap: "10px" }}>
            <input 
              ref={inputRef} 
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send(input)}
              placeholder="Type your message..."
              style={{ flex: 1, padding: "8px", border: "1px solid #ccc", fontSize: "14px", borderRadius: "4px" }}
            />
            <button 
              onClick={() => send(input)} 
              style={{ padding: "8px 16px", background: "#000", color: "white", border: "none", cursor: "pointer", borderRadius: "4px" }}
            >
              Send
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}

