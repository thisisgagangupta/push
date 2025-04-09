import os
import uuid
import base64
import logging
import pdfplumber
import boto3
import io
import datetime
import json
from typing import Optional, List, Dict, Any
from datetime import date, time
import datetime
import os
import tempfile
import subprocess
import requests
from fastapi import FastAPI, Request, File, UploadFile, HTTPException, status, Query, APIRouter
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from openai import OpenAI
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.colors import black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    PageBreak, Frame, Image, KeepTogether
)
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch, cm
from pydantic import BaseModel, Field
from weasyprint import HTML
from typing import List
from prompts import (
    CONTEXTS,
    FIXED_PROMPT_IMAGE,
    PROMPT_ECG,
    PROMPT_ECHOCARDIOGRAPHY,
    PROMPT_CARDIAC_MRI,
    PROMPT_CT_CORONARY_ANGIO,
    PROMPT_MRI_SPINE,
    PROMPT_MRI_HEAD,
    PROMPT_CT_HEAD,
    PROMPT_PET_BRAIN,
    PROMPT_SPECT_BRAIN,
    PROMPT_DSA_BRAIN,
    PROMPT_CAROTID_DOPPLER,
    PROMPT_TRANSCRANIAL_DOPPLER,
    PROMPT_MYELOGRAPHY
)

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MedMitra AI")

# origins = [
#     "http://localhost:5173",
# ]

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
origins = [FRONTEND_URL]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
client = OpenAI(api_key=OPENAI_API_KEY)

DATABASE_URI = os.getenv("DATABASE_URI", "")
engine = create_engine(
    DATABASE_URI,
    echo=True,
    pool_pre_ping=True,
    pool_recycle=1800,
    pool_size=5,
    max_overflow=10
)

aws_access_key_id = os.getenv("AWS_ACCESS_KEY_ID")
aws_secret_access_key = os.getenv("AWS_SECRET_ACCESS_KEY")
aws_region = os.getenv("AWS_REGION")
bucket_name = os.getenv("AWS_BUCKET_NAME")

s3_client = boto3.client(
    "s3",
    region_name=aws_region,
    aws_access_key_id=aws_access_key_id,
    aws_secret_access_key=aws_secret_access_key
)

def get_content_type(filename):
    fn_lower = filename.lower()
    if fn_lower.endswith(".pdf"):
        return "application/pdf"
    elif fn_lower.endswith(".png"):
        return "image/png"
    elif fn_lower.endswith(".jpg") or fn_lower.endswith(".jpeg"):
        return "image/jpeg"
    else:
        return "application/octet-stream"

def upload_to_s3(file_bytes, filename):
    unique_filename = f"{uuid.uuid4()}_{filename}"
    content_type = get_content_type(filename)
    s3_client.put_object(
        Bucket=bucket_name,
        Key=unique_filename,
        Body=file_bytes,
        ContentType=content_type,
        ACL='private'
    )
    return f"https://{bucket_name}.s3.{aws_region}.amazonaws.com/{unique_filename}"

def generate_presigned_url(s3_url, expiration=3600):
    if not s3_url:
        return None
    try:
        object_key = s3_url.split('/')[-1]
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': object_key},
            ExpiresIn=expiration
        )
        return presigned_url
    except Exception as e:
        logger.error(f"Error generating presigned URL: {e}")
        return None

def download_from_s3(s3_url: str) -> Optional[bytes]:
    if not s3_url or "amazonaws.com" not in s3_url:
        return None
    try:
        parts = s3_url.split("/")
        object_key = parts[-1]
        response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
        return response["Body"].read()
    except Exception as e:
        logger.error(f"Error downloading from S3: {e}")
        return None

def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        all_text = ""
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                all_text += page_text + "\n"
    return all_text

def create_prescription_pdf(prescription_data: Dict[str, Any], patient_name="Unknown") -> bytes:
    """
    Creates a styled PDF prescription using ReportLab.
    Modified to show "subRows" for variations of the same medicine.
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=30,
        bottomMargin=30
    )

    styles = getSampleStyleSheet()

    # 1) Define or override new styles for a more polished look
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Title'],
        fontSize=16,
        leading=20,
        textColor=colors.white,
        alignment=1,  # center
    )

    normal_style = ParagraphStyle(
        'NormalStyle',
        parent=styles['Normal'],
        fontSize=11,
        leading=14
    )

    subheader_style = ParagraphStyle(
        'SubHeaderStyle',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.black,
        spaceAfter=6
    )

    highlight_box_style = ParagraphStyle(
        'HighlightBoxStyle',
        parent=styles['Normal'],
        fontSize=11,
        leading=14,
        textColor=colors.black
    )

    analysis_style = ParagraphStyle(
        'AnalysisStyle',
        parent=styles['Normal'],
        fontSize=10,
        leading=12,
        leftIndent=10
    )

    flowables = []

    # 2) Top “PRESCRIPTION” color band
    from reportlab.platypus import Table
    title_paragraph = Paragraph("<b>PRESCRIPTION</b>", title_style)

    color_band = Table(
        [[title_paragraph]],
        colWidths=[doc.width],
        rowHeights=[0.4 * inch]
    )
    color_band.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), HexColor("#673AB7")),  # deep purple
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER')
    ]))
    flowables.append(color_band)
    flowables.append(Spacer(1, 12))

    # 3) Date/Time
    current_date = datetime.datetime.now().strftime("%d-%b-%Y %I:%M %p")
    date_paragraph = Paragraph(f"<b>Date:</b> {current_date}", normal_style)
    flowables.append(date_paragraph)
    flowables.append(Spacer(1, 8))

    # 4) Highlighted Box for Patient Info
    patient_info = []
    patient_info.append(Paragraph(f"<b>Patient Name:</b> {patient_name}", highlight_box_style))

    age_val = prescription_data.get("age", "")
    if age_val:
        patient_info.append(Paragraph(f"<b>Age:</b> {age_val}", highlight_box_style))

    gender_val = prescription_data.get("gender", "")
    if gender_val:
        patient_info.append(Paragraph(f"<b>Gender:</b> {gender_val}", highlight_box_style))

    contact_val = prescription_data.get("contact", "")
    if contact_val:
        patient_info.append(Paragraph(f"<b>Contact:</b> {contact_val}", highlight_box_style))

    bp = prescription_data.get("bp", "")
    if bp:
        patient_info.append(Paragraph(f"<b>BP:</b> {bp}", highlight_box_style))

    pulse = prescription_data.get("pulse", "")
    if pulse:
        patient_info.append(Paragraph(f"<b>Pulse:</b> {pulse}", highlight_box_style))

    temperature = prescription_data.get("temperature", "")
    if temperature:
        patient_info.append(Paragraph(f"<b>Temperature:</b> {temperature}", highlight_box_style))

    bmi_val = prescription_data.get("bmi", "")
    if bmi_val:
        patient_info.append(Paragraph(f"<b>BMI:</b> {bmi_val}", highlight_box_style))

    complaints_str = prescription_data.get("complaints", "")
    if complaints_str:
        patient_info.append(Paragraph(f"<b>Complaints:</b> {complaints_str}", highlight_box_style))

    patient_info_table = Table([[p] for p in patient_info], colWidths=[doc.width * 0.9])
    patient_info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f3f3fe")),  # subtle purple tint
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#D1C4E9")),      # light purple border
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    flowables.append(patient_info_table)
    flowables.append(Spacer(1, 12))


    include_analysis = prescription_data.get("include_analysis", True)

    if include_analysis:
        medical_imaging_analysis = prescription_data.get("medical_imaging_analysis", "")
        lab_report_analysis = prescription_data.get("lab_report_analysis", "")
        prescription_analysis = prescription_data.get("prescription_analysis", "")

        # Check if any analysis actually has content
        has_imaging = bool(medical_imaging_analysis and medical_imaging_analysis.strip())
        has_lab = bool(lab_report_analysis and lab_report_analysis.strip())
        has_prescription = bool(prescription_analysis and prescription_analysis.strip())

        has_any_content = has_imaging or has_lab or has_prescription

        # Only add the section if there's actual content
        if has_any_content:
            flowables.append(Paragraph("Clinical Analysis", subheader_style))

            if has_imaging:
                flowables.append(Paragraph("<b>Medical Imaging Analysis:</b>", normal_style))
                flowables.append(Paragraph(medical_imaging_analysis, analysis_style))
                flowables.append(Spacer(1, 8))

            if has_lab:
                flowables.append(Paragraph("<b>Lab Report Analysis:</b>", normal_style))
                flowables.append(Paragraph(lab_report_analysis, analysis_style))
                flowables.append(Spacer(1, 8))

            if has_prescription:
                flowables.append(Paragraph("<b>Previous Prescription Analysis:</b>", normal_style))
                flowables.append(Paragraph(prescription_analysis, analysis_style))

            flowables.append(Spacer(1, 12))

    # 5) Diagnosis
    diag = prescription_data.get("diagnosis", "")
    if diag:
        flowables.append(Paragraph("Diagnosis", subheader_style))
        flowables.append(Paragraph(diag, normal_style))
        flowables.append(Spacer(1, 8))

    # 6) Tests
    tests_list = prescription_data.get("tests", [])
    if tests_list:
        flowables.append(Paragraph("Tests Prescribed", subheader_style))
        if isinstance(tests_list, list):
            for t in tests_list:
                flowables.append(Paragraph(f"• {t}", normal_style))
        else:
            flowables.append(Paragraph(str(tests_list), normal_style))
        flowables.append(Spacer(1, 8))

    # 7) Medications Table
    medicine_rows = prescription_data.get("medicineTable", [])
    if medicine_rows:
        flowables.append(Paragraph("Medications", subheader_style))

        header_data = [
            Paragraph("<b>Medicine</b>", normal_style),
            Paragraph("<b>Dosage</b>", normal_style),
            Paragraph("<b>Unit</b>", normal_style),
            Paragraph("<b>Timing</b>", normal_style),
            Paragraph("<b>Duration</b>", normal_style),
            Paragraph("<b>Notes</b>", normal_style),
        ]
        table_data = [header_data]

        for row in medicine_rows:
            med_cell = Paragraph(row.get("medicine", ""), normal_style)
            dos_cell = Paragraph(row.get("dosage", ""), normal_style)
            unit_cell = Paragraph(row.get("unit", ""), normal_style)
            when_cell = Paragraph(row.get("when", ""), normal_style)
            dur_cell = Paragraph(row.get("duration", ""), normal_style)
            notes_cell = Paragraph(row.get("notes", ""), normal_style)

            # Append the “main row”
            table_data.append([med_cell, dos_cell, unit_cell, when_cell, dur_cell, notes_cell])

            # Now check for subRows. If present, create additional lines:
            sub_rows = row.get("subRows", [])
            if sub_rows and isinstance(sub_rows, list):
                for sr in sub_rows:
                    # For subRows, leave medicine cell blank or put “→ Variation”
                    sub_med_cell = Paragraph("→ Variation", normal_style)
                    sdos = Paragraph(sr.get("dosage", ""), normal_style)
                    sunit = Paragraph(sr.get("unit", ""), normal_style)
                    swhen = Paragraph(sr.get("when", ""), normal_style)
                    sdur = Paragraph(sr.get("duration", ""), normal_style)
                    snotes = Paragraph(sr.get("notes", ""), normal_style)

                    table_data.append([sub_med_cell, sdos, sunit, swhen, sdur, snotes])

        meds_table = Table(table_data, colWidths=[1.6 * inch, 0.8 * inch, 0.6 * inch, 1.0 * inch, 0.8 * inch, 2.0 * inch])
        meds_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.lightgrey),
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EDE7F6")),  # soft purple header
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 1), (-1, -1), 'LEFT'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#FAF8FD")]),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))

        flowables.append(meds_table)
        flowables.append(Spacer(1, 12))

    else:
        # If "drugs" is provided but not in "medicineTable" format
        raw_drugs = prescription_data.get("drugs", [])
        if raw_drugs:
            flowables.append(Paragraph("Medications", subheader_style))
            if isinstance(raw_drugs, list):
                for d in raw_drugs:
                    flowables.append(Paragraph(f"• {d}", normal_style))
            else:
                flowables.append(Paragraph(str(raw_drugs), normal_style))
            flowables.append(Spacer(1, 10))

    # 8) Follow-up
    follow_up = prescription_data.get("follow_up", "")
    if follow_up:
        flowables.append(Paragraph("Follow Up Instructions", subheader_style))
        flowables.append(Paragraph(follow_up, normal_style))
        flowables.append(Spacer(1, 10))

    # 9) Signature line
    flowables.append(Spacer(1, 24))
    flowables.append(Paragraph("<b>________________________________________</b>", normal_style))
    flowables.append(Paragraph("Doctor's Signature", normal_style))

    doc.build(flowables)
    pdf_value = buf.getvalue()
    buf.close()
    return pdf_value



def analyze_medical_image(image_data_b64, custom_prompt: str = None):
    prompt_to_use = custom_prompt if custom_prompt is not None else FIXED_PROMPT_IMAGE
    response = client.chat.completions.create(
        model="o1",
        messages=[{
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_to_use},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data_b64}"}}
            ]
        }]
    )
    return response.choices[0].message.content.strip()

def analyze_lab_report_text(lab_report_text: str) -> str:
    messages = [
        {"role": "system", "content": "You are an expert physician with a strong background in laboratory medicine."},
        {
            "role": "user",
            "content": (
                "You have been provided with the following lab report information:\n\n"
                f"{lab_report_text}\n\n"
                "Please analyze this lab report in detail and provide:\n\n"
                "1. **Key Abnormalities and Their Significance**:\n"
                "   - List all abnormal lab values. Include normal ranges where applicable.\n"
                "   - Explain what each abnormal value might indicate clinically.\n\n"
                "2. **Possible Diagnosis**:\n"
                "   - Provide the single most likely diagnosis based on the lab data.\n"
                "   - Briefly explain why.\n\n"
                "3. **Other Differential Diagnoses**:\n"
                "   - List other possible conditions and their likelihood.\n\n"
                "4. **Prognosis**:\n"
                "   - Comment on the outlook for the most likely condition.\n"
                "   - Mention any factors that could change this.\n\n"
                "5. **Suggested Next Steps**:\n"
                "   - Recommend additional tests, treatments, or referrals.\n\n"
                "Please avoid generic disclaimers; provide clear, concise, and clinically oriented information."
            ),
        }
    ]
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=2048,
        # temperature=0.5
    )
    return response.choices[0].message.content.strip()

def analyze_prescription_text_or_image(content, is_pdf=False) -> str:
    if is_pdf:
        messages = [
            {
                "role": "system",
                "content": "You are a medical assistant with expertise in evaluating prescription details."
            },
            {
                "role": "user",
                "content": (
                    "Below is the text from a prescription. Please provide a structured summary with the following details:\n\n"
                    "1. **Medications Listed**:\n"
                    "   - Drug names, formulations (e.g., tablet, capsule, injection), and dosages.\n\n"
                    "2. **Dosage and Instructions**:\n"
                    "   - Frequency, route of administration, duration, and any relevant food/drink instructions.\n\n"
                    "3. **Potential Interactions or Warnings**:\n"
                    "   - Note any known drug interactions, contraindications, or common side effects.\n\n"
                    f"Prescription Text:\n{content}\n\n"
                    "Avoid providing disclaimers about needing further consultation. Just summarize the key points."
                )
            }
        ]
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            max_tokens=1500,
            # temperature=0.5
        )
        return response.choices[0].message.content.strip()
    else:
        prompt_for_prescription_image = (
            "You are a medical assistant with expertise in interpreting handwritten or image-based prescriptions. "
            "An image encoded in Base64 has been provided containing prescription details. "
            "Please extract and clearly summarize the following:\n\n"
            "1. **Medications**:\n"
            "   - List each medication with the name, strength, and formulation if discernible.\n"
            "2. **Dosage Instructions**:\n"
            "   - For each medication, specify the dosage amount, frequency, and route of administration (if visible).\n"
            "3. **Additional Notes**:\n"
            "   - Any special instructions (e.g., take with food, avoid alcohol), known side effects, or interactions.\n\n"
            "Provide your response in a concise, organized manner without adding unnecessary disclaimers. "
            "If certain parts of the prescription are illegible, state 'Illegible' rather than guessing."
        )
        response = client.chat.completions.create(
            model="o1",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_for_prescription_image},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{content}"}}
                ]
            }]
        )
        return response.choices[0].message.content.strip()

def get_medical_advice(
    department: str,
    chief_complaint: str,
    history_presenting_illness: str,
    past_history: str,
    personal_history: str,
    family_history: str,
    age: int,
    gender: str,
    obg_history: str = "",
    image_analysis_text: str = "",
    lab_analysis_text: str = "",
    prescription_analysis_text: str = "",
    allergies: str = "",
    medication_history: str = "",
    surgical_history: str = "",
    bp: str = "",
    pulse: str = "",
    temperature: str = "",
) -> str:
    context = CONTEXTS.get(department, "")

    prompt_text = f"""
Department: {department}
Context: {context}
Age: {age}
Gender: {gender}
Chief Complaint: {chief_complaint}
History of Presenting Illness: {history_presenting_illness}
Past History: {past_history}
Personal History: {personal_history}
Family History: {family_history}
OBG History: {obg_history}
Allergies: {allergies}
Medication History: {medication_history}
Surgical History: {surgical_history}
Vital Signs: BP: {bp}, Pulse: {pulse}, Temperature: {temperature}

Medical Image Analysis (if any): {image_analysis_text}
Lab Report Analysis (if any): {lab_analysis_text}
Prescription Analysis (if any): {prescription_analysis_text}

---
Please analyze the patient's data in a thorough and detailed manner, providing clinical rationale wherever possible. Explain how each piece of information factors into the patient’s overall condition, potential diagnoses, and recommended management. 
Return your final answer in bullet-point style with the **exact** headings below. 
For each heading, enclose the heading name in double asterisks, and then list bullet points (each line beginning with "- ") under it.
If there's no content for a heading, write "None." under that heading. 

**Medical Image Analysis (if any)**
- Provide a detailed interpretation of any imaging findings.
- Include potential implications or differential diagnoses linked to the imaging.

**Lab Report Analysis (if any)**
- Summarize notable lab values (e.g., CBC, metabolic panel, etc.), including normal ranges and specific abnormalities.
- Discuss possible reasons for abnormalities and how they correlate clinically.

**Prescription Analysis (if any)**
- Detail the current prescriptions, intended uses, dosages, and any significant interactions or side effects.

**Most Likely Diagnosis**
- State the single top diagnosis in this format: "DiagnosisName: short explanation..."
- Expand briefly on pathophysiology, risk factors, or relevant guidelines.

**Other Possible Diagnoses**
- List other plausible diagnoses from most likely to less likely, "DiagnosisName: short explanation..."
- Provide a brief rationale for each alternative, mentioning distinguishing features.

**Suggested Tests**
- Provide recommended tests.

**Prognosis**
- Prognosis for the most likely and other possible conditions.

**Suggested Treatment Plan**
- Include medication suggestions, typical dosages, route of administration, and duration.
- Note any important contraindications or adverse effects.
- Mention supportive therapies or lifestyle modifications as needed.

**Case Summary**
(Short concluding summary)

If no data is available for a heading, write 'None.' in that section.
Avoid disclaimers about needing further specialist follow-up.
"""

    messages = [
        {
            "role": "system",
            "content": (
                "You are a helpful assistant specialized in medical diagnosis and treatment. "
                "No disclaimers, just your best medical reasoning."
            )
        },
        {"role": "user", "content": prompt_text}
    ]

    try:
        response = client.chat.completions.create(model="gpt-4", messages=messages)
        return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error generating medical advice: {e}")
        return "Error generating medical advice. Please try again later."

def generate_prescription(diagnosis, tests, treatments, patient_info: dict = None) -> dict:

    # Safely extract patient fields
    if not patient_info:
        patient_info = {}
    p_name = patient_info.get("name", "Unknown")
    p_age = str(patient_info.get("age", "?"))
    p_gender = patient_info.get("gender", "Unknown")
    
    # Additional fields for context
    department = patient_info.get("department", "")
    chief_complaint = patient_info.get("chief_complaint", "")
    hpi = patient_info.get("history_presenting_illness", "")
    past_hist = patient_info.get("past_history", "")
    personal_hist = patient_info.get("personal_history", "")
    family_hist = patient_info.get("family_history", "")
    obg_hist = patient_info.get("obg_history", "")
    allergies = patient_info.get("allergies", "")
    med_hist = patient_info.get("medication_history", "")
    surg_hist = patient_info.get("surgical_history", "")
    bp = patient_info.get("bp", "")
    pulse = patient_info.get("pulse", "")
    temp = patient_info.get("temperature", "")
    bmi = patient_info.get("bmi", "")
    spo2 = patient_info.get("spo2", "")
    image_analysis = patient_info.get("image_analysis_text", "")
    lab_analysis = patient_info.get("lab_analysis_text", "")
    prescription_analysis = patient_info.get("prescription_analysis_text", "")

    # Build a fuller patient info block for GPT's context
    extended_patient_info = f"""
Patient Name: {p_name} ({p_age} y/o, {p_gender})
Department: {department}

Chief Complaint: {chief_complaint}
History of Presenting Illness: {hpi}
Past History: {past_hist}
Personal History: {personal_hist}
Family History: {family_hist}
OBG History: {obg_hist}
Allergies: {allergies}
Medication History: {med_hist}
Surgical History: {surg_hist}

Vitals:
  BP: {bp}
  Pulse: {pulse}
  Temperature: {temp}
  BMI: {bmi}
  SPO2: {spo2}

Image Analysis (if any): {image_analysis}
Lab Analysis (if any): {lab_analysis}
Prescription Analysis (if any): {prescription_analysis}
""".strip()

    # Final prompt combining the newly enriched patient info
    prompt = f"""
You are a medical expert. Based on the details below, generate a concise prescription.

Diagnosis: {diagnosis}

Extended Patient Data:
{extended_patient_info}

Recommended Tests: {", ".join(tests)}
Proposed Treatments: {", ".join(treatments)}

Please provide your response as valid JSON with the keys:
- 'diagnosis'
- 'drugs' (array of medication entries or strings)
- 'instructions'
- 'tests' (array of test strings)
- 'follow_up'
"""

    try:
        messages = [
            {"role": "system", "content": "You are ChatGPT, a helpful medical assistant."},
            {"role": "user", "content": prompt}
        ]
        response = client.chat.completions.create(
            model="gpt-4",
            messages=messages,
            max_tokens=1800,
            # temperature=0.7
        )
        gpt_content = response.choices[0].message.content.strip()
        
        # Attempt to parse GPT's JSON output
        prescription = json.loads(gpt_content)
        return prescription

    except Exception as e:
        logger.error(f"generate_prescription error: {e}")
        # Fallback if GPT fails or sends invalid JSON
        return {
            "diagnosis": diagnosis,
            "drugs": [],
            "instructions": [],
            "tests": tests,
            "follow_up": "Follow up with your doctor."
        }

def is_pdf_file(url: str) -> bool:
    url_lower = url.lower()
    return url_lower.endswith(".pdf")

def is_image_file(url: str) -> bool:
    url_lower = url.lower()
    return url_lower.endswith(".png") or url_lower.endswith(".jpg") or url_lower.endswith(".jpeg")

def analyze_lab_report_image(image_b64: str) -> str:
    prompt_for_lab_image = (
        "You have been provided an IMAGE of a lab report. "
        "Identify key lab values or findings that can be discerned visually, "
        "and provide a concise medical interpretation. Avoid disclaimers."
    )
    return analyze_medical_image(image_b64, custom_prompt=prompt_for_lab_image)

def analyze_medical_imaging_pdf(text_content: str) -> str:
    messages = [
        {"role": "system", "content": "You are a medical imaging specialist."},
        {"role": "user", "content": (
            "Below is the textual description of a medical imaging study (PDF). "
            "Please summarize the key radiological findings, possible diagnoses, and any recommendations.\n\n"
            f"{text_content}"
        )}
    ]
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        max_tokens=2048,
        # temperature=0.5
    )
    return response.choices[0].message.content.strip()

def insert_patient_complaints(patient_id: int, version_id: int, complaint_details: list):
    """
    Insert each row from 'chief_complaint_details' (or a derived list) into
    the patient_chief_complaints table, linking them to both patient_id and version_id.
    """
    if not complaint_details:
        return
    query = text("""
        INSERT INTO patient_chief_complaints
        (patient_id, version_id, complaint, frequency, severity, duration)
        VALUES (:pid, :vid, :c, :f, :s, :d)
    """)
    with engine.begin() as conn:
        for row in complaint_details:
            conn.execute(query, {
                "pid": patient_id,
                "vid": version_id,
                "c": row.get("complaint",""),
                "f": row.get("frequency",""),
                "s": row.get("severity",""),
                "d": row.get("duration","")
            })

def insert_patient_version(
    patient_id: int,
    name: str,
    age: int,
    gender: str,
    contact_number: str,
    department: str,
    chief_complaint: str,
    history_presenting_illness: str,
    past_history: str,
    personal_history: str,
    family_history: str,
    obg_history: str = None,
    lab_report_url: str = None,
    medical_imaging_url: str = None,
    previous_prescription_url: str = None,
    cardiology_imaging_type: str = None,
    medical_advice: str = None,
    case_summary: str = None,
    final_diagnosis: str = None,
    final_tests: str = None,
    final_treatment_plan: str = None,
    blood_group: str = None,
    preferred_language: str = None,
    email: str = None,
    address: str = None,
    city: str = None,
    pin: str = None,
    referred_by: str = None,
    channel: str = None,
    bp: str = None,
    pulse: str = None,
    height: str = None,
    weight: str = None,
    head_round: str = None,
    temperature: str = None,
    bmi: str = None,
    spo2: str = None,
    lmp: str = None,
    edd: str = None,
    allergies: str = None,
    medication_history: str = None,
    surgical_history: str = None,
    neurology_imaging_type: str = None,
    uhid: str = None,
    guardian_name: str = None,
    consultant_doctor: str = None
):
    logger.info(f"Inserting new version row for patient {patient_id}.")
    if lmp == "":
        lmp = None
    if edd == "":
        edd = None

    version_query = text("""
        INSERT INTO patient_info_versions (
            patient_id,
            version_timestamp,
            patient_name,
            age,
            gender,
            contact_number,
            department,
            chief_complaint,
            history_of_presenting_illness,
            past_history,
            personal_history,
            family_history,
            obg_history,
            lab_report_url,
            medical_imaging_url,
            previous_prescription_url,
            cardiology_imaging_type,
            medical_advice,
            case_summary,
            final_diagnosis,
            final_tests,
            final_treatment_plan,
            blood_group,
            preferred_language,
            email,
            address,
            city,
            pin,
            referred_by,
            channel,
            bp,
            pulse,
            height,
            weight,
            head_round,
            temperature,
            bmi,
            spo2,
            lmp,
            eddv,
            allergies,
            medication_history,
            surgical_history,
            neurology_imaging_type,
            uhid,
            guardian_name,
            consultant_doctor
        ) VALUES (
            :pid,
            now() at time zone 'Asia/Kolkata',
            :pname,
            :page,
            :pgender,
            :pcontact,
            :pdept,
            :pchief,
            :phpi,
            :ppast,
            :ppers,
            :pfam,
            :pobg,
            :plab,
            :pimg,
            :ppres,
            :cardio_img,
            :madvice,
            :pcase,
            :fdx,
            :ftests,
            :ftreat,
            :bg,
            :pref_lang,
            :em,
            :addr,
            :cty,
            :pinn,
            :refby,
            :chnl,
            :bpv,
            :plse,
            :hgt,
            :wgt,
            :hdround,
            :temp,
            :bmival,
            :spo,
            :lmpp,
            :eddv,
            :allergies,
            :medhist,
            :surghist,
            :neuro_img,
            :uhid,
            :gname,
            :doc
        )
        RETURNING id
    """)

    with engine.begin() as conn:
        result = conn.execute(version_query, {
            'pid': patient_id,
            'pname': name,
            'page': age,
            'pgender': gender,
            'pcontact': contact_number,
            'pdept': department or "",
            'pchief': chief_complaint or "",
            'phpi': history_presenting_illness or "",
            'ppast': past_history or "",
            'ppers': personal_history or "",
            'pfam': family_history or "",
            'pobg': obg_history or "",
            'plab': lab_report_url,
            'pimg': medical_imaging_url,
            'ppres': previous_prescription_url,
            'cardio_img': cardiology_imaging_type or "",
            'madvice': medical_advice,
            'pcase': case_summary,
            'fdx': final_diagnosis,
            'ftests': final_tests,
            'ftreat': final_treatment_plan,
            'bg': blood_group or "",
            'pref_lang': preferred_language or "",
            'em': email or "",
            'addr': address or "",
            'cty': city or "",
            'pinn': pin or "",
            'refby': referred_by or "",
            'chnl': channel or "",
            'bpv': bp or "",
            'plse': pulse or "",
            'hgt': height or "",
            'wgt': weight or "",
            'hdround': head_round or "",
            'temp': temperature or "",
            'bmival': bmi or "",
            'spo': spo2 or "",
            'lmpp': lmp,
            'eddv': edd,
            'allergies': allergies or "",
            'medhist': medication_history or "",
            'surghist': surgical_history or "",
            'neuro_img': neurology_imaging_type or "",
            'uhid': uhid or "",
            'gname': guardian_name or "",
            'doc': consultant_doctor or ""
        })
        new_version_id = result.fetchone()[0]

    return new_version_id

def update_patient_info(
    patient_id: int,
    name: str,
    age: int,
    gender: str,
    contact_number: str,
    department: str,
    chief_complaint: str,
    history_presenting_illness: str,
    past_history: str,
    personal_history: str,
    family_history: str,
    obg_history: str = None,
    lab_report_url: str = None,
    medical_imaging_url: str = None,
    previous_prescription_url: str = None,
    cardiology_imaging_type: str = None,
    blood_group: str = None,
    preferred_language: str = None,
    email: str = None,
    address: str = None,
    city: str = None,
    pin: str = None,
    referred_by: str = None,
    channel: str = None,
    bp: str = None,
    pulse: str = None,
    height: str = None,
    weight: str = None,
    head_round: str = None,
    temperature: str = None,
    bmi: str = None,
    spo2: str = None,
    lmp: str = None,
    edd: str = None,
    allergies: str = None,
    medication_history: str = None,
    surgical_history: str = None,
    neurology_imaging_type: str = None,
    medical_advice: str = None,
    uhid: str = None,
    guardian_name: str = None,
    consultant_doctor: str = None
):
    logger.info(f"Updating patient_info ID: {patient_id}")
    if lmp == "":
        lmp = None
    if edd == "":
        edd = None

    update_query = text("""
        UPDATE patient_info
        SET
            patient_name = :pname,
            age = :page,
            gender = :pgender,
            contact_number = :pcontact,
            department = :pdept,
            chief_complaint = :pchief,
            history_presenting_illness = :phpi,
            past_history = :ppast,
            personal_history = :ppers,
            family_history = :pfam,
            obg_history = :pobg,
            lab_report_url = :plab,
            medical_imaging_url = :pimg,
            previous_prescription_url = :ppres,
            cardiology_imaging_type = :cardio_img,
            blood_group = :bg,
            preferred_language = :pref_lang,
            email = :em,
            address = :addr,
            city = :cty,
            pin = :pinn,
            referred_by = :refby,
            channel = :chnl,
            bp = :bpv,
            pulse = :plse,
            height = :hgt,
            weight = :wgt,
            head_round = :hdround,
            temperature = :temp,
            bmi = :bmival,
            spo2 = :spo,
            lmp = :lmpp,
            edd = :eddv,
            allergies = :algs,
            medication_history = :medhist,
            surgical_history = :surghist,
            neurology_imaging_type = :neuro_img,
            medical_advice = :mad,
            uhid = :uhid,
            guardian_name = :gname,
            consultant_doctor = :cdoctor
        WHERE id = :pid
    """)

    with engine.begin() as conn:
        conn.execute(update_query, {
            'pid': patient_id,
            'pname': name,
            'page': age,
            'pgender': gender,
            'pcontact': contact_number,
            'pdept': department or "",
            'pchief': chief_complaint or "",
            'phpi': history_presenting_illness or "",
            'ppast': past_history or "",
            'ppers': personal_history or "",
            'pfam': family_history or "",
            'pobg': obg_history or "",
            'plab': lab_report_url,
            'pimg': medical_imaging_url,
            'ppres': previous_prescription_url,
            'cardio_img': cardiology_imaging_type or "",
            'bg': blood_group or "",
            'pref_lang': preferred_language or "",
            'em': email or "",
            'addr': address or "",
            'cty': city or "",
            'pinn': pin or "",
            'refby': referred_by or "",
            'chnl': channel or "",
            'bpv': bp or "",
            'plse': pulse or "",
            'hgt': height or "",
            'wgt': weight or "",
            'hdround': head_round or "",
            'temp': temperature or "",
            'bmival': bmi or "",
            'spo': spo2 or "",
            'lmpp': lmp,
            'eddv': edd,
            'algs': allergies or "",
            'medhist': medication_history or "",
            'surghist': surgical_history or "",
            'neuro_img': neurology_imaging_type or "",
            'mad': medical_advice,
            'uhid': uhid or "",
            'gname': guardian_name or "",
            'cdoctor': consultant_doctor or "",
        })

    # Now insert a new version row (and return its ID)
    new_version_id = insert_patient_version(
        patient_id=patient_id,
        name=name,
        age=age,
        gender=gender,
        contact_number=contact_number,
        department=department or "",
        chief_complaint=chief_complaint or "",
        history_presenting_illness=history_presenting_illness or "",
        past_history=past_history or "",
        personal_history=personal_history or "",
        family_history=family_history or "",
        obg_history=obg_history or "",
        lab_report_url=lab_report_url,
        medical_imaging_url=medical_imaging_url,
        previous_prescription_url=previous_prescription_url,
        cardiology_imaging_type=cardiology_imaging_type or "",
        neurology_imaging_type=neurology_imaging_type or "",
        medical_advice=medical_advice,
        blood_group=blood_group,
        preferred_language=preferred_language,
        email=email,
        address=address,
        city=city,
        pin=pin,
        referred_by=referred_by,
        channel=channel,
        bp=bp,
        pulse=pulse,
        height=height,
        weight=weight,
        head_round=head_round,
        temperature=temperature,
        bmi=bmi,
        spo2=spo2,
        lmp=lmp,
        edd=edd,
        allergies=allergies,
        medication_history=medication_history,
        surgical_history=surgical_history,
        uhid=uhid,
        guardian_name=guardian_name,
        consultant_doctor=consultant_doctor
    )

    return new_version_id

def update_patient_final_choices(
    patient_id: int,
    final_diagnosis: str,
    final_tests: str,
    final_treatment_plan: str,
    case_summary: str = None
):
    logger.info(f"Updating final choices for patient {patient_id}")
    update_query = text("""
        UPDATE patient_info
        SET final_diagnosis = :dx,
            final_tests = :tests,
            final_treatment_plan = :treat,
            case_summary = :csum
        WHERE id = :pid
    """)
    with engine.begin() as conn:
        conn.execute(update_query, {
            'dx': final_diagnosis,
            'tests': final_tests,
            'treat': final_treatment_plan,
            'csum': case_summary or "",
            'pid': patient_id
        })

        last_version_q = text("""
            SELECT *
            FROM patient_info_versions
            WHERE patient_id = :pid
            ORDER BY version_timestamp DESC
            LIMIT 1
        """)
        last_ver = conn.execute(last_version_q, {'pid': patient_id}).mappings().first()

        sel_query = text("SELECT * FROM patient_info WHERE id = :pid")
        row = conn.execute(sel_query, {'pid': patient_id}).mappings().first()

        if not row:
            return

        new_case_summary = row["case_summary"]
        new_final_dx = row["final_diagnosis"]
        new_tests = row["final_tests"]
        new_treat = row["final_treatment_plan"]

        if not last_ver:
            insert_patient_version(
                patient_id=patient_id,
                name=row["patient_name"],
                age=row["age"],
                gender=row["gender"],
                contact_number=row["contact_number"],
                department=row["department"],
                chief_complaint=row["chief_complaint"],
                history_presenting_illness=row["history_of_presenting_illness"],
                past_history=row["past_history"],
                personal_history=row["personal_history"],
                family_history=row["family_history"],
                obg_history=row["obg_history"],
                lab_report_url=row["lab_report_url"],
                medical_imaging_url=row["medical_imaging_url"],
                previous_prescription_url=row["previous_prescription_url"],
                cardiology_imaging_type=row.get("cardiology_imaging_type", ""),
                neurology_imaging_type=row.get("neurology_imaging_type", ""),
                medical_advice=row["medical_advice"],
                case_summary=new_case_summary,
                final_diagnosis=new_final_dx,
                final_tests=new_tests,
                final_treatment_plan=new_treat,
                blood_group=row.get("blood_group", ""),
                preferred_language=row.get("preferred_language", ""),
                email=row.get("email", ""),
                address=row.get("address", ""),
                city=row.get("city", ""),
                pin=row.get("pin", ""),
                referred_by=row.get("referred_by", ""),
                channel=row.get("channel", ""),
                bp=row.get("bp", ""),
                pulse=row.get("pulse", ""),
                height=row.get("height", ""),
                weight=row.get("weight", ""),
                head_round=row.get("head_round", ""),
                temperature=row.get("temperature", ""),
                bmi=row.get("bmi", ""),
                spo2=row.get("spo2", ""),
                lmp=row.get("lmp"),
                edd=row.get("edd"),
                allergies=row.get("allergies", ""),
                medication_history=row.get("medication_history", ""),
                surgical_history=row.get("surgical_history", "")
            )
            return

        last_ts = last_ver["version_timestamp"]
        now = datetime.datetime.now()
        if last_ts.date() == now.date():
            update_ver_q = text("""
                UPDATE patient_info_versions
                SET final_diagnosis = :dx,
                    final_tests = :tests,
                    final_treatment_plan = :tplan,
                    case_summary = :csum
                WHERE id = :vid
            """)
            conn.execute(update_ver_q, {
                'dx': new_final_dx,
                'tests': new_tests,
                'tplan': new_treat,
                'csum': new_case_summary,
                'vid': last_ver["id"]
            })
        else:
            insert_patient_version(
                patient_id=patient_id,
                name=row["patient_name"],
                age=row["age"],
                gender=row["gender"],
                contact_number=row["contact_number"],
                department=row["department"],
                chief_complaint=row["chief_complaint"],
                history_presenting_illness=row["history_of_presenting_illness"],
                past_history=row["past_history"],
                personal_history=row["personal_history"],
                family_history=row["family_history"],
                obg_history=row["obg_history"],
                lab_report_url=row["lab_report_url"],
                medical_imaging_url=row["medical_imaging_url"],
                previous_prescription_url=row["previous_prescription_url"],
                cardiology_imaging_type=row.get("cardiology_imaging_type", ""),
                neurology_imaging_type=row.get("neurology_imaging_type", ""),
                medical_advice=row["medical_advice"],
                case_summary=new_case_summary,
                final_diagnosis=new_final_dx,
                final_tests=new_tests,
                final_treatment_plan=new_treat,
                blood_group=row.get("blood_group", ""),
                preferred_language=row.get("preferred_language", ""),
                email=row.get("email", ""),
                address=row.get("address", ""),
                city=row.get("city", ""),
                pin=row.get("pin", ""),
                referred_by=row.get("referred_by", ""),
                channel=row.get("channel", ""),
                bp=row.get("bp", ""),
                pulse=row.get("pulse", ""),
                height=row.get("height", ""),
                weight=row.get("weight", ""),
                head_round=row.get("head_round", ""),
                temperature=row.get("temperature", ""),
                bmi=row.get("bmi", ""),
                spo2=row.get("spo2", ""),
                lmp=row.get("lmp"),
                edd=row.get("edd"),
                allergies=row.get("allergies", ""),
                medication_history=row.get("medication_history", ""),
                surgical_history=row.get("surgical_history", "")
            )

def search_patients(
    patient_id=None,
    name=None,
    age=None,
    gender=None,
    contact=None
):
    query = "SELECT * FROM patient_info WHERE 1=1"
    params = {}

    if patient_id is not None:
        query += " AND id = :pid"
        params["pid"] = patient_id

    if name:
        query += " AND patient_name ILIKE :name"
        params["name"] = f"%{name}%"
    if age and age > 0:
        query += " AND age = :age"
        params["age"] = age

    if gender and gender not in [None, "Select Gender", ""]:
        query += " AND gender = :gender"
        params["gender"] = gender

    if contact:
        query += " AND contact_number ILIKE :contact"
        params["contact"] = f"%{contact}%"

    with engine.connect() as conn:
        result = conn.execute(text(query), params).mappings().all()
        return [dict(r) for r in result]

def get_patient_versions(patient_id: int):
    sel_query = text("""
        SELECT * FROM patient_info_versions
        WHERE patient_id = :pid
        ORDER BY version_timestamp DESC
    """)
    with engine.connect() as conn:
        result = conn.execute(sel_query, {'pid': patient_id}).mappings().all()
        return [dict(r) for r in result]

def get_version_by_id(version_id: int):
    sel_query = text("SELECT * FROM patient_info_versions WHERE id = :vid")
    with engine.connect() as conn:
        row = conn.execute(sel_query, {'vid': version_id}).mappings().first()
        return dict(row) if row else None

@app.post("/api/patient")
async def create_patient(
    request: Request,
    lab_report_file: Optional[UploadFile] = File(None),
    medical_imaging_file: Optional[UploadFile] = File(None),
    previous_prescription_file: Optional[UploadFile] = File(None),
):
    try:
        content_type = request.headers.get("content-type", "").lower()
        form_data = {}
        if "multipart/form-data" in content_type:
            form = await request.form()
            form_data = dict(form)
        else:
            form_data = await request.json() if request.body else {}

        required_fields = ["name", "age", "gender", "contact_number"]
        for field in required_fields:
            if field not in form_data or not form_data[field]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required field: {field}"
                )

        form_data["age"] = int(form_data["age"])
        uhid = form_data.get("uhid", "")
        guardian_name = form_data.get("guardian_name", "")
        consultant_doctor = form_data.get("consultant_doctor", "")

        cardiology_imaging_type = form_data.get("cardiology_imaging_type", "")
        neurology_imaging_type = form_data.get("neurology_imaging_type", "")

        allergies = form_data.get("allergies", "")
        medication_history = form_data.get("medication_history", "")
        surgical_history = form_data.get("surgical_history", "")

        extracted_text = None
        lab_report_url = None
        if lab_report_file:
            filename = lab_report_file.filename.lower()
            if not (filename.endswith(".pdf") or filename.endswith(".png") or filename.endswith(".jpg") or filename.endswith(".jpeg")):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="lab_report_file must be a PDF or image (png/jpg/jpeg)."
                )
            pdf_bytes = await lab_report_file.read()
            lab_report_url = upload_to_s3(pdf_bytes, lab_report_file.filename)
            if filename.endswith(".pdf"):
                extracted_text = extract_text_from_pdf_bytes(pdf_bytes)

        medical_imaging_url = None
        image_data_b64 = None
        if medical_imaging_file:
            file_bytes = await medical_imaging_file.read()
            medical_imaging_url = upload_to_s3(file_bytes, medical_imaging_file.filename)
            if medical_imaging_file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
                image_data_b64 = base64.b64encode(file_bytes).decode("utf-8")

        previous_prescription_url = None
        if previous_prescription_file:
            pres_bytes = await previous_prescription_file.read()
            if not (previous_prescription_file.filename.lower().endswith(".pdf") or
                    previous_prescription_file.filename.lower().endswith(".png") or
                    previous_prescription_file.filename.lower().endswith(".jpg") or
                    previous_prescription_file.filename.lower().endswith(".jpeg")):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="previous_prescription_file must be a PDF or image (png/jpg/jpeg)."
                )
            previous_prescription_url = upload_to_s3(pres_bytes, previous_prescription_file.filename)

        lmp = form_data.get("lmp", "")
        edd = form_data.get("edd", "")
        if not lmp:
            lmp = None
        if not edd:
            edd = None

        obg_val = ""
        if form_data.get("department") == "Gynecology":
            obg_val = form_data.get("obg_history", "")

        chief_complaint_details_str = form_data.get("chief_complaint_details", "[]")
        try:
            chief_complaint_list = json.loads(chief_complaint_details_str)
        except:
            chief_complaint_list = []

        insert_query = text("""
            INSERT INTO patient_info (
                patient_name,
                age,
                gender,
                contact_number,
                department,
                chief_complaint,
                history_presenting_illness,
                past_history,
                personal_history,
                family_history,
                obg_history,
                lab_report_url,
                medical_imaging_url,
                previous_prescription_url,
                blood_group,
                preferred_language,
                email,
                address,
                city,
                pin,
                referred_by,
                channel,
                cardiology_imaging_type,
                bp,
                pulse,
                height,
                weight,
                head_round,
                temperature,
                bmi,
                spo2,
                lmp,
                edd,
                allergies,
                medication_history,
                surgical_history,
                neurology_imaging_type,
                uhid,
                guardian_name,
                consultant_doctor
            ) VALUES (
                :name,
                :age,
                :gender,
                :contact_number,
                :department,
                :chief_complaint,
                :history_presenting_illness,
                :past_history,
                :personal_history,
                :family_history,
                :obg_history,
                :lab_report_url,
                :medical_imaging_url,
                :prev_presc_url,
                :blood_group,
                :preferred_language,
                :email,
                :address,
                :city,
                :pin,
                :referred_by,
                :channel,
                :cardio_img_type,
                :bp,
                :pulse,
                :height,
                :weight,
                :head_round,
                :temperature,
                :bmi,
                :spo2,
                :lmp,
                :edd,
                :allergies,
                :med_history,
                :surg_history,
                :neuro_img_type,
                :uhid,
                :guardian_name,
                :consultant_doctor
            ) RETURNING id
        """)

        with engine.begin() as conn:
            result = conn.execute(insert_query, {
                "name": form_data["name"],
                "age": form_data["age"],
                "gender": form_data["gender"],
                "contact_number": form_data["contact_number"],
                "department": form_data.get("department", ""),
                "chief_complaint": form_data.get("chief_complaint", ""),
                "history_presenting_illness": form_data.get("history_presenting_illness", ""),
                "past_history": form_data.get("past_history", ""),
                "personal_history": form_data.get("personal_history", ""),
                "family_history": form_data.get("family_history", ""),
                "obg_history": obg_val,
                "lab_report_url": lab_report_url,
                "medical_imaging_url": medical_imaging_url,
                "prev_presc_url": previous_prescription_url,
                "blood_group": form_data.get("blood_group", ""),
                "preferred_language": form_data.get("preferred_language", ""),
                "email": form_data.get("email", ""),
                "address": form_data.get("address", ""),
                "city": form_data.get("city", ""),
                "pin": form_data.get("pin", ""),
                "referred_by": form_data.get("referred_by", ""),
                "channel": form_data.get("channel", ""),
                "cardio_img_type": cardiology_imaging_type,
                "bp": form_data.get("bp", ""),
                "pulse": form_data.get("pulse", ""),
                "height": form_data.get("height", ""),
                "weight": form_data.get("weight", ""),
                "head_round": form_data.get("head_round", ""),
                "temperature": form_data.get("temperature", ""),
                "bmi": form_data.get("bmi", ""),
                "spo2": form_data.get("spo2", ""),
                "lmp": lmp,
                "edd": edd,
                "allergies": allergies,
                "med_history": medication_history,
                "surg_history": surgical_history,
                "neuro_img_type": neurology_imaging_type,
                "uhid": uhid,
                "guardian_name": guardian_name,
                "consultant_doctor": consultant_doctor
            })
            new_id = result.fetchone()[0]

        new_version_id = insert_patient_version(
            patient_id=new_id,
            name=form_data["name"],
            age=form_data["age"],
            gender=form_data["gender"],
            contact_number=form_data["contact_number"],
            department=form_data.get("department", ""),
            chief_complaint=form_data.get("chief_complaint", ""),
            history_presenting_illness=form_data.get("history_presenting_illness", ""),
            past_history=form_data.get("past_history", ""),
            personal_history=form_data.get("personal_history", ""),
            family_history=form_data.get("family_history", ""),
            obg_history=obg_val,
            lab_report_url=lab_report_url,
            medical_imaging_url=medical_imaging_url,
            previous_prescription_url=previous_prescription_url,
            cardiology_imaging_type=cardiology_imaging_type,
            neurology_imaging_type=neurology_imaging_type,
            blood_group=form_data.get("blood_group", ""),
            preferred_language=form_data.get("preferred_language", ""),
            email=form_data.get("email", ""),
            address=form_data.get("address", ""),
            city=form_data.get("city", ""),
            pin=form_data.get("pin", ""),
            referred_by=form_data.get("referred_by", ""),
            channel=form_data.get("channel", ""),
            bp=form_data.get("bp", ""),
            pulse=form_data.get("pulse", ""),
            height=form_data.get("height", ""),
            weight=form_data.get("weight", ""),
            head_round=form_data.get("head_round", ""),
            temperature=form_data.get("temperature", ""),
            bmi=form_data.get("bmi", ""),
            spo2=form_data.get("spo2", ""),
            lmp=lmp,
            edd=edd,
            allergies=allergies,
            medication_history=medication_history,
            surgical_history=surgical_history,
            uhid=uhid,
            guardian_name=guardian_name,
            consultant_doctor=consultant_doctor
        )

        insert_patient_complaints(new_id, new_version_id, chief_complaint_list)

        return {
            "message": "Patient info saved successfully",
            "patient_id": new_id,
            "extracted_lab_text": extracted_text or "",
            "image_data_b64": image_data_b64 or ""
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Error creating patient info")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.put("/api/patient/{patient_id}")
async def api_update_patient(patient_id: int, payload: dict):
    try:
        allergies = payload.get("allergies", "")
        medication_history = payload.get("medication_history", "")
        surgical_history = payload.get("surgical_history", "")
        neurology_imaging_type = payload.get("neurology_imaging_type", "")

        new_version_id = update_patient_info(
            patient_id=patient_id,
            name=payload["name"],
            age=payload["age"],
            gender=payload["gender"],
            contact_number=payload["contact_number"],
            department=payload["department"],
            chief_complaint=payload["chief_complaint"],
            history_presenting_illness=payload["history_presenting_illness"],
            past_history=payload["past_history"],
            personal_history=payload["personal_history"],
            family_history=payload["family_history"],
            obg_history=payload.get("obg_history", ""),
            lab_report_url=payload.get("lab_report_url"),
            medical_imaging_url=payload.get("medical_imaging_url"),
            previous_prescription_url=payload.get("previous_prescription_url"),
            cardiology_imaging_type=payload.get("cardiology_imaging_type", ""),
            neurology_imaging_type=neurology_imaging_type,
            allergies=allergies,
            medication_history=medication_history,
            surgical_history=surgical_history
        )

        chief_str = payload.get("chief_complaint_details","[]")
        try:
            complaint_list = json.loads(chief_str)
        except:
            complaint_list = []
        insert_patient_complaints(patient_id, new_version_id, complaint_list)

        return {"message": "Patient updated successfully."}
    except KeyError as ke:
        raise HTTPException(status_code=400, detail=f"Missing field: {ke}")
    except Exception as e:
        logger.exception("Error updating patient")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/api/search")
async def api_search(
    patient_id: Optional[int] = Query(None),
    name: Optional[str] = Query(None),
    age: Optional[int] = Query(None),
    gender: Optional[str] = Query(None),
    contact: Optional[str] = Query(None)
):
    try:
        records = search_patients(
            patient_id=patient_id,
            name=name,
            age=age,
            gender=gender,
            contact=contact
        )
        return {"count": len(records), "records": records}
    except Exception as e:
        logger.exception("Error searching patients")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/api/patient/{patient_id}/versions")
async def api_get_versions(patient_id: int):
    try:
        versions = get_patient_versions(patient_id)
        return {"versions": versions}
    except Exception as e:
        logger.exception("Error fetching versions")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/api/version/{version_id}")
async def api_get_version(version_id: int):
    try:
        version = get_version_by_id(version_id)
        if not version:
            raise HTTPException(status_code=404, detail="Version not found.")
        return {"version": version}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Error fetching version")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/api/patient/{patient_id}/detailed")
def get_patient_detailed(patient_id: int):
    query = text("SELECT * FROM patient_info WHERE id = :pid")
    with engine.connect() as conn:
        row = conn.execute(query, {"pid": patient_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    return dict(row)

@app.post("/api/patient/{patient_id}/update")
async def update_patient_with_files(
    patient_id: int,
    request: Request,
    lab_report_file: Optional[UploadFile] = File(None),
    medical_imaging_file: Optional[UploadFile] = File(None),
    previous_prescription_file: Optional[UploadFile] = File(None),
):
    try:
        form = await request.form()
        form_data = dict(form)
        if "age" in form_data:
            form_data["age"] = int(form_data["age"])
        sel_query = text("SELECT * FROM patient_info WHERE id = :pid")
        with engine.connect() as conn:
            existing = conn.execute(sel_query, {"pid": patient_id}).mappings().first()
        if not existing:
            raise HTTPException(status_code=404, detail="No patient found with that ID")

        allergies = form_data.get("allergies", "")
        medication_history = form_data.get("medication_history", "")
        surgical_history = form_data.get("surgical_history", "")
        neurology_imaging_type = form_data.get("neurology_imaging_type", "")

        lab_report_url = existing["lab_report_url"]
        if lab_report_file:
            filename = lab_report_file.filename.lower()
            if not (filename.endswith(".pdf") or filename.endswith(".png") or filename.endswith(".jpg") or filename.endswith(".jpeg")):
                raise HTTPException(status_code=400, detail="lab_report_file must be PDF/PNG/JPG/JPEG")
            pdf_bytes = await lab_report_file.read()
            lab_report_url = upload_to_s3(pdf_bytes, lab_report_file.filename)

        medical_imaging_url = existing["medical_imaging_url"]
        if medical_imaging_file:
            img_bytes = await medical_imaging_file.read()
            if not (medical_imaging_file.filename.lower().endswith(".pdf") or
                    medical_imaging_file.filename.lower().endswith(".png") or
                    medical_imaging_file.filename.lower().endswith(".jpg") or
                    medical_imaging_file.filename.lower().endswith(".jpeg")):
                raise HTTPException(status_code=400, detail="medical_imaging_file must be PDF/PNG/JPG/JPEG")
            medical_imaging_url = upload_to_s3(img_bytes, medical_imaging_file.filename)

        previous_prescription_url = existing["previous_prescription_url"]
        if previous_prescription_file:
            pres_bytes = await previous_prescription_file.read()
            if not (previous_prescription_file.filename.lower().endswith(".pdf") or
                    previous_prescription_file.filename.lower().endswith(".png") or
                    previous_prescription_file.filename.lower().endswith(".jpg") or
                    previous_prescription_file.filename.lower().endswith(".jpeg")):
                raise HTTPException(status_code=400, detail="previous_prescription_file must be PDF/PNG/JPG/JPEG")
            previous_prescription_url = upload_to_s3(pres_bytes, previous_prescription_file.filename)

        new_version_id = update_patient_info(
            patient_id=patient_id,
            name=form_data.get("name", existing["patient_name"]),
            age=form_data.get("age", existing["age"]),
            gender=form_data.get("gender", existing["gender"]),
            contact_number=form_data.get("contact_number", existing["contact_number"]),
            department=form_data.get("department", existing["department"]),
            chief_complaint=form_data.get("chief_complaint", existing.get("chief_complaint", "")),
            history_presenting_illness=form_data.get("history_presenting_illness", existing.get("history_of_presenting_illness", "")),
            past_history=form_data.get("past_history", existing.get("past_history", "")),
            personal_history=form_data.get("personal_history", existing.get("personal_history", "")),
            family_history=form_data.get("family_history", existing.get("family_history", "")),
            obg_history=form_data.get("obg_history", existing.get("obg_history", "")),
            lab_report_url=lab_report_url,
            medical_imaging_url=medical_imaging_url,
            previous_prescription_url=previous_prescription_url,
            cardiology_imaging_type=form_data.get("cardiology_imaging_type", existing.get("cardiology_imaging_type", "")),
            neurology_imaging_type=neurology_imaging_type,
            allergies=allergies,
            medication_history=medication_history,
            surgical_history=surgical_history
        )

        chief_str = form_data.get("chief_complaint_details","[]")
        try:
            complaint_list = json.loads(chief_str)
        except:
            complaint_list = []
        insert_patient_complaints(patient_id, new_version_id, complaint_list)

        return {"message": "Patient updated successfully (new version created)."}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Error updating patient with files")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/final-choices")
async def api_final_choices(data: dict):
    try:
        pid = data.get("patient_id")
        if not pid:
            raise HTTPException(status_code=400, detail="Missing patient_id")
        final_diagnosis = data.get("final_diagnosis", "")
        final_tests = data.get("final_tests", "")
        final_treatment_plan = data.get("final_treatment_plan", "")
        case_summary = data.get("case_summary", "")
        update_patient_final_choices(
            patient_id=pid,
            final_diagnosis=final_diagnosis,
            final_tests=final_tests,
            final_treatment_plan=final_treatment_plan,
            case_summary=case_summary
        )
        return {"message": "Final choices saved successfully!"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Error updating final choices")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

def parse_final_choices(row):
    """
    Given a row from patient_info, parse out final_diagnosis, final_tests, final_treatment_plan.
    Remove any colon-based explanations (e.g. 'X-ray chest: to detect infiltration' -> 'X-ray chest').
    Return them as arrays or string depending on the context.
    """

    def strip_colon(str_val):
        return str_val.split(":")[0].strip()

    final_diagnosis_raw = row.get("final_diagnosis") or ""
    final_diagnosis_list = [strip_colon(x).strip()
                            for x in final_diagnosis_raw.split(",")
                            if x.strip()]

    final_tests_raw = row.get("final_tests") or ""
    final_tests_list = [strip_colon(x).strip()
                        for x in final_tests_raw.split(",")
                        if x.strip()]

    final_treatment_raw = row.get("final_treatment_plan") or ""
    final_treatment_list = []
    for line in final_treatment_raw.split("\n"):
        line = strip_colon(line).strip()
        if line:
            final_treatment_list.append(line)

    return final_diagnosis_list, final_tests_list, final_treatment_list

@app.post("/api/prescription/generate")
async def api_generate_prescription(data: dict):
    """
    Creates a prescription by calling generate_prescription with either final choices
    (if they exist) or fallback to whatever is stored from SavePatientInfo.
    If no final choices exist, also uses all possible fields from the DB row
    (department, vitals, etc.) to build GPT context.
    """
    try:
        input_diagnosis = data.get("diagnosis", "")
        input_tests = data.get("tests", [])
        input_treatments = data.get("treatments", [])
        input_patient_info = data.get("patient_info", {})
        
        pid = None
        if "patient_id" in data:
            pid = data["patient_id"]
        elif input_patient_info and "patient_id" in input_patient_info:
            pid = input_patient_info["patient_id"]
        
        row = None
        if pid:
            query = text("SELECT * FROM patient_info WHERE id = :pid")
            with engine.connect() as conn:
                row = conn.execute(query, {"pid": pid}).mappings().first()
        
        final_dx_list = []
        final_tests_list = []
        final_treatment_list = []
        
        if row:
            dx_list, tests_list, treat_list = parse_final_choices(row)
            final_dx_list = dx_list
            final_tests_list = tests_list
            final_treatment_list = treat_list
        
        has_final_choices = (len(final_dx_list) > 0 or len(final_tests_list) > 0 or len(final_treatment_list) > 0)
        
        full_patient_info = {}
        
        if row:
            full_patient_info = {
                "name": row.get("patient_name", ""),
                "age": row.get("age", ""),
                "gender": row.get("gender", ""),
                "department": row.get("department", ""),
                "chief_complaint": row.get("chief_complaint", ""),
                "history_presenting_illness": row.get("history_of_presenting_illness", ""),
                "past_history": row.get("past_history", ""),
                "personal_history": row.get("personal_history", ""),
                "family_history": row.get("family_history", ""),
                "obg_history": row.get("obg_history", ""),
                "allergies": row.get("allergies", ""),
                "medication_history": row.get("medication_history", ""),
                "surgical_history": row.get("surgical_history", ""),
                "bp": row.get("bp", ""),
                "pulse": row.get("pulse", ""),
                "temperature": row.get("temperature", ""),
                "bmi": row.get("bmi", ""),
                "spo2": row.get("spo2", ""),
                "image_analysis_text": "",
                "lab_analysis_text": "",
                "prescription_analysis_text": "",
            }
        else:
            full_patient_info = {
                "name": input_patient_info.get("name", ""),
                "age": input_patient_info.get("age", ""),
                "gender": input_patient_info.get("gender", ""),
                "department": input_patient_info.get("department", ""),
                "chief_complaint": input_patient_info.get("chief_complaint", ""),
                "history_presenting_illness": input_patient_info.get("history_presenting_illness", ""),
                "past_history": input_patient_info.get("past_history", ""),
                "personal_history": input_patient_info.get("personal_history", ""),
                "family_history": input_patient_info.get("family_history", ""),
                "obg_history": input_patient_info.get("obg_history", ""),
                "allergies": input_patient_info.get("allergies", ""),
                "medication_history": input_patient_info.get("medication_history", ""),
                "surgical_history": input_patient_info.get("surgical_history", ""),
                "bp": input_patient_info.get("bp", ""),
                "pulse": input_patient_info.get("pulse", ""),
                "temperature": input_patient_info.get("temperature", ""),
                "bmi": input_patient_info.get("bmi", ""),
                "spo2": input_patient_info.get("spo2", ""),
                "image_analysis_text": input_patient_info.get("image_analysis_text", ""),
                "lab_analysis_text": input_patient_info.get("lab_analysis_text", ""),
                "prescription_analysis_text": input_patient_info.get("prescription_analysis_text", ""),
            }
        
        final_diagnosis_str = ", ".join(final_dx_list) if has_final_choices else input_diagnosis
        final_tests_arr = final_tests_list if has_final_choices else input_tests
        final_treatments_arr = final_treatment_list if has_final_choices else input_treatments
        
        prescription = generate_prescription(
            diagnosis=final_diagnosis_str,
            tests=final_tests_arr,
            treatments=final_treatments_arr,
            patient_info=full_patient_info
        )
        
        return {"prescription": prescription}
    
    except Exception as e:
        logger.exception("Error generating prescription")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/api/prescription/save")
async def api_save_prescription(data: dict):
    """
    Updated to allow a blank or missing patient_id in manual mode.
    In that case, we skip DB updates but still generate and return a PDF.
    """
    import uuid  # Already imported at the top, but ensuring reference here.
    try:
        pid = data.get("patient_id")  # May be None or ""
        patient_name = data.get("patient_name", f"Patient {pid or 'Manual'}")
        diagnosis = data.get("diagnosis", "")
        drugs = data.get("drugs", [])
        tests = data.get("tests", [])
        follow_up = data.get("follow_up", "")
        complaints = data.get("complaints", "")
        temperature = data.get("temperature", "")
        bp = data.get("bp", "")
        pulse = data.get("pulse", "")
        bmi = data.get("bmi", "")
        medicine_table = data.get("medicineTable", [])
        patient_age = data.get("patient_age", "")
        patient_gender = data.get("patient_gender", "")
        patient_contact = data.get("patient_contact", "")
        medical_imaging_analysis = data.get("medical_imaging_analysis", "")
        lab_report_analysis = data.get("lab_report_analysis", "")
        prescription_analysis = data.get("prescription_analysis", "")
        include_analysis = data.get("include_analysis", True)

        pdf_bytes = create_prescription_pdf({
            "diagnosis": diagnosis,
            "drugs": drugs,
            "tests": tests,
            "follow_up": follow_up,
            "complaints": complaints,
            "temperature": temperature,
            "bp": bp,
            "pulse": pulse,
            "bmi": bmi,
            "medicineTable": medicine_table,
            "age": patient_age,
            "gender": patient_gender,
            "contact": patient_contact,
            "medical_imaging_analysis": medical_imaging_analysis,
            "lab_report_analysis": lab_report_analysis,
            "prescription_analysis": prescription_analysis,
            "include_analysis": include_analysis,
        }, patient_name=patient_name)

        # Create a filename, either patient-based or random for manual-only
        if pid:
            filename = f"Prescription_{pid}.pdf"
        else:
            # No patient_id => manual mode => random filename
            filename = f"Prescription_{uuid.uuid4()}.pdf"

        s3_url = upload_to_s3(pdf_bytes, filename)
        presigned_url = generate_presigned_url(s3_url, expiration=3600)
        if not presigned_url:
            raise HTTPException(status_code=500, detail="Failed to generate presigned URL.")

        # If NO patient_id => skip DB updates, just return the PDF link
        if not pid:
            return {
                "message": "Prescription generated (no patient_id) and presigned for download",
                "pdf_url": presigned_url
            }

        # Otherwise, update patient_info with the newly generated S3 path
        update_query = text("""
            UPDATE patient_info
            SET generated_prescription_url = :s3path
            WHERE id = :pid
        """)

        with engine.begin() as conn:
            # Attempt to insert each medicine record if you are storing them:
            ver_query = text("""
                SELECT id FROM patient_info_versions
                WHERE patient_id = :pid
                ORDER BY version_timestamp DESC
                LIMIT 1
            """)
            ver_row = conn.execute(ver_query, {"pid": pid}).mappings().first()
            version_id = ver_row["id"] if ver_row else None

            insert_meds_sql = text("""
                INSERT INTO prescription_medicines
                (patient_id, version_id, medicine, dosage, unit, timing, duration, notes)
                VALUES (:pid, :vid, :med, :dos, :unt, :tim, :dur, :nts)
            """)

            for item in medicine_table:
                conn.execute(insert_meds_sql, {
                    "pid": pid,
                    "vid": version_id,
                    "med": item.get("medicine",""),
                    "dos": item.get("dosage",""),
                    "unt": item.get("unit",""),
                    "tim": item.get("when",""),
                    "dur": item.get("duration",""),
                    "nts": item.get("notes","")
                })

            conn.execute(update_query, {"s3path": s3_url, "pid": pid})

        return {
            "message": "Prescription saved (private) and presigned for download",
            "pdf_url": presigned_url
        }

    except Exception as e:
        logger.exception("Error saving prescription")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/prescription-template")
async def create_prescription_template(data: dict):
    """
    Expects:
    {
      "name": "Template Name",
      "template_data": { ... }
    }
    """
    try:
        template_name = data.get("name")
        template_data = data.get("template_data", {})

        if not template_name or not template_data:
            raise HTTPException(status_code=400, detail="Missing template name or data")

        # Remove patient name/age/gender/contact if present
        template_data.pop("patientName", None)
        template_data.pop("patientAge", None)
        template_data.pop("patientGender", None)
        template_data.pop("patientContact", None)

        insert_query = text("""
            INSERT INTO prescription_templates (template_name, template_data)
            VALUES (:tname, CAST(:tdata AS JSONB))
            RETURNING id
        """)

        with engine.begin() as conn:
            result = conn.execute(insert_query, {
                "tname": template_name,
                "tdata": json.dumps(template_data)
            })
            new_id = result.fetchone()[0]

        return {"id": new_id, "message": "Template saved successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.exception("Error saving prescription template")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/prescription-templates")
async def list_prescription_templates():
    """
    Returns an object:
    {
      "templates": [
        {
          "id": <int>,
          "name": <str>,
          "template_data": <dict>,
          "created_at": <str datetime or None>
        },
        ...
      ]
    }
    """
    try:
        query = text("SELECT * FROM prescription_templates ORDER BY created_at DESC")
        with engine.connect() as conn:
            rows = conn.execute(query).mappings().all()

        templates = []
        for row in rows:
            tdata = row["template_data"]
            tdata.pop("patientName", None)
            tdata.pop("patientAge", None)
            tdata.pop("patientGender", None)
            tdata.pop("patientContact", None)

            templates.append({
                "id": row["id"],
                "name": row["template_name"],
                "template_data": tdata,
                "created_at": row["created_at"].isoformat() if row["created_at"] else None
            })

        return {"templates": templates}
    except Exception as e:
        logger.exception("Error listing prescription templates")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/advice")
async def generate_advice(data: dict):
    patient_id = data.get("patient_id")
    if not patient_id:
        raise HTTPException(status_code=400, detail="Missing patient_id")

    sel_query = text("SELECT * FROM patient_info WHERE id = :pid")
    with engine.connect() as conn:
        row = conn.execute(sel_query, {"pid": patient_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="No patient found with that ID")

    department = row.get("department", "")
    chief_complaint_single = row.get("chief_complaint", "")

    include_lab_report = data.get("include_lab_report", True)
    include_medical_imaging = data.get("include_medical_imaging", True)
    include_prescription = data.get("include_prescription", True)

    history_presenting_illness = row.get("history_presenting_illness", "")
    past_history = row.get("past_history", "")
    personal_history = row.get("personal_history", "")
    family_history = row.get("family_history", "")
    obg_history = row.get("obg_history", "")
    age = row.get("age", 0)
    gender = row.get("gender", "")

    allergies = row.get("allergies", "")
    medication_history = row.get("medication_history", "")
    surgical_history = row.get("surgical_history", "")
    bp = row.get("bp", "")
    pulse = row.get("pulse", "")
    temperature = row.get("temperature", "")

    lab_analysis_text = ""
    if row["lab_report_url"] and include_lab_report:
        lab_bytes = download_from_s3(row["lab_report_url"])
        if lab_bytes:
            if is_pdf_file(row["lab_report_url"]):
                lab_text = extract_text_from_pdf_bytes(lab_bytes)
                lab_analysis_text = analyze_lab_report_text(lab_text)
            elif is_image_file(row["lab_report_url"]):
                b64 = base64.b64encode(lab_bytes).decode("utf-8")
                lab_analysis_text = analyze_lab_report_image(b64)

    image_analysis_text = ""
    if row["medical_imaging_url"] and include_medical_imaging:
        img_bytes = download_from_s3(row["medical_imaging_url"])
        if img_bytes:
            if is_pdf_file(row["medical_imaging_url"]):
                pdf_text = extract_text_from_pdf_bytes(img_bytes)
                image_analysis_text = analyze_medical_imaging_pdf(pdf_text)
            else:
                img_b64 = base64.b64encode(img_bytes).decode("utf-8")
                cimg_type = row.get("cardiology_imaging_type", "")
                nimg_type = row.get("neurology_imaging_type", "")
                custom_prompt = None
                if department == "Cardiology" and cimg_type:
                    if cimg_type == "ECG/EKG":
                        custom_prompt = PROMPT_ECG
                    elif cimg_type == "Echocardiography (ECHO)":
                        custom_prompt = PROMPT_ECHOCARDIOGRAPHY
                    elif cimg_type == "Cardiac MRI":
                        custom_prompt = PROMPT_CARDIAC_MRI
                    elif cimg_type == "CT Coronary Angiography":
                        custom_prompt = PROMPT_CT_CORONARY_ANGIO
                    else:
                        custom_prompt = FIXED_PROMPT_IMAGE
                elif department == "Neurology" and nimg_type:
                    if nimg_type == "MRI_SPINE":
                        custom_prompt = PROMPT_MRI_SPINE
                    elif nimg_type == "MRI_HEAD":
                        custom_prompt = PROMPT_MRI_HEAD
                    elif nimg_type == "CT_HEAD":
                        custom_prompt = PROMPT_CT_HEAD
                    elif nimg_type == "PET_BRAIN":
                        custom_prompt = PROMPT_PET_BRAIN
                    elif nimg_type == "SPECT_BRAIN":
                        custom_prompt = PROMPT_SPECT_BRAIN
                    elif nimg_type == "DSA_BRAIN":
                        custom_prompt = PROMPT_DSA_BRAIN
                    elif nimg_type == "Carotid_Doppler":
                        custom_prompt = PROMPT_CAROTID_DOPPLER
                    elif nimg_type == "TRANSCRANIAL_DOPPLER":
                        custom_prompt = PROMPT_TRANSCRANIAL_DOPPLER
                    elif nimg_type == "MYELOGRAPHY":
                        custom_prompt = PROMPT_MYELOGRAPHY
                    else:
                        custom_prompt = FIXED_PROMPT_IMAGE
                else:
                    custom_prompt = FIXED_PROMPT_IMAGE

                image_analysis_text = analyze_medical_image(img_b64, custom_prompt=custom_prompt)

    prescription_analysis_text = ""
    if row["previous_prescription_url"] and include_prescription:
        presc_url = row["previous_prescription_url"].lower()
        presc_bytes = download_from_s3(row["previous_prescription_url"])
        if presc_bytes:
            if presc_url.endswith(".pdf"):
                pdf_text = extract_text_from_pdf_bytes(presc_bytes)
                prescription_analysis_text = analyze_prescription_text_or_image(pdf_text, is_pdf=True)
            else:
                b64img = base64.b64encode(presc_bytes).decode("utf-8")
                prescription_analysis_text = analyze_prescription_text_or_image(b64img, is_pdf=False)

    with engine.connect() as conn:
        ver_query = text("""
            SELECT id FROM patient_info_versions
            WHERE patient_id = :pid
            ORDER BY version_timestamp DESC
            LIMIT 1
        """)
        ver_row = conn.execute(ver_query, {"pid": patient_id}).mappings().first()
        complaint_rows = []
        if ver_row:
            comp_query = text("""
                SELECT complaint, frequency, severity, duration
                FROM patient_chief_complaints
                WHERE version_id = :vid
            """)
            complaint_rows = conn.execute(comp_query, {"vid": ver_row["id"]}).mappings().all()

    full_complaint_text = chief_complaint_single.strip()
    if complaint_rows:
        lines = []
        for cr in complaint_rows:
            line = (f"Complaint: {cr['complaint']}, "
                    f"Frequency: {cr['frequency']}, "
                    f"Severity: {cr['severity']}, "
                    f"Duration: {cr['duration']}")
            lines.append(line)
        full_complaint_text += "\n\nDetailed Complaints:\n" + "\n".join(lines)

    advice = get_medical_advice(
        department=department,
        chief_complaint=full_complaint_text,
        history_presenting_illness=history_presenting_illness,
        past_history=past_history,
        personal_history=personal_history,
        family_history=family_history,
        age=age,
        gender=gender,
        obg_history=obg_history,
        allergies=allergies,
        medication_history=medication_history,
        surgical_history=surgical_history,
        bp=bp,
        pulse=pulse,
        temperature=temperature,
        image_analysis_text=image_analysis_text,
        lab_analysis_text=lab_analysis_text,
        prescription_analysis_text=prescription_analysis_text,
    )

    new_version_id = update_patient_info(
        patient_id=patient_id,
        name=row["patient_name"],
        age=row["age"],
        gender=row["gender"],
        contact_number=row["contact_number"],
        department=row["department"] or "",
        chief_complaint=row["chief_complaint"] or "",
        history_presenting_illness=row["history_presenting_illness"] or "",
        past_history=row["past_history"] or "",
        personal_history=row["personal_history"] or "",
        family_history=row["family_history"] or "",
        obg_history=row["obg_history"] or "",
        lab_report_url=row["lab_report_url"],
        medical_imaging_url=row["medical_imaging_url"],
        previous_prescription_url=row["previous_prescription_url"],
        cardiology_imaging_type=row.get("cardiology_imaging_type", ""),
        neurology_imaging_type=row.get("neurology_imaging_type", ""),
        blood_group=row.get("blood_group", ""),
        preferred_language=row.get("preferred_language", ""),
        email=row.get("email", ""),
        address=row.get("address", ""),
        city=row.get("city", ""),
        pin=row.get("pin", ""),
        referred_by=row.get("referred_by", ""),
        channel=row.get("channel", ""),
        bp=row.get("bp", ""),
        pulse=row.get("pulse", ""),
        height=row.get("height", ""),
        weight=row.get("weight", ""),
        head_round=row.get("head_round", ""),
        temperature=row.get("temperature", ""),
        bmi=row.get("bmi", ""),
        spo2=row.get("spo2", ""),
        lmp=row.get("lmp"),
        edd=row.get("edd"),
        allergies=row.get("allergies", ""),
        medication_history=row.get("medication_history", ""),
        surgical_history=row.get("surgical_history", ""),
        medical_advice=advice
    )

    insert_patient_complaints(patient_id, new_version_id, list(complaint_rows))

    return {"advice": advice}

@app.get("/api/file-preview")
async def file_preview(file_url: str = Query(...)):
    presigned_url = generate_presigned_url(file_url, expiration=3600)
    if not presigned_url:
        raise HTTPException(status_code=500, detail="Failed to generate presigned URL")
    return {"presigned_url": presigned_url}

@app.get("/api/version/{version_id}/complaints")
def get_version_complaints(version_id: int):
    q = text("""
        SELECT complaint, frequency, severity, duration
        FROM patient_chief_complaints
        WHERE version_id = :vid
    """)
    with engine.connect() as conn:
        rows = conn.execute(q, {"vid": version_id}).mappings().all()
    return {"complaints": [dict(r) for r in rows]}

@app.post("/api/complaint-template")
async def save_complaint_template(data: dict):
    try:
        template_name = data.get("name")
        department = data.get("department", "General Medicine")
        template_data = data.get("data")
        if not template_name or template_data is None:
            raise HTTPException(status_code=400, detail="Missing required fields")
        insert_query = text("""
            INSERT INTO complaint_templates (template_name, department, template_data)
            VALUES (:name, :department, :template_data)
            RETURNING id
        """)
        with engine.begin() as conn:
            result = conn.execute(insert_query, {
                "name": template_name,
                "department": department,
                "template_data": json.dumps(template_data)
            })
            new_id = result.fetchone()[0]
        return {"id": new_id, "message": "Template saved successfully"}
    except Exception as e:
        logger.exception("Error saving complaint template")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/complaint-templates")
async def get_complaint_templates(department: str = None):
    try:
        query = "SELECT * FROM complaint_templates"
        params = {}
        if department:
            query += " WHERE department = :department"
            params["department"] = department
        query += " ORDER BY created_at DESC"
        with engine.connect() as conn:
            result = conn.execute(text(query), params).mappings().all()
            templates = []
            for row in result:
                templates.append({
                    "id": row["id"],
                    "name": row["template_name"],
                    "department": row["department"],
                    "data": row["template_data"] if row["template_data"] is not None else [],
                    "created_at": row["created_at"].isoformat() if row["created_at"] else None
                })
        return {"templates": templates}
    except Exception as e:
        logger.exception("Error fetching complaint templates")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/medicines")
def search_medicines(query: str = ""):
    sql = text("SELECT name FROM medicines WHERE name ILIKE :prefix LIMIT 10")
    with engine.connect() as conn:
        res = conn.execute(sql, {"prefix": f"{query}%"})
        rows = [row[0] for row in res]
    return rows

@app.get("/api/patient/{patient_id}")
async def get_patient_by_id(patient_id: int):
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT * FROM patient_info WHERE id = :pid"),
            {"pid": patient_id}
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="No patient found with that ID")
    patient_dict = dict(row)
    return {
        "patient_id": patient_dict["id"],
        "patient_name": patient_dict["patient_name"],
        "age": patient_dict["age"],
        "gender": patient_dict["gender"],
        "contact_number": patient_dict["contact_number"],
        "department": patient_dict["department"],
        "final_diagnosis": patient_dict.get("final_diagnosis", ""),
        "final_tests": patient_dict.get("final_tests", ""),
        "final_treatment_plan": patient_dict.get("final_treatment_plan", ""),
        "case_summary": patient_dict.get("case_summary", ""),
        "generated_prescription_url": patient_dict.get("generated_prescription_url", None)
    }


# Pydantic model for validation
class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    default_price: float = Field(..., gt=0, description="Price must be greater than zero")
    requires_time: bool = Field(False, description="Whether the service requires appointment fields")

class ServiceResponse(ServiceCreate):
    id: int

@app.post("/api/services", response_model=ServiceResponse, status_code=status.HTTP_201_CREATED)
def create_service(service: ServiceCreate):
    """Create a new service"""
    try:
        insert_query = text("""
            INSERT INTO services (name, default_price, requires_time) VALUES (:name, :default_price, :requires_time) RETURNING id
        """)
        
        with engine.begin() as conn:
            result = conn.execute(insert_query, {"name": service.name, "default_price": service.default_price, "requires_time": service.requires_time,})
            service_id = result.fetchone()[0]
        
        return {"id": service_id, "name": service.name, "default_price": service.default_price, "requires_time": service.requires_time,}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/services", response_model=List[ServiceResponse])
def get_all_services():
    """Retrieve all services"""
    try:
        query = text("SELECT id, name, default_price, requires_time FROM services ORDER BY id ASC")
        with engine.begin() as conn:
            result = conn.execute(query)
            services = []
            for row in result.mappings():
                services.append({
                    "id": row["id"],
                    "name": row["name"],
                    "default_price": row["default_price"],
                    "requires_time": row["requires_time"],
                })
        return services
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int):
    """Retrieve a service by ID"""
    try:
        query = text("SELECT id, name, default_price, requires_time FROM services WHERE id = :service_id")
        with engine.begin() as conn:
            result = conn.execute(query, {"service_id": service_id})
            service = result.fetchone()
            if not service:
                raise HTTPException(status_code=404, detail="Service not found")
        return {
            "id": service["id"],
            "name": service["name"],
            "default_price": service["default_price"],
            "requires_time": service["requires_time"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/services/{service_id}", response_model=ServiceResponse)
def update_service(service_id: int, service: ServiceCreate):
    """Update an existing service"""
    try:
        update_query = text("""
            UPDATE services
            SET name = :name, 
                default_price = :default_price, 
                requires_time = :requires_time
            WHERE id = :service_id
            RETURNING id
        """)
        
        with engine.begin() as conn:
            result = conn.execute(update_query, {
                "name": service.name,
                "default_price": service.default_price,
                "requires_time": service.requires_time,
                "service_id": service_id
            })
            updated_id = result.fetchone()
            if not updated_id:
                raise HTTPException(status_code=404, detail="Service not found")
        
        return {
            "id": service_id,
            "name": service.name,
            "default_price": service.default_price,
            "requires_time": service.requires_time,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(service_id: int):
    """Delete a service by ID"""
    try:
        delete_query = text("DELETE FROM services WHERE id = :service_id RETURNING id")
        with engine.begin() as conn:
            result = conn.execute(delete_query, {"service_id": service_id})
            deleted_id = result.fetchone()
            if not deleted_id:
                raise HTTPException(status_code=404, detail="Service not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DoctorBase(BaseModel):
    name: str
    speciality: str
    contact_number: Optional[str] = None

class DoctorCreate(DoctorBase):
    pass

class DoctorResponse(DoctorBase):
    id: int

# Doctor endpoints
@app.post("/api/doctors", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
def create_doctor(doctor: DoctorCreate):
    """Create a new doctor"""
    try:
        insert_query = text("""
            INSERT INTO doctors (name, speciality, contact_number) 
            VALUES (:name, :speciality, :contact_number) 
            RETURNING id
        """)
        
        with engine.begin() as conn:
            result = conn.execute(insert_query, {
                "name": doctor.name, 
                "speciality": doctor.speciality, 
                "contact_number": doctor.contact_number
            })
            doctor_id = result.fetchone()[0]
        
        return {
            "id": doctor_id, 
            "name": doctor.name, 
            "speciality": doctor.speciality, 
            "contact_number": doctor.contact_number
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/doctors", response_model=List[DoctorResponse])
def get_all_doctors():
    """Retrieve all doctors"""
    try:
        query = text("SELECT id, name, speciality, contact_number FROM doctors ORDER BY name ASC")
        with engine.begin() as conn:
            result = conn.execute(query)
            doctors = [dict(row) for row in result.mappings()]
        return doctors
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/doctors/{doctor_id}", response_model=DoctorResponse)
def get_doctor(doctor_id: int):
    """Retrieve a doctor by ID"""
    try:
        query = text("SELECT id, name, speciality, contact_number FROM doctors WHERE id = :doctor_id")
        with engine.begin() as conn:
            result = conn.execute(query, {"doctor_id": doctor_id})
            doctor = result.fetchone()
            if not doctor:
                raise HTTPException(status_code=404, detail="Doctor not found")
        return dict(doctor._mapping)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/doctors/{doctor_id}", response_model=DoctorResponse)
def update_doctor(doctor_id: int, doctor: DoctorCreate):
    """Update an existing doctor"""
    try:
        update_query = text("""
            UPDATE doctors 
            SET name = :name, speciality = :speciality, contact_number = :contact_number 
            WHERE id = :doctor_id 
            RETURNING id
        """)
        
        with engine.begin() as conn:
            result = conn.execute(update_query, {
                "name": doctor.name, 
                "speciality": doctor.speciality, 
                "contact_number": doctor.contact_number, 
                "doctor_id": doctor_id
            })
            updated_id = result.fetchone()
            if not updated_id:
                raise HTTPException(status_code=404, detail="Doctor not found")
        
        return {
            "id": doctor_id, 
            "name": doctor.name, 
            "speciality": doctor.speciality, 
            "contact_number": doctor.contact_number
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/doctors/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_doctor(doctor_id: int):
    """Delete a doctor by ID"""
    try:
        delete_query = text("DELETE FROM doctors WHERE id = :doctor_id RETURNING id")
        with engine.begin() as conn:
            result = conn.execute(delete_query, {"doctor_id": doctor_id})
            deleted_id = result.fetchone()
            if not deleted_id:
                raise HTTPException(status_code=404, detail="Doctor not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Pydantic models for bill item
class BillItemCreate(BaseModel):
    service: str
    doctor: str
    appointmentDate: date
    appointmentTime: str
    duration: int = 30
    price: float
    discount: float = 0

class BillItemResponse(BaseModel):
    id: int
    service_id: int
    doctor_id: int
    appointment_date: date
    appointment_time: time
    duration: int
    price: float
    discount: float
    net_amount: float

# Pydantic models for bill
class BillCreate(BaseModel):
    patient_id: int
    rows: List[BillItemCreate]
    paymentDetails: dict

class BillResponse(BaseModel):
    id: int
    patient_id: int
    bill_date: date
    payment_mode: str
    payment_status: str
    total_amount: float
    items: List[BillItemResponse]
    pdf_base64: Optional[str] = None

@app.post("/api/bills", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
def create_bill(bill: BillCreate):
    """Create a new bill with items and generate PDF using WeasyPrint"""
    try:
        # Get patient_id from the request
        patient_id = bill.patient_id
        
        # Start a transaction
        with engine.begin() as conn:
            # Get patient details
            patient_query = text("""
                SELECT patient_name, age, gender, contact_number 
                FROM patient_info 
                WHERE id = :patient_id
            """)
            patient_result = conn.execute(patient_query, {"patient_id": patient_id})
            patient_data = patient_result.fetchone()
            
            if not patient_data:
                raise HTTPException(status_code=404, detail="Patient not found")
            
            patient_name = patient_data[0]
            patient_age = patient_data[1]
            patient_gender = patient_data[2]
            patient_phone = patient_data[3]
            
            # 1. Create the bill
            insert_bill_query = text("""
                INSERT INTO bills (patient_id, payment_mode, payment_status, total_amount)
                VALUES (:patient_id, :payment_mode, :payment_status, :total_amount)
                RETURNING id, bill_date, payment_mode, payment_status, total_amount
            """)
            
            payment_mode = bill.paymentDetails.get("mode", "cash")
            payment_status = bill.paymentDetails.get("status", "paid")
            total_amount = bill.paymentDetails.get("total", 0)
            
            result = conn.execute(
                insert_bill_query, 
                {
                    "patient_id": patient_id, 
                    "payment_mode": payment_mode, 
                    "payment_status": payment_status,
                    "total_amount": total_amount
                }
            )
            bill_row = result.fetchone()
            bill_id = bill_row[0]
            bill_date = bill_row[1]
            
            # 2. Create bill items
            bill_items = []
            
            for item in bill.rows:
                # Find service_id based on service name
                service_query = text("SELECT id FROM services WHERE name = :name")
                service_result = conn.execute(service_query, {"name": item.service})
                service_row = service_result.fetchone()
                if not service_row:
                    raise HTTPException(status_code=404, detail=f"Service '{item.service}' not found")
                service_id = service_row[0]
                
                # Find doctor_id based on doctor name
                doctor_query = text("SELECT id FROM doctors WHERE name = :name")
                doctor_result = conn.execute(doctor_query, {"name": item.doctor})
                doctor_row = doctor_result.fetchone()
                if not doctor_row:
                    raise HTTPException(status_code=404, detail=f"Doctor '{item.doctor}' not found")
                doctor_id = doctor_row[0]
                
                # Calculate net amount
                discount_amount = (item.price * item.discount) / 100
                net_amount = item.price - discount_amount
                
                # Convert appointment time string to time object
                appointment_time = datetime.datetime.strptime(item.appointmentTime, "%H:%M").time()
                
                # Insert bill item
                insert_item_query = text("""
                    INSERT INTO bill_items 
                    (bill_id, service_id, doctor_id, appointment_date, appointment_time, 
                     duration, price, discount, net_amount)
                    VALUES 
                    (:bill_id, :service_id, :doctor_id, :appointment_date, :appointment_time, 
                     :duration, :price, :discount, :net_amount)
                    RETURNING id
                """)
                
                item_result = conn.execute(
                    insert_item_query, 
                    {
                        "bill_id": bill_id,
                        "service_id": service_id,
                        "doctor_id": doctor_id,
                        "appointment_date": item.appointmentDate,
                        "appointment_time": appointment_time,
                        "duration": item.duration,
                        "price": item.price,
                        "discount": item.discount,
                        "net_amount": net_amount
                    }
                )
                
                item_id = item_result.fetchone()[0]
                
                # Add to response items
                bill_items.append({
                    "id": item_id,
                    "service_id": service_id,
                    "doctor_id": doctor_id,
                    "appointment_date": item.appointmentDate,
                    "appointment_time": appointment_time,
                    "duration": item.duration,
                    "price": item.price,
                    "discount": item.discount,
                    "net_amount": net_amount
                })
            
            # 3. Generate PDF receipt using WeasyPrint
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Bill Receipt</title>
                <style>
                    @page {{
                        size: A4;
                        margin: 1cm;
                    }}
                    body {{
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        color: #333;
                    }}
                    .receipt {{
                        max-width: 800px;
                        margin: 0 auto;
                        border: 1px solid #ddd;
                        padding: 20px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }}
                    .header {{
                        text-align: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }}
                    .clinic-name {{
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }}
                    .clinic-contact {{
                        font-size: 14px;
                        color: #666;
                    }}
                    .bill-info {{
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }}
                    .patient-info, .bill-details {{
                        flex: 1;
                    }}
                    .info-title {{
                        font-weight: bold;
                        margin-bottom: 5px;
                    }}
                    .info-item {{
                        margin-bottom: 3px;
                    }}
                    table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }}
                    th, td {{
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }}
                    th {{
                        background-color: #f2f2f2;
                    }}
                    .summary {{
                        margin-top: 20px;
                        text-align: right;
                    }}
                    .total {{
                        font-weight: bold;
                        font-size: 18px;
                        margin-top: 10px;
                    }}
                    .footer {{
                        margin-top: 30px;
                        text-align: center;
                        font-size: 14px;
                        color: #666;
                        border-top: 1px solid #ddd;
                        padding-top: 10px;
                    }}
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <div class="clinic-name">Health Plus Clinic</div>
                        <div class="clinic-contact">123 Medical Avenue, City | Phone: +91 1234567890 | Email: info@healthplus.com</div>
                    </div>
                    
                    <div class="bill-info">
                        <div class="patient-info">
                            <div class="info-title">Patient Information</div>
                            <div class="info-item">Name: {patient_name}</div>
                            <div class="info-item">Age/Gender: {patient_age}/{patient_gender}</div>
                            <div class="info-item">Contact: {patient_phone}</div>
                        </div>
                        
                        <div class="bill-details">
                            <div class="info-title">Bill Details</div>
                            <div class="info-item">Bill #: {bill_id}</div>
                            <div class="info-item">Date: {bill_date.strftime('%d-%m-%Y')}</div>
                            <div class="info-item">Payment Mode: {payment_mode.title()}</div>
                            <div class="info-item">Status: {payment_status.title()}</div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Doctor</th>
                                <th>Date & Time</th>
                                <th>Duration</th>
                                <th>Price (₹)</th>
                                <th>Discount</th>
                                <th>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
            """
            
            # Add rows for each bill item
            for item in bill.rows:
                discount_amount = (item.price * item.discount) / 100
                net_amount = item.price - discount_amount
                appointment_datetime = f"{item.appointmentDate} at {item.appointmentTime}"
                
                html_content += f"""
                            <tr>
                                <td>{item.service}</td>
                                <td>{item.doctor}</td>
                                <td>{appointment_datetime}</td>
                                <td>{item.duration} min</td>
                                <td>{item.price:.2f}</td>
                                <td>{item.discount}% ({discount_amount:.2f})</td>
                                <td>{net_amount:.2f}</td>
                            </tr>
                """
            
            # Complete the HTML
            html_content += f"""
                        </tbody>
                    </table>
                    
                    <div class="summary">
                        <div class="total">Total Amount: ₹{total_amount:.2f}</div>
                    </div>
                    
                    <div class="footer">
                        <p>Thank you for choosing Health Plus Clinic. Get well soon!</p>
                        <p>This is a computer-generated receipt and does not require a signature.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Import WeasyPrint here to avoid startup overhead if not needed
            from weasyprint import HTML
            import io
            import base64
            
            # Generate PDF from HTML
            pdf_buffer = io.BytesIO()
            HTML(string=html_content).write_pdf(pdf_buffer)
            
            # Get PDF content and convert to base64
            pdf_buffer.seek(0)
            pdf_content = pdf_buffer.getvalue()
            pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
            
            # 4. Return full bill with items and PDF
            return {
                "id": bill_id,
                "patient_id": patient_id,
                "bill_date": bill_row[1],
                "payment_mode": bill_row[2],
                "payment_status": bill_row[3],
                "total_amount": bill_row[4],
                "items": bill_items,
                "pdf_base64": pdf_base64
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/bills/{bill_id}", response_model=BillResponse)
def get_bill(bill_id: int):
    """Retrieve a bill by ID with all its items"""
    try:
        with engine.begin() as conn:
            # Get bill data
            bill_query = text("""
                SELECT id, patient_id, bill_date, payment_mode, payment_status, total_amount
                FROM bills WHERE id = :bill_id
            """)
            
            bill_result = conn.execute(bill_query, {"bill_id": bill_id})
            bill_row = bill_result.fetchone()
            
            if not bill_row:
                raise HTTPException(status_code=404, detail="Bill not found")
            
            # Get bill items
            items_query = text("""
                SELECT bi.id, bi.service_id, bi.doctor_id, bi.appointment_date, 
                       bi.appointment_time, bi.duration, bi.price, bi.discount, bi.net_amount
                FROM bill_items bi
                WHERE bi.bill_id = :bill_id
            """)
            
            items_result = conn.execute(items_query, {"bill_id": bill_id})
            items = [dict(row._mapping) for row in items_result]
            
            # Construct response
            return {
                "id": bill_row[0],
                "patient_id": bill_row[1],
                "bill_date": bill_row[2],
                "payment_mode": bill_row[3],
                "payment_status": bill_row[4],
                "total_amount": bill_row[5],
                "items": items
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/patients/{patient_id}/bills", response_model=List[BillResponse])
def get_patient_bills(patient_id: int):
    """Retrieve all bills for a patient"""
    try:
        with engine.begin() as conn:
            # Check if patient exists
            patient_query = text("SELECT id FROM patient_info WHERE id = :patient_id")
            patient_result = conn.execute(patient_query, {"patient_id": patient_id})
            if not patient_result.fetchone():
                raise HTTPException(status_code=404, detail="Patient not found")
            
            # Get all bills for the patient
            bills_query = text("""
                SELECT id FROM bills WHERE patient_id = :patient_id ORDER BY bill_date DESC
            """)
            
            bills_result = conn.execute(bills_query, {"patient_id": patient_id})
            bill_ids = [row[0] for row in bills_result]
            
            # Get details for each bill
            bills = []
            for bill_id in bill_ids:
                bill = get_bill(bill_id)
                bills.append(bill)
            
            return bills
            
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/bills/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bill(bill_id: int):
    """Delete a bill by ID (will also delete all bill items due to CASCADE)"""
    try:
        with engine.begin() as conn:
            # Check if bill exists
            check_query = text("SELECT id FROM bills WHERE id = :bill_id")
            check_result = conn.execute(check_query, {"bill_id": bill_id})
            if not check_result.fetchone():
                raise HTTPException(status_code=404, detail="Bill not found")
            
            # Delete the bill (bill items will be deleted automatically due to CASCADE)
            delete_query = text("DELETE FROM bills WHERE id = :bill_id")
            conn.execute(delete_query, {"bill_id": bill_id})
            
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/api/transcribe-audio")
async def transcribe_audio(file: UploadFile):
    if not OPENAI_API_KEY:
        raise HTTPException(500, "Missing OPENAI_API_KEY")

    contents = await file.read()
    temp_filename = "temp_audio.webm"
    with open(temp_filename, "wb") as f:
        f.write(contents)

    url = "https://api.openai.com/v1/audio/translations"
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }

    with open(temp_filename, "rb") as audio:
        files = {
            "file": (temp_filename, audio, file.content_type),
            "model": (None, "whisper-1"),
        }
        response = requests.post(url, headers=headers, files=files)

    if response.status_code != 200:
        raise HTTPException(500, f"Whisper API error: {response.text}")

    data = response.json()
    return {"transcript": data["text"]}

@app.post("/api/parse-voice-transcript")
def parse_voice_transcript(payload: dict):
    """
    Expects JSON:
    {
      "transcript": "... user speech ...",
      "department": "e.g. 'Cardiology'"
    }
    Returns a JSON like:
    {
      "complaints": [],
      "past_history": [],
      "personal_history": [],
      "family_history": [],
      "allergies": [],
      "medication_history": [],
      "surgical_history": [],
      "hpi": "",
      "vitals": {
        "bp": "",
        "pulse": "",
        "temperature": "",
        "spo2": "",
        "height": "",
        "weight": ""
      }
    }
    """

    transcript = payload.get("transcript", "")
    department = payload.get("department", "General Medicine")

    if not transcript.strip():
        # Return empty structure if no transcript
        return {
            "complaints": [],
            "past_history": [],
            "personal_history": [],
            "family_history": [],
            "allergies": [],
            "medication_history": [],
            "surgical_history": [],
            "hpi": "",
            "vitals": {}
        }

    prompt = f"""
You are a medical assistant. A voice transcript is provided:

\"\"\"{transcript}\"\"\"

Please extract and classify any items into:
1) complaints
2) past_history
3) personal_history
4) family_history
5) allergies
6) medication_history
7) surgical_history
8) hpi
9) vitals (bp, pulse, temperature, spo2, height, weight if present)

Return your final answer as valid JSON with **exactly** these keys:
{{
  "complaints": [],
  "past_history": [],
  "personal_history": [],
  "family_history": [],
  "allergies": [],
  "medication_history": [],
  "surgical_history": [],
  "hpi": "",
  "vitals": {{
    "bp": "",
    "pulse": "",
    "temperature": "",
    "spo2": "",
    "height": "",
    "weight": ""
  }}
}}
No extra commentary.
Department is {department}, but only use it if relevant for classification context.
"""

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=600
        )
        raw_content = response.choices[0].message.content.strip()

        result = json.loads(raw_content)

        return {
            "complaints": result.get("complaints", []),
            "past_history": result.get("past_history", []),
            "personal_history": result.get("personal_history", []),
            "family_history": result.get("family_history", []),
            "allergies": result.get("allergies", []),
            "medication_history": result.get("medication_history", []),
            "surgical_history": result.get("surgical_history", []),
            "hpi": result.get("hpi", ""),
            "vitals": result.get("vitals", {})
        }

    except Exception as e:
        logging.error(f"parse_voice_transcript error: {e}")
        # Return empty fallback
        return {
            "complaints": [],
            "past_history": [],
            "personal_history": [],
            "family_history": [],
            "allergies": [],
            "medication_history": [],
            "surgical_history": [],
            "hpi": "",
            "vitals": {}
        }
    
@app.post("/api/parse-voice-prescription")
def parse_voice_prescription(payload: dict):
    """
    Expects JSON:
    {
      "transcript": "... user speech ..."
    }

    Returns a JSON like:
    {
      "patient_name": "",
      "patient_age": "",
      "patient_gender": "",
      "patient_contact": "",
      "complaints": [],
      "diagnosis": "",
      "tests": [],
      "follow_up": "",
      "vitals": {
        "temperature": "",
        "bp": "",
        "pulse": "",
        "bmi": ""
      },
      "medicines": [
        { "medicine": "", "dosage": "", "unit": "", "when": "", "duration": "", "notes": "" }
      ]
    }
    """

    transcript = payload.get("transcript", "").strip()
    if not transcript:
        return {
            "patient_name": "",
            "patient_age": "",
            "patient_gender": "",
            "patient_contact": "",
            "complaints": [],
            "diagnosis": "",
            "tests": [],
            "follow_up": "",
            "vitals": {
                "temperature": "",
                "bp": "",
                "pulse": "",
                "bmi": ""
            },
            "medicines": []
        }

    # Example prompt
    prompt = f"""
You are a helpful medical assistant specialized in writing prescriptions from voice dictation.
A transcript is given:
\"\"\"{transcript}\"\"\"

Extract and classify into EXACT JSON fields:
1. "patient_name" (string)
2. "patient_age" (string or numeric as string)
3. "patient_gender" (e.g. 'Male', 'Female', 'Other')
4. "patient_contact" (string)
5. "complaints": array of strings
6. "diagnosis": single string (brief or comma-separated if multiple)
7. "tests": array of strings
8. "follow_up": single string of instructions
9. "vitals": object with keys ["temperature","bp","pulse","bmi"] (all strings)
10. "medicines": array of objects, each with:
    {{ "medicine":"", "dosage":"", "unit":"", "when":"", "duration":"", "notes":"" }}

Return JSON with exactly these keys, no extra commentary.
"""

    try:
        import json
        from openai import OpenAI
        import os
        import logging

        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
        client = OpenAI(api_key=OPENAI_API_KEY)

        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=800
        )

        raw_content = response.choices[0].message.content.strip()
        parsed = json.loads(raw_content)

        return {
            "patient_name": parsed.get("patient_name", ""),
            "patient_age": parsed.get("patient_age", ""),
            "patient_gender": parsed.get("patient_gender", ""),
            "patient_contact": parsed.get("patient_contact", ""),
            "complaints": parsed.get("complaints", []),
            "diagnosis": parsed.get("diagnosis", ""),
            "tests": parsed.get("tests", []),
            "follow_up": parsed.get("follow_up", ""),
            "vitals": parsed.get("vitals", {
                "temperature": "",
                "bp": "",
                "pulse": "",
                "bmi": ""
            }),
            "medicines": parsed.get("medicines", [])
        }

    except Exception as e:
        logging.error(f"parse_voice_prescription error: {e}")
        # Return fallback if parsing fails
        return {
            "patient_name": "",
            "patient_age": "",
            "patient_gender": "",
            "patient_contact": "",
            "complaints": [],
            "diagnosis": "",
            "tests": [],
            "follow_up": "",
            "vitals": {
                "temperature": "",
                "bp": "",
                "pulse": "",
                "bmi": ""
            },
            "medicines": []
        }


class AppointmentCreate(BaseModel):
    patient_name: str
    age: int
    gender: str
    contact_number: str
    appointment_date: date
    appointment_time: time

@app.post("/api/appointments")
def create_appointment(data: AppointmentCreate):
    """
    Creates a new appointment record in the 'appointments' table.
    """
    insert_query = text("""
        INSERT INTO appointments (
            patient_name,
            age,
            gender,
            contact_number,
            appointment_date,
            appointment_time
        ) VALUES (
            :patient_name,
            :age,
            :gender,
            :contact_number,
            :appointment_date,
            :appointment_time
        )
        RETURNING id
    """)
    try:
        with engine.begin() as conn:
            result = conn.execute(insert_query, {
                "patient_name": data.patient_name,
                "age": data.age,
                "gender": data.gender,
                "contact_number": data.contact_number,
                "appointment_date": data.appointment_date,
                "appointment_time": data.appointment_time,
            })
            new_id = result.fetchone()[0]

        return {"message": "Appointment created successfully", "appointment_id": new_id}

    except Exception as e:
        logger.exception("Error creating appointment")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/appointments")
def get_appointments(
    date: Optional[str] = Query(None),
    clinic_id: Optional[int] = Query(None),
    doctor_id: Optional[int] = Query(None) 
):
    """
    Returns appointments from BOTH the new 'appointments' table
    AND the existing 'bill_items' that have requires_time=TRUE
    for a given date (default= today). Optionally filters
    by clinic_id or doctor_id (on the 'bill_items' side).
    """

    # 1) Determine date if not provided
    if not date:
        from datetime import date as dt_date
        date = dt_date.today().isoformat()

    query_appointments = """
        SELECT
            id AS id,
            appointment_time,
            patient_name,
            NULL AS patient_id,
            NULL AS service_name,
            NULL AS doctor_name
        FROM appointments
        WHERE appointment_date = :date_param
    """
    query_appointments += " ORDER BY appointment_time ASC"

    query_bill_items = """
        SELECT
            bi.id AS id,
            bi.appointment_time AS appointment_time,
            pi.patient_name AS patient_name,
            b.patient_id AS patient_id,
            s.name AS service_name,
            d.name AS doctor_name
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        JOIN patient_info pi ON pi.id = b.patient_id
        JOIN services s ON s.id = bi.service_id
        JOIN doctors d ON d.id = bi.doctor_id
        WHERE s.requires_time = TRUE
          AND bi.appointment_date = :date_param
    """
    extra_filters = []
    if doctor_id:
        extra_filters.append(" d.id = :doctor_id ")
    elif clinic_id:
        extra_filters.append(" d.clinic_id = :clinic_id ")

    if extra_filters:
        query_bill_items += " AND " + " AND ".join(extra_filters)

    query_bill_items += " ORDER BY bi.appointment_time ASC"

    # 4) Prepare params
    params = {"date_param": date}
    if doctor_id:
        params["doctor_id"] = doctor_id
    if clinic_id:
        params["clinic_id"] = clinic_id

    # 5) Execute both queries in a single transaction
    with engine.begin() as conn:
        appt_rows = conn.execute(text(query_appointments), params).mappings().all()
        bill_rows = conn.execute(text(query_bill_items), params).mappings().all()

    # 6) Convert each row to a dictionary
    def to_appointment_dict(r, is_bill=False):
        return {
            "id": r["id"],
            "appointment_time": r["appointment_time"].isoformat()[:5] if r["appointment_time"] else None,
            "patient_name": r["patient_name"],
            "patient_id": r["patient_id"] if is_bill else None,
            "service_name": r["service_name"] if is_bill else None,
            "doctor_name": r["doctor_name"] if is_bill else None,
        }

    merged = [to_appointment_dict(r, False) for r in appt_rows] + \
             [to_appointment_dict(r, True) for r in bill_rows]

    # Sort final by time
    merged.sort(key=lambda x: x["appointment_time"] or "00:00")

    return {
        "date": date,
        "appointments": merged
    }


from datetime import date as dt_date

@app.get("/api/appointments/today")
def get_todays_appointments(
    clinic_id: Optional[int] = Query(None),  
    doctor_id: Optional[int] = Query(None),  
):
    """
    Returns today's (CURRENT_DATE) appointments from the 'appointments' table
    plus bill_items that require time. Optionally filter by clinic_id / doctor_id.
    """
    from datetime import date as dt_date
    today_str = dt_date.today().isoformat()

    # 1) Query the 'appointments' table
    appt_query = """
        SELECT
            id AS id,
            appointment_time,
            patient_name,
            NULL AS patient_id,
            NULL AS service_name,
            NULL AS doctor_name
        FROM appointments
        WHERE appointment_date = CURRENT_DATE
    """
    appt_query += " ORDER BY appointment_time"

    # 2) Bill items query
    bill_query = """
        SELECT
            bi.id AS id,
            bi.appointment_time,
            pi.patient_name,
            b.patient_id,
            s.name AS service_name,
            d.name AS doctor_name
        FROM bill_items bi
        JOIN bills b ON b.id = bi.bill_id
        JOIN patient_info pi ON pi.id = b.patient_id
        JOIN services s ON s.id = bi.service_id
        JOIN doctors d ON d.id = bi.doctor_id
        WHERE s.requires_time = TRUE
          AND bi.appointment_date = CURRENT_DATE
    """

    # same idea for filtering
    extra_filters = []
    if doctor_id:
        extra_filters.append(" d.id = :doctor_id ")
    if clinic_id:
        extra_filters.append(" d.clinic_id = :clinic_id ")

    if extra_filters:
        bill_query += " AND " + " AND ".join(extra_filters)

    bill_query += " ORDER BY bi.appointment_time"

    params = {}
    if doctor_id:
        params["doctor_id"] = doctor_id
    if clinic_id:
        params["clinic_id"] = clinic_id

    with engine.begin() as conn:
        appt_rows = conn.execute(text(appt_query), params).mappings().all()
        bill_rows = conn.execute(text(bill_query), params).mappings().all()

    def to_appointment_dict(row, from_bill=False):
        return {
            "id": row["id"],
            "appointment_time": row["appointment_time"].isoformat()[:5] if row["appointment_time"] else None,
            "patient_name": row["patient_name"],
            "patient_id": row["patient_id"] if from_bill else None,
            "service_name": row["service_name"] if from_bill else None,
            "doctor_name": row["doctor_name"] if from_bill else None,
        }

    merged = [to_appointment_dict(r, False) for r in appt_rows] \
           + [to_appointment_dict(r, True) for r in bill_rows]

    merged.sort(key=lambda x: x["appointment_time"] or "00:00")

    return {
        "date": today_str,
        "appointments": merged
    }

@app.get("/api/clinics")
def list_clinics():
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, name FROM clinics ORDER BY name")).mappings().all()
    return [{"id": r["id"], "name": r["name"]} for r in rows]


@app.get("/api/doctors")
def list_doctors(clinic_id: Optional[int] = None):
    query = "SELECT id, name, speciality, contact_number, clinic_id FROM doctors"
    params = {}
    if clinic_id:
        query += " WHERE clinic_id = :cid"
        params["cid"] = clinic_id
    query += " ORDER BY name"
    with engine.connect() as conn:
        rows = conn.execute(text(query), params).mappings().all()
    return [dict(r) for r in rows]

@app.get("/api/reports")
def get_reports():
    """
    Returns a comprehensive set of metrics for the 'report' page, including:
      - total patients
      - male/female/other ratio
      - age distribution
      - total appointments
      - repeat visits distribution
      - monthly footfall
      - top doctors
      - top services
      - total revenue (from bills)
      - payment mode distribution (from bills)
      - top departments
      - monthlyGenderTrend
      - monthlyAgeTrend
      - *NEW*: topDiagnosis
      - *NEW*: monthlyRevenue
    """
    try:
        with engine.begin() as conn:

            # 1) TOTAL PATIENTS
            total_patients_q = text("SELECT COUNT(*) FROM patient_info")
            total_patients = conn.execute(total_patients_q).scalar() or 0

            # 2) GENDER RATIO
            male_q = text("SELECT COUNT(*) FROM patient_info WHERE gender ILIKE 'male'")
            female_q = text("SELECT COUNT(*) FROM patient_info WHERE gender ILIKE 'female'")
            others_q = text("""
                SELECT COUNT(*) 
                FROM patient_info
                WHERE gender NOT ILIKE 'male'
                  AND gender NOT ILIKE 'female'
                  AND gender NOT IN ('','Select Gender')
            """)
            male_count = conn.execute(male_q).scalar() or 0
            female_count = conn.execute(female_q).scalar() or 0
            other_count = conn.execute(others_q).scalar() or 0

            # 3) AGE DISTRIBUTION
            age_0_18_q = text("SELECT COUNT(*) FROM patient_info WHERE age BETWEEN 0 AND 18")
            age_19_30_q = text("SELECT COUNT(*) FROM patient_info WHERE age BETWEEN 19 AND 30")
            age_31_60_q = text("SELECT COUNT(*) FROM patient_info WHERE age BETWEEN 31 AND 60")
            age_61_plus_q = text("SELECT COUNT(*) FROM patient_info WHERE age >= 61")
            age_0_18 = conn.execute(age_0_18_q).scalar() or 0
            age_19_30 = conn.execute(age_19_30_q).scalar() or 0
            age_31_60 = conn.execute(age_31_60_q).scalar() or 0
            age_61_plus = conn.execute(age_61_plus_q).scalar() or 0

            # 4) TOTAL APPOINTMENTS
            total_appts_q = text("SELECT COUNT(*) FROM appointments")
            total_appointments = conn.execute(total_appts_q).scalar() or 0

            # 5) REPEAT VISITS
            repeat_sql = """
                WITH counts AS (
                    SELECT patient_id, COUNT(*) AS version_count
                    FROM patient_info_versions
                    GROUP BY patient_id
                )
                SELECT
                    SUM(CASE WHEN version_count = 1 THEN 1 ELSE 0 END) AS one_visit,
                    SUM(CASE WHEN version_count = 2 THEN 1 ELSE 0 END) AS two_visits,
                    SUM(CASE WHEN version_count = 3 THEN 1 ELSE 0 END) AS three_visits,
                    SUM(CASE WHEN version_count >= 4 THEN 1 ELSE 0 END) AS four_plus_visits
                FROM counts
            """
            row = conn.execute(text(repeat_sql)).mappings().first()
            repeat_visits = {
                "one": row["one_visit"] if row else 0,
                "two": row["two_visits"] if row else 0,
                "three": row["three_visits"] if row else 0,
                "four_plus": row["four_plus_visits"] if row else 0,
            }

            # 6) MONTHLY FOOTFALL
            footfall_sql = """
                SELECT 
                    to_char(date_trunc('month', version_timestamp), 'YYYY-MM') AS month_label,
                    COUNT(*) AS count
                FROM patient_info_versions
                GROUP BY 1
                ORDER BY 1
            """
            footfall_rows = conn.execute(text(footfall_sql)).mappings().all()
            monthly_footfall = []
            for r in footfall_rows:
                monthly_footfall.append({
                    "month": r["month_label"],
                    "count": r["count"]
                })

            # 7) TOP DOCTORS
            top_doctors_sql = """
                SELECT d.name as doctor_name, COUNT(bi.id) as total_count
                FROM bill_items bi
                JOIN doctors d ON d.id = bi.doctor_id
                GROUP BY d.name
                ORDER BY total_count DESC
                LIMIT 5
            """
            top_doctors_rows = conn.execute(text(top_doctors_sql)).mappings().all()
            top_doctors = [
                {"doctor": td["doctor_name"], "count": td["total_count"]}
                for td in top_doctors_rows
            ]

            # 8) TOP SERVICES
            top_services_sql = """
                SELECT s.name as service_name, COUNT(bi.id) as total_count
                FROM bill_items bi
                JOIN services s ON s.id = bi.service_id
                GROUP BY s.name
                ORDER BY total_count DESC
                LIMIT 5
            """
            top_services_rows = conn.execute(text(top_services_sql)).mappings().all()
            top_services = [
                {"service": ts["service_name"], "count": ts["total_count"]}
                for ts in top_services_rows
            ]

            # 9) TOTAL REVENUE (BILLS)
            total_revenue_q = text("SELECT COALESCE(SUM(total_amount), 0) FROM bills")
            total_revenue = conn.execute(total_revenue_q).scalar() or 0.0

            # 10) PAYMENT MODE
            payment_mode_sql = """
                SELECT payment_mode, COUNT(*) AS cnt
                FROM bills
                GROUP BY payment_mode
            """
            p_rows = conn.execute(text(payment_mode_sql)).mappings().all()
            payment_mode_dist = []
            for r in p_rows:
                payment_mode_dist.append({
                    "mode": r["payment_mode"] or "Unknown",
                    "count": r["cnt"]
                })

            # 11) TOP DEPARTMENTS
            top_dept_sql = """
                SELECT department, COUNT(*) as dept_count
                FROM patient_info
                WHERE department IS NOT NULL 
                  AND department <> ''
                GROUP BY department
                ORDER BY dept_count DESC
                LIMIT 5
            """
            dept_rows = conn.execute(text(top_dept_sql)).mappings().all()
            top_departments = [
                {"department": dr["department"], "count": dr["dept_count"]}
                for dr in dept_rows
            ]

            # 12) MONTHLY GENDER TREND
            monthly_gender_sql = """
                SELECT 
                    to_char(date_trunc('month', created_at), 'YYYY-MM') AS month_label,
                    SUM(CASE WHEN gender ILIKE 'male' THEN 1 ELSE 0 END) AS male,
                    SUM(CASE WHEN gender ILIKE 'female' THEN 1 ELSE 0 END) AS female,
                    SUM(CASE WHEN gender NOT ILIKE 'male' AND gender NOT ILIKE 'female'
                             AND gender NOT IN ('','Select Gender') THEN 1 ELSE 0 END) AS others
                FROM patient_info
                GROUP BY 1
                ORDER BY 1
            """
            mg_rows = conn.execute(text(monthly_gender_sql)).mappings().all()
            monthly_gender_trend = []
            for r in mg_rows:
                monthly_gender_trend.append({
                    "month": r["month_label"],
                    "male": r["male"],
                    "female": r["female"],
                    "others": r["others"],
                })

            # 13) MONTHLY AGE TREND
            monthly_age_sql = """
                SELECT
                    to_char(date_trunc('month', created_at), 'YYYY-MM') AS month_label,
                    SUM(CASE WHEN age BETWEEN 0 AND 18 THEN 1 ELSE 0 END) AS age_0_18,
                    SUM(CASE WHEN age BETWEEN 19 AND 30 THEN 1 ELSE 0 END) AS age_19_30,
                    SUM(CASE WHEN age BETWEEN 31 AND 60 THEN 1 ELSE 0 END) AS age_31_60,
                    SUM(CASE WHEN age >= 61 THEN 1 ELSE 0 END) AS age_61_plus
                FROM patient_info
                GROUP BY 1
                ORDER BY 1
            """
            ma_rows = conn.execute(text(monthly_age_sql)).mappings().all()
            monthly_age_trend = []
            for r in ma_rows:
                monthly_age_trend.append({
                    "month": r["month_label"],
                    "age_0_18": r["age_0_18"],
                    "age_19_30": r["age_19_30"],
                    "age_31_60": r["age_31_60"],
                    "age_61_plus": r["age_61_plus"],
                })

            top_diag_sql = """
                WITH diag_cte AS (
                  SELECT unnest(string_to_array(final_diagnosis, ',')) AS diag
                  FROM patient_info
                  WHERE final_diagnosis IS NOT NULL
                    AND final_diagnosis <> ''
                )
                SELECT trim(diag) AS diagnosis, COUNT(*) AS count
                FROM diag_cte
                GROUP BY trim(diag)
                ORDER BY count DESC
                LIMIT 5
            """
            diag_rows = conn.execute(text(top_diag_sql)).mappings().all()
            top_diagnosis = []
            for row_d in diag_rows:
                top_diagnosis.append({
                    "diagnosis": row_d["diagnosis"],
                    "count": row_d["count"]
                })

            monthly_revenue_sql = """
                SELECT 
                    to_char(date_trunc('month', bill_date), 'YYYY-MM') AS month_label,
                    COALESCE(SUM(total_amount), 0) as revenue
                FROM bills
                GROUP BY 1
                ORDER BY 1
            """
            rev_rows = conn.execute(text(monthly_revenue_sql)).mappings().all()
            monthly_revenue = []
            for rr in rev_rows:
                monthly_revenue.append({
                    "month": rr["month_label"],
                    "revenue": float(rr["revenue"])
                })

        return {
            "success": True,
            "data": {
                # BASIC COUNTS
                "counts": {
                    "totalPatients": total_patients,
                    "totalAppointments": total_appointments,
                    "totalRevenue": float(total_revenue),
                },
                # GENDER / AGE
                "genderRatio": {
                    "male": male_count,
                    "female": female_count,
                    "others": other_count
                },
                "ageDistribution": {
                    "0_18": age_0_18,
                    "19_30": age_19_30,
                    "31_60": age_31_60,
                    "61_plus": age_61_plus
                },
                # REPEAT VISITS
                "repeatVisits": repeat_visits,
                # MONTHLY FOOTFALL
                "monthlyFootfall": monthly_footfall,
                # TOP DOCTORS & SERVICES
                "topDoctors": top_doctors,
                "topServices": top_services,
                # PAYMENT MODES & DEPARTMENTS
                "paymentModeDistribution": payment_mode_dist,
                "topDepartments": top_departments,
                # MONTHLY TRENDS
                "monthlyGenderTrend": monthly_gender_trend,
                "monthlyAgeTrend": monthly_age_trend,

                # ** NEW FIELDS **
                "topDiagnosis": top_diagnosis,
                "monthlyRevenue": monthly_revenue
            }
        }
    except Exception as e:
        logger.exception("Error generating reports")
        return {"success": False, "error": str(e)}
    

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import text
from datetime import datetime

# Medicine models
class MedicineBase(BaseModel):
    name: str
    manufacturer: str
    quantity: int
    default_price: float

class MedicineCreate(MedicineBase):
    pass

class MedicineResponse(MedicineBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# Medicine endpoints
@app.post("/api/pharmacy/medicines", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
def create_medicine(medicine: MedicineCreate):
    """Create a new medicine in inventory"""
    try:
        insert_query = text("""
            INSERT INTO medicines_inventory (name, manufacturer, quantity, default_price) 
            VALUES (:name, :manufacturer, :quantity, :default_price) 
            RETURNING id, name, manufacturer, quantity, default_price, created_at, updated_at
        """)
        
        with engine.begin() as conn:
            result = conn.execute(insert_query, {
                "name": medicine.name, 
                "manufacturer": medicine.manufacturer, 
                "quantity": medicine.quantity,
                "default_price": medicine.default_price
            })
            medicine_data = result.fetchone()
        
        return dict(medicine_data._mapping)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pharmacy/medicines", response_model=List[MedicineResponse])
def get_all_medicines():
    """Retrieve all medicines from inventory"""
    try:
        query = text("""
            SELECT id, name, manufacturer, quantity, default_price, created_at, updated_at 
            FROM medicines_inventory 
            ORDER BY name ASC
        """)
        with engine.begin() as conn:
            result = conn.execute(query)
            medicines = [dict(row) for row in result.mappings()]
        return medicines
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pharmacy/medicines/{medicine_id}", response_model=MedicineResponse)
def get_medicine(medicine_id: int):
    """Retrieve a medicine by ID"""
    try:
        query = text("""
            SELECT id, name, manufacturer, quantity, default_price, created_at, updated_at 
            FROM medicines_inventory 
            WHERE id = :medicine_id
        """)
        with engine.begin() as conn:
            result = conn.execute(query, {"medicine_id": medicine_id})
            medicine = result.fetchone()
            if not medicine:
                raise HTTPException(status_code=404, detail="Medicine not found")
        return dict(medicine._mapping)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/pharmacy/medicines/{medicine_id}", response_model=MedicineResponse)
def update_medicine(medicine_id: int, medicine: MedicineCreate):
    """Update an existing medicine"""
    try:
        update_query = text("""
            UPDATE medicines_inventory 
            SET name = :name, 
                manufacturer = :manufacturer, 
                quantity = :quantity, 
                default_price = :default_price 
            WHERE id = :medicine_id 
            RETURNING id, name, manufacturer, quantity, default_price, created_at, updated_at
        """)
        
        with engine.begin() as conn:
            result = conn.execute(update_query, {
                "name": medicine.name, 
                "manufacturer": medicine.manufacturer, 
                "quantity": medicine.quantity, 
                "default_price": medicine.default_price,
                "medicine_id": medicine_id
            })
            updated_medicine = result.fetchone()
            if not updated_medicine:
                raise HTTPException(status_code=404, detail="Medicine not found")
        
        return dict(updated_medicine._mapping)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.patch("/api/pharmacy/medicines/{medicine_id}/quantity", response_model=MedicineResponse)
def update_medicine_quantity(medicine_id: int, quantity_change: int):
    """Update only the quantity of a medicine (useful for inventory adjustments)"""
    try:
        # First, get the current medicine to ensure it exists and check current quantity
        query = text("SELECT quantity FROM medicines_inventory WHERE id = :medicine_id")
        
        with engine.begin() as conn:
            result = conn.execute(query, {"medicine_id": medicine_id})
            current_medicine = result.fetchone()
            
            if not current_medicine:
                raise HTTPException(status_code=404, detail="Medicine not found")
            
            current_quantity = current_medicine[0]
            new_quantity = current_quantity + quantity_change
            
            # Don't allow negative quantity
            if new_quantity < 0:
                raise HTTPException(status_code=400, detail="Cannot reduce quantity below zero")
            
            # Update the quantity
            update_query = text("""
                UPDATE medicines_inventory 
                SET quantity = :new_quantity
                WHERE id = :medicine_id 
                RETURNING id, name, manufacturer, quantity, default_price, created_at, updated_at
            """)
            
            result = conn.execute(update_query, {
                "new_quantity": new_quantity,
                "medicine_id": medicine_id
            })
            updated_medicine = result.fetchone()
        
        return dict(updated_medicine._mapping)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/pharmacy/medicines/{medicine_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_medicine(medicine_id: int):
    """Delete a medicine by ID"""
    try:
        delete_query = text("DELETE FROM medicines_inventory WHERE id = :medicine_id RETURNING id")
        with engine.begin() as conn:
            result = conn.execute(delete_query, {"medicine_id": medicine_id})
            deleted_id = result.fetchone()
            if not deleted_id:
                raise HTTPException(status_code=404, detail="Medicine not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pharmacy/medicines/search", response_model=List[MedicineResponse])
def search_medicines(query: str):
    """Search medicines by name or manufacturer"""
    try:
        search_query = text("""
            SELECT id, name, manufacturer, quantity, default_price, created_at, updated_at 
            FROM medicines_inventory 
            WHERE name ILIKE :query OR manufacturer ILIKE :query
            ORDER BY name ASC
        """)
        
        with engine.begin() as conn:
            result = conn.execute(search_query, {"query": f"%{query}%"})
            medicines = [dict(row) for row in result.mappings()]
        
        return medicines
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pharmacy/medicines/low-stock", response_model=List[MedicineResponse])
def get_low_stock_medicines(threshold: int = 10):
    """Get medicines with stock below the specified threshold"""
    try:
        query = text("""
            SELECT id, name, manufacturer, quantity, default_price, created_at, updated_at 
            FROM medicines_inventory 
            WHERE quantity <= :threshold AND quantity > 0
            ORDER BY quantity ASC
        """)
        
        with engine.begin() as conn:
            result = conn.execute(query, {"threshold": threshold})
            medicines = [dict(row) for row in result.mappings()]
        
        return medicines
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy import text
import datetime
import base64
import io

# Pydantic models for pharmacy billing
class PharmacyBillItemCreate(BaseModel):
    medicineId: int
    name: str
    quantity: int
    price: float
    discount: float = 0

class PharmacyBillCreate(BaseModel):
    patient: Dict[str, Any]  # Contains id, name, age, gender, phone
    items: List[PharmacyBillItemCreate]
    payment: Dict[str, Any]  # Contains mode, status, total

class PharmacyBillItemResponse(BaseModel):
    id: int
    medicine_id: int
    medicine_name: str
    quantity: int
    price_per_unit: float
    discount_percentage: float
    item_total: float

class PharmacyBillResponse(BaseModel):
    id: int
    patient_id: Optional[int]
    patient_name: str
    patient_age: Optional[int]
    patient_gender: Optional[str]
    patient_phone: str
    bill_date: datetime.datetime
    payment_mode: str
    payment_status: str
    total_amount: float
    items: List[PharmacyBillItemResponse]
    pdf_base64: Optional[str] = None

# Pharmacy billing endpoints
@app.post("/api/pharmacy/bills", response_model=PharmacyBillResponse, status_code=status.HTTP_201_CREATED)
def create_pharmacy_bill(bill: PharmacyBillCreate):
    """Create a new pharmacy bill with items and generate PDF"""
    try:
        # Extract patient information
        patient_id = bill.patient.get("id")
        patient_name = bill.patient.get("name")
        patient_age = bill.patient.get("age")
        patient_gender = bill.patient.get("gender")
        patient_phone = bill.patient.get("phone")
        
        # Extract payment details
        payment_mode = bill.payment.get("mode", "cash")
        payment_status = bill.payment.get("status", "paid")
        total_amount = bill.payment.get("total", 0)
        
        # Start a transaction
        with engine.begin() as conn:
            # 1. Create the pharmacy bill
            insert_bill_query = text("""
                INSERT INTO pharmacy_bills 
                (patient_id, patient_name, patient_age, patient_gender, patient_phone, 
                 payment_mode, payment_status, total_amount)
                VALUES 
                (:patient_id, :patient_name, :patient_age, :patient_gender, :patient_phone, 
                 :payment_mode, :payment_status, :total_amount)
                RETURNING id, bill_date, payment_mode, payment_status, total_amount
            """)
            
            result = conn.execute(
                insert_bill_query, 
                {
                    "patient_id": patient_id,
                    "patient_name": patient_name,
                    "patient_age": patient_age,
                    "patient_gender": patient_gender,
                    "patient_phone": patient_phone,
                    "payment_mode": payment_mode,
                    "payment_status": payment_status,
                    "total_amount": total_amount
                }
            )
            
            bill_row = result.fetchone()
            bill_id = bill_row[0]
            bill_date = bill_row[1]
            
            # 2. Create pharmacy bill items
            bill_items = []
            
            for item in bill.items:
                # Calculate net amount for the item
                item_total = item.quantity * item.price * (1 - item.discount / 100)
                
                # Insert pharmacy bill item
                insert_item_query = text("""
                    INSERT INTO pharmacy_bill_items 
                    (bill_id, medicine_id, medicine_name, quantity, price_per_unit, 
                     discount_percentage, item_total)
                    VALUES 
                    (:bill_id, :medicine_id, :medicine_name, :quantity, :price_per_unit, 
                     :discount_percentage, :item_total)
                    RETURNING id
                """)
                
                item_result = conn.execute(
                    insert_item_query, 
                    {
                        "bill_id": bill_id,
                        "medicine_id": item.medicineId,
                        "medicine_name": item.name,
                        "quantity": item.quantity,
                        "price_per_unit": item.price,
                        "discount_percentage": item.discount,
                        "item_total": item_total
                    }
                )
                
                item_id = item_result.fetchone()[0]
                
                # Add to response items
                bill_items.append({
                    "id": item_id,
                    "medicine_id": item.medicineId,
                    "medicine_name": item.name,
                    "quantity": item.quantity,
                    "price_per_unit": item.price,
                    "discount_percentage": item.discount,
                    "item_total": item_total
                })
                
                # Update medicine inventory quantity
                update_inventory_query = text("""
                    UPDATE medicines_inventory
                    SET quantity = quantity - :sold_quantity
                    WHERE id = :medicine_id
                    RETURNING quantity
                """)
                
                inventory_result = conn.execute(
                    update_inventory_query,
                    {
                        "sold_quantity": item.quantity,
                        "medicine_id": item.medicineId
                    }
                )
                
                # Check if inventory update was successful
                inventory_row = inventory_result.fetchone()
                if not inventory_row:
                    raise HTTPException(status_code=404, detail=f"Medicine with ID {item.medicineId} not found")
                
                if inventory_row[0] < 0:
                    # If quantity went negative, roll back with a specific error
                    raise HTTPException(status_code=400, detail=f"Insufficient stock for {item.name}")
            
            # 3. Generate PDF receipt
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Pharmacy Bill Receipt</title>
                <style>
                    @page {{
                        size: A4;
                        margin: 1cm;
                    }}
                    body {{
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        color: #333;
                    }}
                    .receipt {{
                        max-width: 800px;
                        margin: 0 auto;
                        border: 1px solid #ddd;
                        padding: 20px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }}
                    .header {{
                        text-align: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }}
                    .pharmacy-name {{
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }}
                    .pharmacy-contact {{
                        font-size: 14px;
                        color: #666;
                    }}
                    .bill-info {{
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }}
                    .patient-info, .bill-details {{
                        flex: 1;
                    }}
                    .info-title {{
                        font-weight: bold;
                        margin-bottom: 5px;
                    }}
                    .info-item {{
                        margin-bottom: 3px;
                    }}
                    table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }}
                    th, td {{
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }}
                    th {{
                        background-color: #f2f2f2;
                    }}
                    .summary {{
                        margin-top: 20px;
                        text-align: right;
                    }}
                    .total {{
                        font-weight: bold;
                        font-size: 18px;
                        margin-top: 10px;
                    }}
                    .footer {{
                        margin-top: 30px;
                        text-align: center;
                        font-size: 14px;
                        color: #666;
                        border-top: 1px solid #ddd;
                        padding-top: 10px;
                    }}
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <div class="pharmacy-name">Health Plus Pharmacy</div>
                        <div class="pharmacy-contact">123 Medical Avenue, City | Phone: +91 1234567890 | Email: pharmacy@healthplus.com</div>
                    </div>
                    
                    <div class="bill-info">
                        <div class="patient-info">
                            <div class="info-title">Patient Information</div>
                            <div class="info-item">Name: {patient_name}</div>
                            <div class="info-item">Age/Gender: {patient_age or 'N/A'}/{patient_gender or 'N/A'}</div>
                            <div class="info-item">Contact: {patient_phone}</div>
                        </div>
                        
                        <div class="bill-details">
                            <div class="info-title">Bill Details</div>
                            <div class="info-item">Bill #: {bill_id}</div>
                            <div class="info-item">Date: {bill_date.strftime('%d-%m-%Y')}</div>
                            <div class="info-item">Time: {bill_date.strftime('%H:%M')}</div>
                            <div class="info-item">Payment Mode: {payment_mode.title()}</div>
                            <div class="info-item">Status: {payment_status.title()}</div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Quantity</th>
                                <th>Price (₹)</th>
                                <th>Discount</th>
                                <th>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
            """
            
            # Add rows for each medicine item
            for item in bill.items:
                item_total = item.quantity * item.price * (1 - item.discount / 100)
                discount_amount = (item.quantity * item.price * item.discount) / 100
                
                html_content += f"""
                            <tr>
                                <td>{item.name}</td>
                                <td>{item.quantity}</td>
                                <td>{item.price:.2f}</td>
                                <td>{item.discount}% ({discount_amount:.2f})</td>
                                <td>{item_total:.2f}</td>
                            </tr>
                """
            
            # Complete the HTML
            html_content += f"""
                        </tbody>
                    </table>
                    
                    <div class="summary">
                        <div class="total">Total Amount: ₹{total_amount:.2f}</div>
                    </div>
                    
                    <div class="footer">
                        <p>Thank you for choosing Health Plus Pharmacy. Get well soon!</p>
                        <p>This is a computer-generated receipt and does not require a signature.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Import WeasyPrint here to avoid startup overhead if not needed
            from weasyprint import HTML
            
            # Generate PDF from HTML
            pdf_buffer = io.BytesIO()
            HTML(string=html_content).write_pdf(pdf_buffer)
            
            # Get PDF content and convert to base64
            pdf_buffer.seek(0)
            pdf_content = pdf_buffer.getvalue()
            pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
            
            # 4. Return full bill with items and PDF
            return {
                "id": bill_id,
                "patient_id": patient_id,
                "patient_name": patient_name,
                "patient_age": patient_age,
                "patient_gender": patient_gender,
                "patient_phone": patient_phone,
                "bill_date": bill_date,
                "payment_mode": payment_mode,
                "payment_status": payment_status,
                "total_amount": total_amount,
                "items": bill_items,
                "pdf_base64": pdf_base64
            }
            
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pharmacy/bills/recent", response_model=List[PharmacyBillResponse])
def get_recent_pharmacy_bills(limit: int = 10):
    """Retrieve recent pharmacy bills"""
    try:
        with engine.begin() as conn:
            # Get recent bills with all their details in one query
            bills_query = text("""
                SELECT pb.id, pb.patient_id, pb.patient_name, pb.patient_age, pb.patient_gender, 
                       pb.patient_phone, pb.bill_date, pb.payment_mode, pb.payment_status, pb.total_amount
                FROM pharmacy_bills pb
                ORDER BY pb.bill_date DESC
                LIMIT :limit
            """)
            
            bills_result = conn.execute(bills_query, {"limit": limit})
            bills_data = [dict(row._mapping) for row in bills_result]
            
            # For each bill, get its items
            for bill in bills_data:
                items_query = text("""
                    SELECT id, medicine_id, medicine_name, quantity, price_per_unit, 
                           discount_percentage, item_total
                    FROM pharmacy_bill_items
                    WHERE bill_id = :bill_id
                """)
                
                items_result = conn.execute(items_query, {"bill_id": bill["id"]})
                bill["items"] = [dict(row._mapping) for row in items_result]
            
            return bills_data
            
    except Exception as e:
        print(f"Error in get_recent_pharmacy_bills: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/api/pharmacy/bills/{bill_id}", response_model=PharmacyBillResponse)
def get_pharmacy_bill(bill_id: int):
    """Retrieve a pharmacy bill by ID with all its items"""
    try:
        with engine.begin() as conn:
            # Get pharmacy bill data
            bill_query = text("""
                SELECT id, patient_id, patient_name, patient_age, patient_gender, patient_phone,
                       bill_date, payment_mode, payment_status, total_amount
                FROM pharmacy_bills WHERE id = :bill_id
            """)
            
            bill_result = conn.execute(bill_query, {"bill_id": bill_id})
            bill_row = bill_result.fetchone()
            
            if not bill_row:
                raise HTTPException(status_code=404, detail="Pharmacy bill not found")
            
            # Get pharmacy bill items
            items_query = text("""
                SELECT id, medicine_id, medicine_name, quantity, price_per_unit, 
                       discount_percentage, item_total
                FROM pharmacy_bill_items
                WHERE bill_id = :bill_id
            """)
            
            items_result = conn.execute(items_query, {"bill_id": bill_id})
            items = [dict(row._mapping) for row in items_result]
            
            # Generate PDF for the bill
            # Similar PDF generation code as in create_pharmacy_bill
            # (omitted for brevity but would be identical to the PDF generation above)
            
            # Construct response without PDF data initially
            return {
                "id": bill_row[0],
                "patient_id": bill_row[1],
                "patient_name": bill_row[2],
                "patient_age": bill_row[3],
                "patient_gender": bill_row[4],
                "patient_phone": bill_row[5],
                "bill_date": bill_row[6],
                "payment_mode": bill_row[7],
                "payment_status": bill_row[8],
                "total_amount": bill_row[9],
                "items": items
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pharmacy/bills/{bill_id}/pdf")
def get_pharmacy_bill_pdf(bill_id: int):
    """Generate and return a PDF for a pharmacy bill"""
    try:
        with engine.begin() as conn:
            # Get pharmacy bill data
            bill_query = text("""
                SELECT id, patient_id, patient_name, patient_age, patient_gender, patient_phone,
                       bill_date, payment_mode, payment_status, total_amount
                FROM pharmacy_bills WHERE id = :bill_id
            """)
            
            bill_result = conn.execute(bill_query, {"bill_id": bill_id})
            bill_row = bill_result.fetchone()
            
            if not bill_row:
                raise HTTPException(status_code=404, detail="Pharmacy bill not found")
            
            bill_id = bill_row[0]
            patient_name = bill_row[2]
            patient_age = bill_row[3]
            patient_gender = bill_row[4]
            patient_phone = bill_row[5]
            bill_date = bill_row[6]
            payment_mode = bill_row[7]
            payment_status = bill_row[8]
            total_amount = bill_row[9]
            
            # Get pharmacy bill items
            items_query = text("""
                SELECT id, medicine_id, medicine_name, quantity, price_per_unit, 
                       discount_percentage, item_total
                FROM pharmacy_bill_items
                WHERE bill_id = :bill_id
            """)
            
            items_result = conn.execute(items_query, {"bill_id": bill_id})
            items = [dict(row._mapping) for row in items_result]
            
            # Generate PDF - HTML content creation
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Pharmacy Bill Receipt</title>
                <style>
                    @page {{
                        size: A4;
                        margin: 1cm;
                    }}
                    body {{
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        color: #333;
                    }}
                    .receipt {{
                        max-width: 800px;
                        margin: 0 auto;
                        border: 1px solid #ddd;
                        padding: 20px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.1);
                    }}
                    .header {{
                        text-align: center;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }}
                    .pharmacy-name {{
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 5px;
                    }}
                    .pharmacy-contact {{
                        font-size: 14px;
                        color: #666;
                    }}
                    .bill-info {{
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }}
                    .patient-info, .bill-details {{
                        flex: 1;
                    }}
                    .info-title {{
                        font-weight: bold;
                        margin-bottom: 5px;
                    }}
                    .info-item {{
                        margin-bottom: 3px;
                    }}
                    table {{
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }}
                    th, td {{
                        border: 1px solid #ddd;
                        padding: 8px;
                        text-align: left;
                    }}
                    th {{
                        background-color: #f2f2f2;
                    }}
                    .summary {{
                        margin-top: 20px;
                        text-align: right;
                    }}
                    .total {{
                        font-weight: bold;
                        font-size: 18px;
                        margin-top: 10px;
                    }}
                    .footer {{
                        margin-top: 30px;
                        text-align: center;
                        font-size: 14px;
                        color: #666;
                        border-top: 1px solid #ddd;
                        padding-top: 10px;
                    }}
                </style>
            </head>
            <body>
                <div class="receipt">
                    <div class="header">
                        <div class="pharmacy-name">Health Plus Pharmacy</div>
                        <div class="pharmacy-contact">123 Medical Avenue, City | Phone: +91 1234567890 | Email: pharmacy@healthplus.com</div>
                    </div>
                    
                    <div class="bill-info">
                        <div class="patient-info">
                            <div class="info-title">Patient Information</div>
                            <div class="info-item">Name: {patient_name}</div>
                            <div class="info-item">Age/Gender: {patient_age or 'N/A'}/{patient_gender or 'N/A'}</div>
                            <div class="info-item">Contact: {patient_phone}</div>
                        </div>
                        
                        <div class="bill-details">
                            <div class="info-title">Bill Details</div>
                            <div class="info-item">Bill #: {bill_id}</div>
                            <div class="info-item">Date: {bill_date.strftime('%d-%m-%Y')}</div>
                            <div class="info-item">Time: {bill_date.strftime('%H:%M')}</div>
                            <div class="info-item">Payment Mode: {payment_mode.title()}</div>
                            <div class="info-item">Status: {payment_status.title()}</div>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Medicine</th>
                                <th>Quantity</th>
                                <th>Price (₹)</th>
                                <th>Discount</th>
                                <th>Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody>
            """
            
            # Add rows for each medicine item
            for item in items:
                discount_amount = (item['quantity'] * item['price_per_unit'] * item['discount_percentage']) / 100
                
                html_content += f"""
                            <tr>
                                <td>{item['medicine_name']}</td>
                                <td>{item['quantity']}</td>
                                <td>{item['price_per_unit']:.2f}</td>
                                <td>{item['discount_percentage']}% ({discount_amount:.2f})</td>
                                <td>{item['item_total']:.2f}</td>
                            </tr>
                """
            
            # Complete the HTML
            html_content += f"""
                        </tbody>
                    </table>
                    
                    <div class="summary">
                        <div class="total">Total Amount: ₹{total_amount:.2f}</div>
                    </div>
                    
                    <div class="footer">
                        <p>Thank you for choosing Health Plus Pharmacy. Get well soon!</p>
                        <p>This is a computer-generated receipt and does not require a signature.</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Import WeasyPrint here to avoid startup overhead if not needed
            from weasyprint import HTML
            from fastapi.responses import Response
            
            # Generate PDF from HTML
            pdf_buffer = io.BytesIO()
            HTML(string=html_content).write_pdf(pdf_buffer)
            
            # Return PDF as a downloadable file
            pdf_buffer.seek(0)
            pdf_content = pdf_buffer.getvalue()
            
            # Return PDF with proper headers for download
            return Response(
                content=pdf_content,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=pharmacy-bill-{bill_id}.pdf"
                }
            )
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/pharmacy/patient/{patient_id}/bills", response_model=List[PharmacyBillResponse])
def get_patient_pharmacy_bills(patient_id: int):
    """Retrieve all pharmacy bills for a patient"""
    try:
        with engine.begin() as conn:
            # Get all bills for the patient
            bills_query = text("""
                SELECT id FROM pharmacy_bills 
                WHERE patient_id = :patient_id 
                ORDER BY bill_date DESC
            """)
            
            bills_result = conn.execute(bills_query, {"patient_id": patient_id})
            bill_ids = [row[0] for row in bills_result]
            
            # Get details for each bill
            bills = []
            for bill_id in bill_ids:
                bill = get_pharmacy_bill(bill_id)
                # Remove pdf_base64 to reduce response size
                bill.pop("pdf_base64", None)
                bills.append(bill)
            
            return bills
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/pharmacy/bills/status/{status}", response_model=List[PharmacyBillResponse])
def get_pharmacy_bills_by_status(status: str, limit: int = 50):
    """Retrieve pharmacy bills by payment status"""
    try:
        with engine.begin() as conn:
            # Get bills by status
            bills_query = text("""
                SELECT id FROM pharmacy_bills 
                WHERE payment_status = :status
                ORDER BY bill_date DESC
                LIMIT :limit
            """)
            
            bills_result = conn.execute(bills_query, {"status": status, "limit": limit})
            bill_ids = [row[0] for row in bills_result]
            
            # Get details for each bill
            bills = []
            for bill_id in bill_ids:
                bill = get_pharmacy_bill(bill_id)
                # Remove pdf_base64 to reduce response size
                if "pdf_base64" in bill:
                    bill.pop("pdf_base64")
                bills.append(bill)
            
            return bills
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)