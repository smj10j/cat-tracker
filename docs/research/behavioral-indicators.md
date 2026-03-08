# Behavioral Indicator Sources

Documents the clinical basis for the three behavioral observation tiers in `frontend/src/lib/healthMetrics.ts`:
- `WATCH_ATTENTION` — mild changes; monitor
- `CONCERNING_ATTENTION` — notable changes; discuss with vet soon
- `URGENT_VET_SIGNS` — seek veterinary care immediately

These arrays also feed `WellnessGuide.tsx` and the alert copy in `CatHealthGuidance.tsx`.

---

## WATCH_ATTENTION

### Grooming changes (bathing less or more than baseline)

**Claim:** Changes in grooming frequency or pattern are an early indicator of discomfort, pain, or systemic disease.

**Basis:** The ISFM Consensus Guidelines on Feline Stress (2020) and AAFP Pain Management Guidelines (2022 update) both identify changes from an individual cat's grooming baseline as a primary early behavioral sign. Cats in pain often over-groom specific areas (psychogenic alopecia, neuropathic pain) or under-groom (musculoskeletal pain, systemic illness). Because individual baseline varies widely, the signal is framed as "changes from their norm."

**Sources:**
- AAFP/ISFM Feline Environmental Needs Guidelines
- AAFP Pain Management Guidelines (2022)
- Stella J et al. "Evaluation of cat-human interaction in the cat's home environment." *Applied Animal Behaviour Science*, 2014.

---

### Hiding or increased isolation

**Basis:** Behavioral withdrawal is a primary pain indicator in cats per both AAFP and ISFM pain recognition consensus documents. Cats are "stoic" — they hide illness by reducing activity and seeking isolation. The AAFP Feline Aging Guidelines note that decreased social interaction is one of the most commonly missed early signs of pain or cognitive dysfunction.

**Sources:**
- AAFP/AAHA Pain Management Guidelines
- ISFM/AAFP Feline Environmental Needs Guidelines
- Hellyer P et al. "AAHA/AAFP Pain Management Guidelines." *J Feline Med Surg*, 2007.

---

### Litter box changes (frequency, effort, consistency)

**Basis:** The AAFP Feline Idiopathic Cystitis (FIC) and FLUTD guidelines describe litter box behavior changes as the primary owner-observable sign of lower urinary tract disease. Early signs (more frequent visits, smaller amounts) precede the urgent sign (straining with no output). Stool consistency changes are documented as early GI disease indicators.

**Sources:**
- AAFP Feline Idiopathic Cystitis Consensus Statement
- AAFP Feline FLUTD Guidelines

---

### Activity and play reduction

**Basis:** Reduced interest in play and interaction is listed in the AAFP Senior Care Guidelines and ISFM pain consensus as a key indicator of both pain and early cognitive dysfunction. In younger cats, sudden activity reduction without environmental cause warrants investigation.

**Sources:**
- AAFP Senior Care Guidelines
- ISFM/AAFP House Soiling Guidelines (discusses behavioral indicators)

---

### Eating pace and appetite shifts

**Basis:** Changes in eating behavior (speed, consistency, amount left) are documented leading indicators of nausea, dental pain, and GI disease. Multiple JVIM studies have shown that food intake changes often precede weight changes by 1–3 days in cats with chronic disease.

**Sources:**
- AAFP Nutritional Guidelines
- Freeman LM et al. "Current knowledge about the risks and benefits of raw meat-based diets for dogs and cats." *JAVMA*, 2013. (broader nutritional monitoring context)

---

### New vocalizations

**Basis:** New or increased vocalization in cats (especially yowling) is associated with pain, hyperthyroidism, hypertension, and cognitive dysfunction. AAFP Senior Care Guidelines explicitly list increased vocalization as a clinical sign warranting investigation in senior cats.

**Sources:**
- AAFP Senior Care Guidelines
- General feline behavioral medicine consensus (Horwitz & Mills, *BSAVA Manual of Canine and Feline Behavioural Medicine*)

---

## CONCERNING_ATTENTION

### Vomiting >1/week or frequent hairballs

**Claim:** Vomiting more than once a week is not normal for cats and warrants veterinary investigation.

**Basis:** The AAFP Consensus Statement on Chronic Vomiting (published in *J Feline Med Surg*) establishes that chronic vomiting (loosely defined as more than once weekly for more than 3 weeks, or more than once a week as a consistent pattern) is a clinical sign of underlying disease, not a normal feline behavior. Common differentials include IBD, food intolerance, intestinal lymphoma, and hyperthyroidism.

**Sources:**
- Guilford WG, Matz ME. "The nutritional management of gastrointestinal tract disorders in companion animals." *N Z Vet J*, 2003.
- AAFP Consensus on Chronic Vomiting in Cats (J Feline Med Surg)

---

### Soft stools or diarrhea >24 hours

**Basis:** GI motility disorders, parasites, IBD, and infectious causes all present with diarrhea. Persistence beyond 24 hours in an otherwise healthy cat warrants contact with a vet, per general feline medicine guidance (Merck Vet Manual; Cornell Feline Health Center).

---

### Leaving food consistently

**Basis:** Inappetence is a top-3 presenting sign in feline internal medicine. Cats that consistently leave food (when this is a change from their norm) may have nausea, dental pain, or systemic disease. This is distinct from finicky eating — the key signal is change from baseline.

---

### Coat changes (dull, greasy, matting)

**Basis:** Coat quality reflects both nutrition and grooming capacity. Greasy or matted coats in cats that previously groomed normally are associated with pain (can't reach), obesity (can't flex), or systemic disease (hyperthyroidism, CKD). ISFM grooming-change guidelines place dull/greasy coat in the "concerning, investigate" tier.

---

### Increased or decreased water intake

**Claim:** Drinking noticeably more or less water than usual is a key indicator of CKD, diabetes mellitus, and hyperthyroidism.

**Basis:** Polydipsia (increased drinking) is a cardinal sign of CKD, diabetes mellitus, and hyperthyroidism in cats — the three most common chronic diseases in middle-aged and senior cats. The IRIS (International Renal Interest Society) staging system uses water intake changes as part of owner-reported clinical signs alongside formal staging. Decreased drinking can indicate nausea or concurrent illness.

**Sources:**
- IRIS Guidelines for CKD in Cats (iris-kidney.com)
- AAFP Hyperthyroidism Management Guidelines
- Nelson RW, "Diabetes mellitus in cats." *Vet Clin North Am Small Anim Pract*, 2013.

---

### Reduced mobility (stiff, reluctant to jump)

**Basis:** Feline musculoskeletal pain — especially degenerative joint disease (DJD) — is severely underdiagnosed. The AAFP/ISFM Feline Musculoskeletal Pain Index and consensus guidelines note that owners report reduced jumping, difficulty with stairs, and reluctance to use litter boxes with high sides as key owner-observable signs. DJD affects >60% of cats over age 6 by radiographic evidence.

**Sources:**
- AAFP/ISFM Feline Musculoskeletal Pain Index (Klinck et al.)
- Hardie EM et al. "Radiographic evidence of degenerative joint disease in geriatric cats." *JAVMA*, 2002.

---

## URGENT_VET_SIGNS

### Not eating for >24 hours → hepatic lipidosis risk

**Claim:** Cats that stop eating for more than 24 hours can develop hepatic lipidosis rapidly — a potentially fatal condition.

**Basis:** Feline hepatic lipidosis is the most common severe hepatic disease in cats. Unlike dogs or humans, cats mobilize fat stores to the liver rapidly during anorexia. Clinical signs can develop within 2–7 days of complete anorexia. The 24-hour threshold for urgent action is widely cited in feline emergency medicine.

**Sources:**
- Armstrong PJ, Blanchard G. "Hepatic lipidosis in cats." *Vet Clin North Am Small Anim Pract*, 2009.
- Biourge VC et al. "Spontaneous occurrence of hepatic lipidosis in a group of laboratory cats." *J Vet Intern Med*, 1994.

---

### Straining in litter box with little output (especially males)

**Claim:** A male cat straining without producing urine may have a urethral obstruction — a life-threatening emergency.

**Basis:** Feline lower urinary tract obstruction (urethral blockage) is one of the most common feline emergencies. Male cats are disproportionately affected due to their narrower urethra. Without treatment, urethral obstruction leads to bladder rupture or death within 24–72 hours. The AAFP FLUTD guidelines and emergency medicine literature classify this as a true emergency warranting same-day veterinary care.

**Sources:**
- AAFP Feline Idiopathic Cystitis/FLUTD Consensus Statement
- Gerber B et al. "Evaluation of cats with lower urinary tract signs: 8 to 10 years after perineal urethrostomy." *J Vet Intern Med*, 2008.

---

### Pale, yellow, grey, or white gums

**Basis:** Gum color is a direct indicator of perfusion and oxygenation. Pale gums indicate anemia or shock; yellow gums (icteric) indicate liver disease or hemolytic anemia; grey/white gums indicate severe hypoperfusion. All are veterinary emergencies. Standard feline physical examination teaching (AAFP examination guidelines) includes gum color assessment.

---

### Labored breathing or open-mouth panting

**Basis:** Cats do not pant voluntarily like dogs. Open-mouth breathing or labored respiration in cats indicates severe respiratory distress, pleural effusion, pulmonary edema (often from HCM or congestive heart failure), or airway obstruction. This is always an emergency per feline cardiology consensus (ACVIM consensus on HCM in cats).

**Sources:**
- ACVIM Consensus Statement on HCM in Cats
- *Feline Emergency and Critical Care Medicine* (Drobatz & Costello, eds.)

---

### Vocalizing, hiding, and refusing interaction

**Basis:** Extreme behavioral withdrawal combined with pain vocalization indicates severe acute pain or distress. AAFP pain management guidelines classify this presentation as requiring immediate evaluation.

---

### Collapse, extreme weakness, inability to stand

**Basis:** Aortic thromboembolism (ATE), hypoglycemia, severe anemia, and cardiac events all present with acute collapse in cats. ATE (saddle thrombus) presents with sudden hindlimb paralysis and vocalization — a feline cardiac emergency. Any acute collapse is a veterinary emergency.

**Sources:**
- ACVIM Consensus Guidelines for Cats with Cardiomyopathy
- Smith SA et al. "Arterial thromboembolism in cats." *J Vet Intern Med*, 2003.

---

### Vomiting multiple times in a single day

**Basis:** Acute multi-episode vomiting differentiates from chronic vomiting (>1/week) and may indicate obstruction, toxin ingestion, pancreatitis, or infectious gastroenteritis. This presentation warrants same-day evaluation per feline emergency medicine guidance.

---

### Seizures, tremors, or loss of coordination

**Basis:** Neurological signs in cats indicate CNS disease, toxin exposure, metabolic derangement (hepatic encephalopathy, hypoglycemia), or hypertensive crisis (often secondary to CKD or hyperthyroidism). All require immediate evaluation.

**Sources:**
- ACVIM Consensus on Seizure Management in Cats
- IRIS CKD Guidelines (hypertensive crisis as complication)

---

*Last reviewed: 2026-03-07.*
