// "AI department guide": suggests an OPD department from symptoms. Uses Gemini when GEMINI_API_KEY is set,
// otherwise a built-in keyword fallback so the feature always works.
const DEPARTMENTS = ['General Medicine', 'Cardiology', 'Neurology', 'Pediatrics', 'Orthopedics', 'ENT', 'Dermatology',
    'Gynecology & Obstetrics', 'Ophthalmology', 'Gastroenterology', 'Pulmonology', 'Urology', 'Psychiatry', 'Dentistry'];

const EMERGENCY = /(severe chest pain|can'?t breathe|cannot breathe|unconscious|stroke|heavy bleeding|suicid|seizure|poison)/i;

const RULES = [
    [/chest|heart|palpitation|blood pressure/i, 'Cardiology'], [/headache|migraine|dizz|numb|seizure|memory/i, 'Neurology'],
    [/child|baby|infant|kid/i, 'Pediatrics'], [/bone|joint|knee|back pain|fracture|shoulder/i, 'Orthopedics'],
    [/ear|nose|throat|sinus|tonsil|hearing/i, 'ENT'], [/skin|rash|acne|itch|eczema/i, 'Dermatology'],
    [/pregnan|period|menstrual|gyn/i, 'Gynecology & Obstetrics'], [/eye|vision|blur/i, 'Ophthalmology'],
    [/stomach|abdom|acidity|vomit|diarr|liver/i, 'Gastroenterology'], [/cough|breath|asthma|lung|wheez/i, 'Pulmonology'],
    [/urine|kidney|bladder/i, 'Urology'], [/anxiety|depress|stress|sleep/i, 'Psychiatry'], [/tooth|teeth|gum|dental/i, 'Dentistry'],
];

function fallback(message) {
    const hit = RULES.find(([re]) => re.test(message));
    return {
        department: hit ? hit[1] : 'General Medicine',
        reason: hit ? 'Based on the symptoms you described.' : 'A general physician can assess you and refer you if needed.',
    };
}

async function suggestDepartment(message) {
    let result = null;
    const key = process.env.GEMINI_API_KEY;
    if (key) {
        try {
            const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
            const prompt = `You help patients pick an OPD department. Available departments: ${DEPARTMENTS.join(', ')}.\nPatient says: """${message}"""\n` +
                `Reply ONLY with JSON: {"department": "<one of the list>", "reason": "<one short sentence>"}. Do not diagnose. If unsure use General Medicine.`;
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
            });
            if (res.ok) {
                const json = await res.json();
                const parsed = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
                if (DEPARTMENTS.includes(parsed.department)) result = { department: parsed.department, reason: String(parsed.reason || '').slice(0, 200) };
            }
        } catch (err) {
            console.warn('[ai] Gemini failed, using fallback:', err.message);
        }
    }
    return {
        ...(result || fallback(message)),
        emergency: EMERGENCY.test(message),
        disclaimer: 'This is a guide, not a diagnosis. For severe symptoms go to the Emergency department.',
    };
}

module.exports = { suggestDepartment, DEPARTMENTS };
